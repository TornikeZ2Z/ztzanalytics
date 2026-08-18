/* Company-Wide Questionnaire — HR's side of the Human Resources module (2026-08-17).
 *
 * Everything here talks to two dedicated endpoints (/api/_hrqadmin for HR, /api/_hrq only for
 * the preview) — no datasets, no global filters. The page is CAPABILITY-shaped: the server
 * says can_manage / can_results on the home payload and every button honours it, but the
 * buttons are cosmetics — the bridge re-checks per action.
 *
 * The question editor follows the Foreman Assessment questionnaire editor (the proven
 * DB-stored-questions UI): whole-form save, draft state, reorder, save-disabled-until-valid.
 * The one big lifecycle difference is deliberate: questions LOCK at publish, and changing a
 * published questionnaire means a NEW VERSION — the editor says so instead of allowing it.
 */
registerPage({
  id: "hr-questionnaire",
  group: "hr",
  title: "Company-Wide Questionnaire",
  datasets: [],
  async render(host) {
    var RSC = window.RSC || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__HQ || (window.__HQ = {
      view: "home", qid: null, qtab: "setup",
      home: null, q: null, roster: null, sub: null, res: null,
      draft: null, dirty: false, msg: "", msgErr: false,
      subFilter: "", subQ: "", resDept: "", resPerson: "", rosterQ: "",
    });

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
    function post(body) { return api("/api/_hrqadmin", { method: "POST", body: JSON.stringify(body) }); }

    /* ================================================================ style */
    if (!document.getElementById("hqCss")) {
      var st = document.createElement("style"); st.id = "hqCss";
      st.textContent = [
        ".hq{font-variant-numeric:tabular-nums}",
        ".hq-tabs{display:flex;gap:4px;margin:2px 0 16px}",
        ".hq-tabs button{font:inherit;font-size:14.5px;font-weight:750;color:var(--muted);background:transparent;border:0;border-radius:10px;padding:9px 16px;cursor:pointer}",
        ".hq-tabs button:hover{background:var(--panel-2);color:var(--ink)}",
        ".hq-tabs button.on{background:var(--brand);color:var(--brand-ink)}",
        ".hq-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:14px}",
        ".hq-card h4{margin:0 0 10px;font-size:15px;font-weight:800}",
        ".hq-dim{font-size:12.5px;color:var(--faint);line-height:1.55}",
        ".hq-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
        ".hq-btn{font:inherit;font-size:13.5px;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:7px 13px;cursor:pointer;white-space:nowrap}",
        ".hq-btn:hover{border-color:var(--brand);color:var(--brand)}",
        ".hq-btn.go{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}",
        ".hq-btn.go:hover{color:var(--brand-ink);filter:brightness(1.06)}",
        ".hq-btn.warn:hover{border-color:var(--red);color:var(--red)}",
        ".hq-btn:disabled{opacity:.5;cursor:default}",
        ".hq-pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px;background:var(--panel-2);color:var(--muted)}",
        ".hq-pill.draft{background:rgba(122,138,153,.16)}",
        ".hq-pill.published{background:rgba(46,160,90,.16);color:var(--pos)}",
        ".hq-pill.closed{background:rgba(226,168,43,.16);color:var(--warn)}",
        ".hq-pill.archived{opacity:.6}",
        ".hq-qitem{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:13px 16px;border:1px solid var(--line);border-radius:12px;margin-bottom:9px;background:var(--panel);cursor:pointer}",
        ".hq-qitem:hover{border-color:var(--brand)}",
        ".hq-qitem b{font-size:15.5px}",
        ".hq-qitem .meta{font-size:12.5px;color:var(--faint);margin-top:3px}",
        ".hq-qitem .nums{text-align:right;font-size:12px;color:var(--muted);white-space:nowrap}",
        ".hq-tbl{width:100%;border-collapse:collapse;font-size:13.5px}",
        ".hq-tbl th{text-align:left;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:0 10px 7px;border-bottom:1px solid var(--line);white-space:nowrap}",
        ".hq-tbl td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:middle}",
        ".hq-tbl tr:last-child td{border-bottom:0}",
        ".hq-tbl td.r,.hq-tbl th.r{text-align:right}",
        ".hq-in,.hq-sel,.hq-ta{font:inherit;font-size:13.5px;color:var(--ink);background:var(--panel);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px}",
        ".hq-in:focus,.hq-ta:focus{outline:none;border-color:var(--brand)}",
        ".hq-ta{width:100%;box-sizing:border-box;resize:vertical;min-height:56px}",
        ".hq-lab{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);margin:0 0 4px}",
        ".hq-field{margin-bottom:12px}",
        // question editor rows
        ".hq-ed{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:9px;background:var(--panel)}",
        ".hq-ed .top{display:flex;gap:8px;align-items:center;margin-bottom:8px}",
        ".hq-ed input.lbl{flex:1;font-weight:700}",
        ".hq-ed .mv{display:flex;flex-direction:column;gap:1px}",
        ".hq-ed .mv button{font-size:9px;line-height:1;padding:3px 6px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--muted);border-radius:5px;cursor:pointer}",
        ".hq-ed .mv button:hover{color:var(--ink)}",
        ".hq-ed .sub{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
        ".hq-req{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--muted);cursor:pointer;white-space:nowrap}",
        ".hq-opts{width:100%;box-sizing:border-box;margin-top:8px}",
        ".hq-stickybar{position:sticky;bottom:14px;background:var(--panel);border:1px solid var(--line-2);border-radius:13px;box-shadow:0 12px 34px rgba(0,0,0,.25);padding:12px 18px;display:flex;gap:14px;align-items:center;z-index:5}",
        ".hq-msg{font-size:12.5px;font-weight:700}",
        ".hq input[type=checkbox],.hq input[type=radio]{accent-color:var(--brand)}",
        ".hq-card h4.eyebrow{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:14px}",
        ".hq-audsel{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px;margin-bottom:12px}",
        ".hq-audopt{position:relative;border:1.5px solid var(--line-2);border-radius:13px;padding:13px 44px 12px 16px;cursor:pointer;transition:border-color .12s}",
        ".hq-audopt:hover{border-color:var(--brand)}",
        ".hq-audopt.on{border-color:var(--brand);background:var(--brand-glow)}",
        ".hq-audopt b{display:block;font-size:14.5px}",
        ".hq-audopt span{display:block;font-size:12px;color:var(--faint);margin-top:3px}",
        ".hq-audopt .tick{position:absolute;top:12px;right:13px;width:20px;height:20px;border-radius:50%;background:var(--brand);color:var(--brand-ink);display:none;align-items:center;justify-content:center;font-size:11px;font-weight:900}",
        ".hq-audopt.on .tick{display:inline-flex}",
        ".hq-audopt input{display:none}",
        ".hq-chipgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:9px}",
        ".hq-chip{display:flex;align-items:center;gap:10px;border:1.5px solid var(--line-2);border-radius:12px;padding:11px 14px;cursor:pointer;transition:border-color .12s}",
        ".hq-chip:hover{border-color:var(--brand)}",
        ".hq-chip.on{border-color:var(--brand);background:var(--brand-glow)}",
        ".hq-chip input{display:none}",
        ".hq-chip .dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}",
        ".hq-chip b{font-size:13.5px;flex:1;font-weight:700}",
        ".hq-chip em{font-style:normal;font-size:12px;color:var(--faint);font-variant-numeric:tabular-nums}",
        ".hq-chip .tick{width:18px;height:18px;border-radius:50%;background:var(--brand);color:var(--brand-ink);display:none;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex:0 0 auto}",
        ".hq-chip.on .tick{display:inline-flex}",
        ".hq-chip.dis{opacity:.55;pointer-events:none}",
        ".hq-ed{transition:border-color .12s}",
        ".hq-ed.sect{border-left:4px solid var(--brand)}",
        // the type picker: a pill that opens a DESIGNED menu (the native select popup can't be styled)
        ".hq-dd{position:relative;flex:0 0 auto}",
        ".hq-ddb{font:inherit;font-size:13px;font-weight:700;color:var(--muted);background:var(--panel-2);border:1px solid transparent;border-radius:9px;padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}",
        ".hq-ddb:hover{border-color:var(--line-2);color:var(--ink)}",
        ".hq-ddb .ic{color:var(--brand);font-size:12px;line-height:1}",
        ".hq-ddb .car{color:var(--faint);font-size:9px}",
        ".hq-ddm{position:absolute;top:calc(100% + 7px);right:0;z-index:80;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:6px;min-width:248px}",
        ".hq-ddi{display:flex;gap:11px;align-items:center;padding:8px 11px;border-radius:10px;cursor:pointer}",
        ".hq-ddi:hover{background:var(--panel-2)}",
        ".hq-ddi.on{background:var(--brand-glow)}",
        ".hq-ddi .ic{width:27px;height:27px;border-radius:8px;background:var(--panel-2);display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:var(--muted);flex:0 0 auto}",
        ".hq-ddi:hover .ic{color:var(--brand)}",
        ".hq-ddi.on .ic{background:var(--brand);color:var(--brand-ink)}",
        ".hq-ddi b{display:block;font-size:13.5px;line-height:1.25}",
        ".hq-ddi em{display:block;font-style:normal;font-size:11.5px;color:var(--faint);margin-top:1px}",
        ".hq-ddsep{height:1px;background:var(--line);margin:5px 9px}",
        // the modern flow: compact rows, insert zones, drag indicators
        ".hq-qr{display:flex;gap:12px;align-items:center;padding:12px 16px;border:1px solid var(--line);border-radius:14px;background:var(--panel);cursor:pointer;transition:border-color .12s;margin-bottom:9px}",
        ".hq-qr:hover{border-color:var(--brand)}",
        ".hq-qr.sect2{border-left:4px solid var(--brand)}",
        ".hq-qr.sect2 .lb{font-size:15.5px}",
        ".hq-qr .lb{flex:1;font-weight:750;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}",
        ".hq-qr .lb.em{color:var(--faint);font-weight:600}",
        ".hq-qr .ty{display:inline-flex;gap:7px;align-items:center;font-size:11.5px;font-weight:700;color:var(--faint);white-space:nowrap}",
        ".hq-qr .ty .ic{color:var(--brand);font-size:11px}",
        ".hq-qr .rq{width:7px;height:7px;border-radius:50%;background:var(--brand);flex:0 0 auto}",
        ".hq-grip{color:var(--line-2);cursor:grab;font-size:15px;flex:0 0 auto;user-select:none}",
        ".hq-grip:hover{color:var(--muted)}",
        ".hq-ins{height:15px;margin:-7px 0 -2px;display:flex;align-items:center;opacity:0;transition:opacity .12s;cursor:pointer}",
        ".hq-ins:hover{opacity:1}",
        ".hq-ins i{flex:1;height:1px;background:var(--brand)}",
        ".hq-ins span{font-size:10.5px;font-weight:800;color:var(--brand);background:var(--brand-glow);border:1px solid var(--brand);border-radius:999px;padding:1px 11px;margin:0 9px;white-space:nowrap}",
        ".hq-ed.on{border-color:var(--brand);box-shadow:0 6px 22px rgba(0,0,0,.08)}",
        ".hq-drop-a{box-shadow:0 -3px 0 var(--brand)}",
        // the anonymous-audience accordion: one team open at a time, X leaves someone out
        ".hq-anr{border:1px solid var(--line);border-radius:13px;background:var(--panel);margin-top:8px;overflow:hidden}",
        ".hq-anr .hd{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:9px;padding:12px 15px;cursor:pointer;font:inherit;background:none;border:none;text-align:left;color:var(--ink)}",
        ".hq-anr .hd b{font-size:13px;font-weight:800}",
        ".hq-anr .hd .n{margin-left:auto;font-size:11px;font-weight:700;color:var(--muted);background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:3px 10px;white-space:nowrap}",
        ".hq-anr .hd .ch{color:var(--faint);font-size:11px;transition:transform .15s}",
        ".hq-anr.on{border-color:var(--brand)}",
        ".hq-anr.on .hd .ch{transform:rotate(180deg)}",
        ".hq-anr .bd{border-top:1px solid var(--line);padding:8px 10px 10px;background:var(--panel-2)}",
        ".hq-anr .gr{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px 12px}",
        ".hq-anp2{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:9px;font-size:12.5px;font-weight:650;min-width:0}",
        ".hq-anp2:hover{background:var(--panel)}",
        ".hq-anp2 .dt{width:7px;height:7px;border-radius:50%;flex:0 0 auto}",
        ".hq-anp2 .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:auto}",
        ".hq-anp2 em{font-style:normal;color:var(--faint);font-size:10.5px;white-space:nowrap}",
        ".hq-anp2 .x{flex:0 0 auto;width:22px;height:22px;border-radius:7px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:11px;font-weight:800;cursor:pointer;line-height:1;padding:0}",
        ".hq-anp2 .x:hover{border-color:#c0392b;color:#c0392b}",
        ".hq-anp2.off{opacity:.5}",
        ".hq-anp2.off .x:hover{border-color:var(--brand);color:var(--brand)}",
        ".hq-anadd{margin-top:8px;background:none;border:none;color:var(--brand);font-weight:700;font-size:12px;cursor:pointer;padding:4px 6px}",
        ".hq-anpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:4px;margin-top:6px;max-height:190px;overflow:auto;padding:2px}",
        ".hq-anpick .pk{display:flex;gap:8px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:12px;font-weight:650;cursor:pointer;text-align:left;color:var(--ink)}",
        ".hq-anpick .pk:hover{border-color:var(--brand)}",
        ".hq-anpick .pk em{font-style:normal;color:var(--faint);font-size:10px;margin-left:auto;white-space:nowrap}",
        ".hq-anlk{display:flex;gap:10px;align-items:center;padding:9px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:7px;font-size:12.5px;background:var(--panel)}",
        ".hq-anlk b{white-space:nowrap}",
        ".hq-anlk code{flex:1;font-size:11px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".hq-drop-b{box-shadow:0 3px 0 var(--brand)}",
        ".hq-ed.sect .lbl{font-size:16px}",
        // the Georgian twin of whatever sits above it
        ".hq-ka{margin:9px 0 0 37px;border-left:3px solid var(--brand);background:var(--brand-glow);border-radius:0 10px 10px 0;padding:9px 12px}",
        /* EN | KA side by side (2026-08-18). The translation used to sit in a block
           BELOW the question with the choices retyped line-for-line into a textarea,
           so you edited a list in one box and its translation in another and hoped the
           order still matched. Now every string faces its twin. */
        ".hq-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 26px;margin:10px 0 2px 37px;align-items:center}",
        /* fill the column. Without this the inputs kept the browser default width and
           both languages sat truncated in the left third of a very wide card. */
        ".hq-grid input,.hq-grid textarea,.hq-grid select{width:100%;box-sizing:border-box}",
        ".hq-grid>div:nth-child(even){border-left:1px solid var(--line);padding-left:14px}",
        ".hq-grid .lbl{font-size:15px;font-weight:700}",
        ".hq-grid .h{padding-bottom:1px}",
        ".hq-grid .h{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}",
        ".hq-grid .h.ka{color:var(--brand)}",
        ".hq-grid .sp{grid-column:1 / -1;height:1px;background:var(--line);margin:3px 0}",
        ".hq-grid .full{grid-column:1 / -1}",
        ".hq-opt{display:flex;gap:7px;align-items:center}",
        ".hq-opt .n{font-size:11px;color:var(--faint);width:14px;text-align:right;flex:none}",
        ".hq-opt input{flex:1;min-width:0}",
        ".hq-ox{font:inherit;font-size:12px;line-height:1;color:var(--faint);background:none;border:0;cursor:pointer;padding:3px 5px;flex:none}",
        ".hq-ox:hover{color:var(--red)}",
        ".hq-add{font:inherit;font-size:12px;font-weight:700;color:var(--brand);background:none;border:1px dashed var(--line-2);border-radius:9px;padding:5px 11px;cursor:pointer}",
        ".hq-add:hover{border-color:var(--brand)}",
        ".hq-ka .kah{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--brand);margin-bottom:6px}",
        ".hq-ka .kah em{font-style:normal;color:var(--faint);font-weight:700;text-transform:none;letter-spacing:0;margin-left:7px}",
        ".hq-ka input,.hq-ka textarea{width:100%;box-sizing:border-box;background:var(--panel)}",
        ".hq-ka .two{display:flex;gap:8px;margin-top:6px}",
        ".hq-kaw{margin-top:12px;border-left:3px solid var(--brand);background:var(--brand-glow);border-radius:0 12px 12px 0;padding:12px 15px}",
        ".hq-ed .num{width:27px;height:27px;border-radius:9px;background:var(--panel-2);color:var(--muted);font-weight:800;font-size:12.5px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}",
        // quiet fields: invisible until touched — the form-builder look
        ".hq-fld,.hq-flda{font:inherit;font-size:14px;color:var(--ink);background:transparent;border:1px solid transparent;border-radius:9px;padding:8px 11px;transition:background .12s,border-color .12s;box-sizing:border-box}",
        ".hq-fld:hover:not(:disabled):not(:focus),.hq-flda:hover:not(:disabled):not(:focus){background:var(--panel-2)}",
        ".hq-fld:focus,.hq-flda:focus{outline:none;background:var(--panel);border-color:var(--brand)}",
        ".hq-fld::placeholder,.hq-flda::placeholder{color:var(--faint)}",
        ".hq-flda{width:100%;resize:vertical;min-height:54px;line-height:1.55}",
        ".hq-ed{padding:13px 16px 11px;border-radius:14px}",
        ".hq-ed .lbl{flex:1;font-weight:750;font-size:15px}",
        ".hq-ed .dsc{display:block;font-size:13px;color:var(--muted);margin-left:37px;width:calc(100% - 37px)}",
        ".hq-ed .mv button{border:0;background:transparent;color:var(--faint);font-size:10px;padding:2px 6px;border-radius:6px;cursor:pointer}",
        ".hq-ed .mv button:hover:not(:disabled){background:var(--panel-2);color:var(--ink)}",
        ".hq-ed .mv button:disabled{opacity:.3;cursor:default}",
        ".hq-x{width:30px;height:30px;border-radius:9px;border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:14px;flex:0 0 auto}",
        ".hq-x:hover{background:rgba(226,73,73,.12);color:var(--neg)}",
        ".hq-sel{background:var(--panel-2);border-color:transparent;border-radius:9px;font-weight:700;color:var(--muted);cursor:pointer}",
        ".hq-sel:hover{border-color:var(--line-2)}",
        // required: a real toggle switch
        ".hq-reqt{display:inline-flex;align-items:center;gap:7px;cursor:pointer;white-space:nowrap;flex:0 0 auto}",
        ".hq-reqt input{display:none}",
        ".hq-tgl{position:relative;width:34px;height:20px;background:var(--line-2);border-radius:999px;transition:background .15s;flex:0 0 auto}",
        ".hq-tgl::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.3)}",
        ".hq-reqt input:checked~.hq-tgl{background:var(--brand)}",
        ".hq-reqt input:checked~.hq-tgl::after{left:16px}",
        ".hq-reqt .rt{font-size:12px;font-weight:700;color:var(--faint)}",
        ".hq-tgl.big{width:46px;height:25px}",
        ".hq-tgl.big::after{width:21px;height:21px}",
        ".hq-reqt input:checked~.hq-tgl.big::after{left:23px}",
        ".hq-reqt input:checked~.rt{color:var(--brand)}",
        // hand-picked people: tags above, picker below (added people leave the list)
        ".hq-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;min-height:8px}",
        ".hq-tag{display:inline-flex;align-items:center;gap:8px;background:var(--brand-glow);border:1px solid var(--brand);border-radius:999px;padding:5px 6px 5px 13px;font-size:13px;font-weight:700}",
        ".hq-tag em{font-style:normal;color:var(--faint);font-weight:600;font-size:11.5px}",
        ".hq-tag button{width:20px;height:20px;border-radius:50%;border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:12px;line-height:1}",
        ".hq-tag button:hover{background:rgba(226,73,73,.15);color:var(--neg)}",
        ".hq-ppl{border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:560px}",
        ".hq-ppl input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line);background:var(--panel);font:inherit;font-size:13.5px;padding:11px 14px;color:var(--ink)}",
        ".hq-ppl input:focus{outline:none}",
        ".hq-ppl .ls{max-height:250px;overflow:auto}",
        ".hq-ppl .pp{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;font-size:13.5px}",
        ".hq-ppl .pp:hover{background:var(--panel-2)}",
        ".hq-ppl .pp .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}",
        ".hq-ppl .pp b{font-weight:700}",
        ".hq-ppl .pp em{font-style:normal;color:var(--faint);font-size:12px;margin-left:auto}",
        // settings: roomier cards, two-column wording on wide screens
        ".hq-wgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px}",
        ".hq-wgrid .full{grid-column:1 / -1}",
        "@media(max-width:1000px){.hq-wgrid{grid-template-columns:1fr}}",
        // boxed fields: settings inputs stay visibly a container, brand on focus
        ".hq-fld.bx,.hq-flda.bx,.hq-in.bx{background:var(--panel-2);border-color:transparent}",
        ".hq-fld.bx:hover:not(:focus):not(:disabled),.hq-flda.bx:hover:not(:focus):not(:disabled),.hq-in.bx:hover:not(:focus):not(:disabled){border-color:var(--line-2)}",
        ".hq-fld.bx:focus,.hq-flda.bx:focus,.hq-in.bx:focus{background:var(--panel);border-color:var(--brand)}",
        ".hq-flda.bx{min-height:66px}",
        ".hq-secdiv{display:flex;align-items:center;gap:14px;margin:28px 2px 14px;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}",
        ".hq-secdiv::after{content:'';flex:1;height:1px;background:var(--line)}",
        ".hq-msg.err{color:var(--neg)}",
        ".hq-msg.ok{color:var(--pos)}",
        // results
        ".hq-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}",
        ".hq-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:11px 15px}",
        ".hq-kpi b{display:block;font-size:24px;letter-spacing:-.5px}",
        ".hq-kpi span{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:4px}",
        ".hq-bar{display:grid;grid-template-columns:minmax(90px,220px) 1fr 64px;gap:10px;align-items:center;padding:4px 0;font-size:12.5px}",
        ".hq-bar .tr{height:10px;border-radius:6px;background:var(--panel-2);overflow:hidden}",
        ".hq-bar .tr i{display:block;height:100%;background:var(--brand);border-radius:6px}",
        ".hq-bar .n{text-align:right;color:var(--muted)}",
        ".hq-txt{border-left:3px solid var(--line-2);padding:6px 12px;margin:7px 0;font-size:13.5px;line-height:1.5}",
        ".hq-txt .who{font-size:11px;color:var(--faint);margin-top:3px}",
        ".hq-guide{max-width:760px;line-height:1.65;font-size:13.5px}",
        ".hq-guide h3{margin:22px 0 6px;font-size:15px}",
        ".hq-guide li{margin:5px 0}",
        ".hq-guide code{background:var(--panel-2);border-radius:5px;padding:1px 6px;font-size:12px}",
        ".hq-ovl{position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:130;display:flex;align-items:flex-start;justify-content:center;padding:34px 16px;overflow:auto}",
        ".hq-ovl .pane{background:var(--panel);border:1px solid var(--line);border-radius:16px;max-width:1020px;width:100%;padding:20px 24px;box-shadow:0 18px 60px rgba(0,0,0,.35)}",
        // the confirmation modal (native confirm() is banned from here on)
        ".hq-cfm{position:fixed;inset:0;background:rgba(10,14,20,.5);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px}",
        ".hq-cfm .box{background:var(--panel);border:1px solid var(--line);border-radius:16px;max-width:460px;width:100%;padding:24px 26px;box-shadow:0 18px 60px rgba(0,0,0,.4)}",
        ".hq-cfm h3{margin:0 0 9px;font-size:16.5px}",
        ".hq-cfm p{margin:0 0 20px;font-size:13.5px;color:var(--muted);line-height:1.65}",
        ".hq-cfm .btns{display:flex;gap:10px;justify-content:flex-end}",
        ".hq-cfm .btns .hq-btn{padding:9px 18px;font-size:13.5px}",
        ".hq-btn.danger{background:var(--neg);border-color:var(--neg);color:#fff}",
        ".hq-btn.danger:hover{border-color:var(--neg);color:#fff;filter:brightness(1.08)}",
        ".hq-btn.send{background:var(--ink);border-color:var(--ink);color:var(--panel)}",
        ".hq-btn.send:hover{border-color:var(--ink);color:var(--panel);filter:brightness(1.18)}",
        ".pv-sec{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}",
        ".pv-mail{width:100%;height:290px;border:1px solid var(--line);border-radius:10px;background:#fff}",
        ".pv-q{border:1px solid var(--line);border-radius:11px;padding:11px 14px;margin:8px 0;background:var(--panel-2)}",
        ".pv-q b{font-size:13px}",
        ".pv-stars{font-size:22px;color:var(--line-2);letter-spacing:3px;margin-top:6px}",
        ".pv-ch{display:block;font-size:12.5px;color:var(--muted);padding:3px 0}",
        ".pv-ta{border:1px dashed var(--line-2);border-radius:8px;padding:9px 11px;font-size:12px;color:var(--faint);margin-top:6px}",
        ".hq-tbl tr.rowlink{cursor:pointer}",
        ".hq-tbl tr.rowlink:hover td{background:var(--panel-2)}",
        // the responses board
        ".hq-tbl.board th{padding:13px 12px 10px}",
        ".hq-tbl.board td{padding:10px 12px}",
        ".hq-av{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;letter-spacing:.02em;flex:0 0 auto}",
        ".hq-pcell{display:flex;align-items:center;gap:11px}",
        ".hq-pcell .nm{font-weight:750;font-size:13.5px}",
        ".hq-pcell .em{font-size:11.5px;color:var(--faint);margin-top:1px}",
        ".hq-dept{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:650;color:var(--muted);white-space:nowrap}",
        ".hq-dept i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}",
        ".hq-st{display:inline-flex;align-items:center;gap:7px;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:4px 11px;border-radius:999px;white-space:nowrap}",
        ".hq-st i{width:6px;height:6px;border-radius:50%;background:currentColor}",
        ".hq-st.g{background:rgba(46,160,90,.13);color:var(--pos)}",
        ".hq-st.a{background:rgba(226,168,43,.15);color:var(--warn)}",
        ".hq-st.n{background:var(--panel-2);color:var(--muted)}",
        ".hq-st.b{background:rgba(79,102,208,.13);color:#5b6fd6}",
        ".hq-st.r{background:rgba(226,73,73,.13);color:var(--neg)}",
        ".hq-ok{color:var(--pos);font-weight:700;font-size:12.5px;white-space:nowrap}",
        ".hq-kpi .pb{height:5px;border-radius:3px;background:var(--panel-2);margin-top:9px;overflow:hidden}",
        ".hq-kpi .pb i{display:block;height:100%;background:var(--brand);border-radius:3px}",
        // statistics: two questions share a row on wide screens
        ".hq-resgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}",
        ".hq-resgrid .hq-card{margin-bottom:0}",
        "@media(max-width:1150px){.hq-resgrid{grid-template-columns:1fr}}",
        // preview: email on the left, the form on the right
        ".pv-grid{display:grid;grid-template-columns:390px minmax(0,1fr);gap:26px;align-items:start}",
        ".pv-left{position:sticky;top:12px}",
        "@media(max-width:900px){.pv-grid{grid-template-columns:1fr}.pv-left{position:static}}",
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="hq">'
      + '<div class="rs-page-head"><h1>Company-Wide Questionnaire</h1>'
      + "<p>HR builds the questions here, publishes, shares one link, and reads the results."
      + '<span class="freshness"> · questions live in the database — never in code</span></p></div>'
      + '<div class="hq-tabs" id="hqTabs"></div><div id="hqMain"></div></div>';
    var main = host.querySelector("#hqMain");
    var tabsEl = host.querySelector("#hqTabs");
    // Fresh mount = fresh state. The portal sidebar navigates by hashchange with no
    // page-leave hook, so the in-page confirm+discard guards can be bypassed entirely;
    // without this reset an abandoned edit came BACK on the next visit labeled "saved" —
    // on a published questionnaire it rendered questions that are not the real ones.
    S.dirty = false; S.draft = null; S.draftFor = null; S.msg = "";
    // every visit starts on the questionnaire LIST (his call, 2026-08-17) — a page
    // reopened hours later must not resurrect whatever was open last time
    S.view = "home"; S.qid = null; S.qtab = "setup"; S.subOpen = null;

    var DEPT_COLOR = { Executive: "#4f46e5", Sales: "#2563eb", Marketing: "#9333ea",
                       "Customer Service": "#0d9488", "Data & Control": "#16a34a",
                       Finance: "#d97706", Systems: "#0891b2", HR: "#e11d48",
                       Operations: "#059669", Foremen: "#b45309",
                       Drivers: "#0e7490", Helpers: "#64748b" };
    var deptColor = function (d) { return DEPT_COLOR[d] || "#7c3aed"; };
    var fmtPct = function (n, d) { return d ? Math.round(n / d * 100) + "%" : "—"; };
    // one corrupt stored value must not blank the whole Results tab
    var safeArr = function (v) { try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    var clampStar = function (v) { var n = Math.round(+v); return n >= 1 && n <= 5 ? n : 0; };
    // naive-UTC bridge stamp -> the picker's zone (the Z is load-bearing; see rs-core)
    var fmtWhen = function (s, dayOnly) {
      if (!s) return "";
      var d = new Date(String(s).replace(" ", "T") + "Z");
      if (isNaN(d)) return String(s);
      if (!(window.RS && RS.fmtTz)) return dayOnly ? d.toLocaleDateString() : d.toLocaleString();
      return dayOnly ? RS.fmtTzDay(d) : RS.fmtTzDay(d) + ", " + RS.fmtTz(d) + " " + RS.tzShort();
    };

    /* ================================================================ data loads */
    async function loadHome() { S.home = await api("/api/_hrqadmin?view=home"); }
    async function loadQ() { S.q = await api("/api/_hrqadmin?view=questionnaire&id=" + S.qid); }
    async function loadRoster() { S.roster = (await api("/api/_hrqadmin?view=roster")).roster; }
    async function loadSub() { S.sub = await api("/api/_hrqadmin?view=submissions&id=" + S.qid); }
    async function loadRes() { S.res = await api("/api/_hrqadmin?view=results&id=" + S.qid); }

    function toast(t, err) {
      S.msg = t; S.msgErr = !!err;
      var el = main.querySelector("#hqMsg");
      if (el) { el.textContent = t; el.className = "hq-msg " + (err ? "err" : "ok"); }
    }
    // Abandoning edits must clear the draft TOO, not just the flag — a kept draft
    // resurrects the "lost" edits on the next visit, labeled "saved".
    function discardDraft() { S.dirty = false; S.draft = null; S.draftFor = null; S.qFocus = null; }

    // ONE promise-shaped confirmation surface for the whole page. opts: t (title),
    // b (body, trusted page-authored HTML), yes/no labels, danger (red confirm).
    function hqConfirm(opts) {
      return new Promise(function (res) {
        var o = document.createElement("div");
        o.className = "hq-cfm";
        o.innerHTML = '<div class="box"><h3>' + opts.t + "</h3><p>" + opts.b + "</p>"
          + '<div class="btns"><button class="hq-btn" data-no>' + (opts.no || "Cancel") + "</button>"
          + '<button class="hq-btn ' + (opts.danger ? "danger" : "go") + '" data-yes>'
          + (opts.yes || "Confirm") + "</button></div></div>";
        document.body.appendChild(o);
        var done = function (v) { o.remove(); document.removeEventListener("keydown", onk); res(v); };
        var onk = function (e) { if (e.key === "Escape") done(false); };
        document.addEventListener("keydown", onk);
        o.querySelector("[data-yes]").onclick = function () { done(true); };
        o.querySelector("[data-no]").onclick = function () { done(false); };
        o.onclick = function (e) { if (e.target === o) done(false); };
        o.querySelector("[data-yes]").focus();
      });
    }

    // The one Save button collects from both editors through these; painters
    // re-register on every paint, and paintQ clears them first so a hook can
    // never carry another questionnaire's closure.
    var HOOKS = { settings: null, questions: null };

    function markDirty() {
      S.dirty = true;
      var el = main.querySelector("#hqDirty");
      if (el) el.textContent = "unsaved changes";
    }

    /* No page-level tab bar (his call, 2026-08-18): people live on the Team Directory,
       the guide is retired, so this page IS the questionnaire list. */
    function paintTabs() { tabsEl.innerHTML = ""; }

    /* ================================================================ home */
    async function paintHome() {
      await loadHome();
      var h = S.home, canM = h.can_manage;
      var html = '<div class="hq-row" style="margin-bottom:14px">'
        + (canM ? '<button class="hq-btn go" id="hqNew">+ New questionnaire</button>' : "")
        + '<span class="hq-dim">' + h.roster_active + " people on the Team Directory — "
        + "finalizing a questionnaire emails each of them a personal invite</span></div>"
        + (canM ? '<div class="hq-row hq-newrow" id="hqNewRow" style="display:none;margin-bottom:14px">'
          + '<input id="hqNewTitle" class="hq-in" style="min-width:320px" maxlength="200" '
          + 'placeholder="Title of the new questionnaire…">'
          + '<button class="hq-btn go" id="hqNewGo">Create draft</button>'
          + '<button class="hq-btn" id="hqNewNo">Cancel</button></div>' : "");
      var item = function (q) {
        var done = (q.responses.submitted || 0) + (q.responses.resubmitted || 0);
        return '<div class="hq-qitem" data-q="' + q.id + '"><div>'
          + "<b>" + esc(q.title) + "</b> "
          + '<span class="hq-pill ' + esc(q.status) + '">' + esc(q.status) + "</span>"
          + (q.version > 1 ? ' <span class="hq-dim">v' + q.version + "</span>" : "")
          + '<div class="meta">' + q.question_count + " questions · audience "
          + q.audience_size
          + (q.published_at ? " · published " + esc(fmtWhen(q.published_at, true)) : "")
          + "</div></div>"
          + '<div class="nums"><b style="font-size:17px">' + done + " / " + q.audience_size + "</b>"
          + "<br>submitted · " + fmtPct(done, q.audience_size) + "</div></div>";
      };
      // archived history stays reachable but out of the way — the list shows the living
      var live = h.questionnaires.filter(function (q) { return q.status !== "archived"; });
      var arch = h.questionnaires.filter(function (q) { return q.status === "archived"; });
      if (!live.length) {
        html += '<div class="hq-card"><h4>Nothing here yet</h4><div class="hq-dim">'
          + (canM ? "Create a questionnaire, set it up, then finalize — everyone on the "
                    + "Team Directory receives the invite."
                  : "No questionnaires have been created yet.") + "</div></div>";
      }
      html += live.map(item).join("");
      if (arch.length) {
        html += '<div class="hq-dim" style="margin:12px 2px 6px;cursor:pointer" id="hqArchT">'
          + (S.showArch ? "▾ " : "▸ ") + arch.length + " archived</div>"
          + (S.showArch ? arch.map(item).join("") : "");
      }
      html += '<div class="hq-msg" id="hqMsg" style="margin-top:8px"></div>';
      main.innerHTML = html;
      var nb = main.querySelector("#hqNew");
      if (nb) {
        var row = main.querySelector("#hqNewRow"), tIn = main.querySelector("#hqNewTitle");
        var creating = false;
        var create = async function () {
          var t = tIn.value.trim();
          if (!t) { tIn.focus(); return; }
          if (creating) return;                  // a double-click must not mint two drafts
          creating = true;
          try { var r = await post({ action: "create", title: t }); S.view = "q"; S.qid = r.id; S.qtab = "setup"; go(); }
          catch (e) { creating = false; toast(e.message, true); }
        };
        nb.onclick = function () { row.style.display = ""; tIn.focus(); };
        main.querySelector("#hqNewGo").onclick = create;
        tIn.onkeydown = function (ev) { if (ev.key === "Enter") create(); };
        main.querySelector("#hqNewNo").onclick = function () { row.style.display = "none"; tIn.value = ""; };
      }
      var at = main.querySelector("#hqArchT");
      if (at) at.onclick = function () { S.showArch = !S.showArch; paintHome(); };
      main.querySelectorAll(".hq-qitem").forEach(function (el) {
        el.onclick = function () { S.view = "q"; S.qid = +el.dataset.q; S.qtab = "setup"; S.dirty = false; go(); };
      });
    }

    /* ================================================================ one questionnaire */
    async function paintQ() {
      await loadQ();
      HOOKS.settings = HOOKS.questions = null;
      var q = S.q, canM = S.home && S.home.can_manage, canR = S.home && S.home.can_results;
      var lifecycle = "";
      if (canM) {
        if (q.status === "draft") lifecycle = '<button class="hq-btn" data-lc="preview">Preview</button>'
          + '<button class="hq-btn send" data-lc="publish">Finalize &amp; send</button>'
          + (q.deletable
              ? '<button class="hq-btn warn" data-lc="delete">Delete draft</button>'
              : '<button class="hq-btn warn" data-lc="archive">Archive draft</button>');
        else if (q.status === "published") lifecycle = '<button class="hq-btn" data-lc="preview">Preview</button>'
          + '<button class="hq-btn" data-lc="new_version">New version</button>';
        else if (q.status === "closed") lifecycle = '<button class="hq-btn" data-lc="new_version">New version</button>'
          + '<button class="hq-btn warn" data-lc="archive">Archive</button>';
      }
      if (["setup", "submissions", "results"].indexOf(S.qtab) < 0) S.qtab = "setup";
      var saveBtn = canM && S.qtab === "setup" && (q.status === "draft" || q.status === "published")
        ? '<button class="hq-btn go" id="hqSaveAll" style="padding:8px 26px;font-size:14px">Save</button>' : "";
      var subtabs = [["setup", "Set up"], ["submissions", "Responses"]]
        .concat(canR ? [["results", "Statistics"]] : []);
      main.innerHTML =
        '<div class="hq-row" style="margin-bottom:12px">'
        + '<button class="hq-btn" id="hqBack">← All questionnaires</button>'
        + "<b style=\"font-size:17px\">" + esc(q.title) + "</b>"
        + '<span class="hq-pill ' + esc(q.status) + '">' + esc(q.status) + "</span>"
        + (q.version > 1 ? '<span class="hq-dim">version ' + q.version + "</span>" : "")
        + '<span style="flex:1"></span>' + saveBtn + lifecycle + "</div>"
        + '<div class="hq-tabs" style="margin-bottom:12px">' + subtabs.map(function (t) {
            return '<button data-st="' + t[0] + '" class="' + (S.qtab === t[0] ? "on" : "") + '">' + t[1] + "</button>";
          }).join("") + "</div>"
        + '<div id="hqQBody"></div>'
        + '<div class="hq-msg" id="hqMsg" style="margin-top:8px"></div>';
      main.querySelector("#hqBack").onclick = async function () {
        if (S.dirty && !(await hqConfirm({ t: "Leave without saving?",
            b: "The changes you made on this questionnaire will be lost.",
            yes: "Leave", danger: true }))) return;
        S.view = "home"; S.qid = null; discardDraft(); go();
      };
      main.querySelectorAll("[data-lc]").forEach(function (b) {
        b.onclick = async function () {
          var a = b.dataset.lc;
          if (a === "preview") { openPreview(q); return; }
          if (S.dirty) {           // finalizing over unsaved edits would lock the OLD words
            toast("You have unsaved edits — press Save first", true);
            return;
          }
          // how many people the invite actually reaches, from the live roster
          var audN = (function () {
            var act2 = (S.roster || []).filter(function (p) { return p.status === "active"; });
            if (q.audience_kind === "all") return act2.length;
            if (q.audience_kind === "anon_depts") return (q.audience_values || []).length;
            var vals2 = (q.audience_values || []).map(function (v) { return String(v).toLowerCase(); });
            if (q.audience_kind === "departments")
              return act2.filter(function (p) {
                return vals2.indexOf(String(p.department || "").toLowerCase()) >= 0;
              }).length;
            return vals2.length;
          })();
          var W = { publish: { t: "Finalize &amp; send?",
                      b: q.audience_kind === "anon_depts"
                        ? "The questionnaire goes live and <b>" + audN + " people</b> receive their "
                          + "team's <b>anonymous</b> link by email. Nobody's name is ever recorded. "
                          + "Questions lock, and it can never be deleted — only deactivated."
                        : "The questionnaire goes live and <b>" + audN + (audN === 1 ? " person" : " people")
                        + "</b> receive the invite email right away. Questions lock, and it can "
                        + "never be deleted — only deactivated.",
                      yes: "Finalize &amp; send" },
                    close: { t: "Deactivate?", b: "Nobody will be able to submit any more.",
                      yes: "Deactivate", danger: true },
                    archive: q.status === "draft"
                      ? { t: "Archive this draft?",
                          b: "It leaves the list and can never be published.", yes: "Archive", danger: true }
                      : { t: "Archive?", b: "It disappears from the employee page entirely. This is final.",
                          yes: "Archive", danger: true },
                    "delete": { t: "Delete this draft?",
                      b: "Its questions and settings are gone for good. Nobody was sent anything, "
                        + "so nothing else is lost.", yes: "Delete it", danger: true },
                    new_version: { t: "New version?",
                      b: "Creates a fresh draft with the same questions. The current one keeps "
                        + "everything already answered.", yes: "Create the draft" } }[a];
          if (!(await hqConfirm(W))) return;
          try {
            var r = await post({ action: a, id: q.id });
            discardDraft();
            if (a === "new_version") { S.qid = r.id; S.qtab = "setup"; }
            if ((a === "archive" || a === "delete") && q.status === "draft") { S.view = "home"; S.qid = null; }
            if (a === "publish") { S.qtab = "submissions"; }
            go();
            if (a === "publish") sendInvites(q.id);
            if (a === "delete") toast("Draft deleted");
          } catch (e) { toast(e.message, true); }
        };
      });
      main.querySelectorAll("[data-st]").forEach(function (b) {
        b.onclick = async function () {
          if (S.dirty && !(await hqConfirm({ t: "Leave without saving?",
              b: "The changes you made on this questionnaire will be lost.",
              yes: "Leave", danger: true }))) return;
          S.qtab = b.dataset.st; S.subOpen = null; discardDraft(); go();
        };
      });
      var body = main.querySelector("#hqQBody");
      if (S.qtab === "setup") {
        // ONE editing surface (his call): settings on top, the questions right under
        body.innerHTML = '<div id="hqSet"></div>'
          + '<div class="hq-secdiv">The questions</div>'
          + '<div id="hqQs"></div>';
        paintSettings(body.querySelector("#hqSet"), q, canM);
        paintQuestions(body.querySelector("#hqQs"), q, canM);
        var sb = main.querySelector("#hqSaveAll");
        if (sb) sb.onclick = async function () {
          try {
            var qp = HOOKS.questions ? HOOKS.questions() : null;   // throws on a bad form
            var sp = HOOKS.settings ? HOOKS.settings() : null;
            if (sp) await post(sp);
            if (qp) await post({ action: "save_questions", id: q.id, questions: qp });
            S.dirty = false; toast("Saved"); go();
          } catch (e) { toast(e.message, true); }
        };
      }
      else if (S.qtab === "submissions") await paintSubmissions(body, canR);
      else if (S.qtab === "results") await paintResults(body);
    }

    /* ================================================================ questions editor */
    var TYPE_LABEL = { stars5: "Rating 1–5", scale: "Linear scale",
                       single: "Single choice", multi: "Multiple choice",
                       dropdown: "Dropdown", short_text: "Short text",
                       long_text: "Long text", section: "Section header" };
    var TYPE_META = { stars5: { ic: "★", hint: "Five stars" },
                      scale: { ic: "⟷", hint: "Numbers with end labels" },
                      single: { ic: "◉", hint: "Pick one" },
                      multi: { ic: "☑", hint: "Pick several" },
                      dropdown: { ic: "▾", hint: "Pick one from a list" },
                      short_text: { ic: "–", hint: "One line" },
                      long_text: { ic: "≡", hint: "Free writing" },
                      section: { ic: "§", hint: "A heading that groups the questions under it" } };
    var OTH = "Other…";
    var CHOICE_T = { single: 1, multi: 1, dropdown: 1 };
    function slugify(label, taken) {
      var base = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "").slice(0, 32) || "q";
      if (!/^[a-z]/.test(base)) base = "q_" + base;
      while (base.length < 3) base += "_q";      // the server requires 3-40 chars
      var k = base, i = 2;
      while (taken.has(k)) k = (base.slice(0, 29) + "_" + i++);
      return k;
    }
    function paintQuestions(body, q, canM) {
      var locked = q.status !== "draft" || !canM;
      if (!S.draft || S.draftFor !== q.id) {
        S.draft = q.questions.filter(function (x) { return x.active; }).map(function (x) {
          return { qkey: x.qkey, label: x.label, description: x.description || "",
                   qtype: x.qtype, options: (x.options || []).slice(), required: x.required,
                   i18n: x.i18n ? JSON.parse(JSON.stringify(x.i18n)) : null };
        });
        S.draftFor = q.id; S.dirty = false; S.qFocus = null;
      }
      var d = S.draft;
      var sy = window.scrollY;      // a repaint must not teleport the page

      var html = locked
        ? '<div class="hq-dim" style="margin-bottom:12px">Questions are locked on a '
          + esc(q.status) + " questionnaire — answers already point at these exact words. "
          + (canM ? "Use <b>New version</b> to change them going forward. " : "")
          + "Click a question to read all of it.</div>"
        : '<div class="hq-dim" style="margin-bottom:12px">Click a question to edit it, drag '
          + "the ⠿ handle to move it, hover between questions to insert one right there. "
          + "Everything saves with the one <b>Save</b> button on top.</div>";

      var ins = function (at) {
        return locked ? "" : '<div class="hq-ins" data-ins="' + at
          + '"><i></i><span>+ insert here</span><i></i></div>';
      };

      var qn = 0;
      html += d.map(function (item, i) {
        var sect = item.qtype === "section";
        if (!sect) qn += 1;
        var myn = qn;
        var row;
        if (i === S.qFocus) {
          // ---------- the ONE expanded, editable card ----------
          var dis = locked ? " disabled" : "";
          var kaAll = (item.i18n && item.i18n.ka) || {};
          var pair = function (enHtml, kaHtml) {
            return '<div>' + enHtml + "</div><div>" + kaHtml + "</div>";
          };
          var grid = '<div class="hq-grid"><div class="h">English</div><div class="h ka">ქართული</div>'
            + pair('<input class="hq-fld lbl" data-f="label" value="' + esc(item.label) + '" placeholder="'
                     + (sect ? "Name this section…" : "Write the question…") + '"' + dis + ">",
                   '<input class="hq-fld bx" data-f="ka_label" value="' + esc(kaAll.label || "")
                     + '" placeholder="' + (sect ? "სექციის სათაური…" : "კითხვა ქართულად…") + '"' + dis + ">")
            + pair('<input class="hq-fld dsc" data-f="description" value="' + esc(item.description)
                     + '" placeholder="Help text (optional)…"' + dis + ">",
                   '<input class="hq-fld bx" data-f="ka_description" value="' + esc(kaAll.description || "")
                     + '" placeholder="დამატებითი ტექსტი (არასავალდებულო)…"' + dis + ">");

          if (CHOICE_T[item.qtype]) {
            // EVERY CHOICE IS ITS OWN FIELD, with its translation beside it — no more
            // "one choice per line" textarea to keep in sync by counting rows.
            var lines = (item.options || []).filter(function (o) { return o !== OTH; });
            var hasOth = (item.options || []).indexOf(OTH) >= 0;
            grid += '<div class="sp"></div>';
            lines.forEach(function (o, oi) {
              grid += pair('<div class="hq-opt"><span class="n">' + (oi + 1) + '</span>'
                             + '<input class="hq-fld bx" data-f="opt" data-oi="' + oi + '" value="' + esc(o)
                             + '" placeholder="Choice…"' + dis + ">"
                             + (locked ? "" : '<button class="hq-ox" data-optrm="' + oi + '" title="Remove this choice">✕</button>')
                             + "</div>",
                           '<input class="hq-fld bx" data-f="kaopt" data-oi="' + oi + '" value="'
                             + esc((kaAll.opt && kaAll.opt[o]) || "") + '" placeholder="პასუხი ქართულად…"' + dis + ">");
            });
            if (!locked)
              grid += '<div class="full"><button class="hq-add" data-optadd>+ add choice</button></div>';
            grid += pair('<label class="hq-reqt" title="Adds an Other… choice where people type their own answer">'
                           + '<input type="checkbox" data-f="oth"' + (hasOth ? " checked" : "") + dis + ">"
                           + '<span class="hq-tgl"></span><span class="rt">allow “Other…”</span></label>',
                         hasOth ? '<input class="hq-fld bx" data-f="ka_other" value="' + esc(kaAll.other || "")
                                    + '" placeholder="„სხვა…“ ქართულად"' + dis + ">" : "<span></span>");
          } else if (item.qtype === "scale") {
            var so = item.options || [];
            var lo = parseInt(so[0], 10); if (isNaN(lo)) lo = 1;
            var hi = parseInt(so[1], 10); if (isNaN(hi)) hi = 5;
            var selN = function (f2, val, from, to) {
              var s2 = '<select class="hq-sel" data-f="' + f2 + '"' + dis + ">";
              for (var n2 = from; n2 <= to; n2++)
                s2 += '<option value="' + n2 + '"' + (n2 === val ? " selected" : "") + ">" + n2 + "</option>";
              return s2 + "</select>";
            };
            grid += '<div class="sp"></div>'
              + '<div class="full" style="font-size:13px;color:var(--muted)">From ' + selN("sc_lo", lo, 0, 1)
              + " to " + selN("sc_hi", hi, 2, 10) + "</div>"
              + pair('<input class="hq-fld bx" data-f="sc_l1" value="' + esc(so[2] || "") + '" placeholder="Label for the low end…"' + dis + ">",
                     '<input class="hq-fld bx" data-f="ka_lo" value="' + esc(kaAll.lo || "") + '" placeholder="დაბალი ბოლოს წარწერა…"' + dis + ">")
              + pair('<input class="hq-fld bx" data-f="sc_l2" value="' + esc(so[3] || "") + '" placeholder="Label for the high end…"' + dis + ">",
                     '<input class="hq-fld bx" data-f="ka_hi" value="' + esc(kaAll.hi || "") + '" placeholder="მაღალი ბოლოს წარწერა…"' + dis + ">");
          }
          grid += "</div>";

          row = '<div class="hq-ed on' + (sect ? " sect" : "") + '" data-i="' + i + '"><div class="top">'
            + (sect ? '<span class="num" style="background:var(--brand-glow);color:var(--brand)">§</span>'
                    : '<span class="num">' + myn + "</span>")
            + '<span style="flex:1"></span>'
            + (locked
                ? '<span class="hq-ddb" style="cursor:default;opacity:.75"><span class="ic">'
                  + TYPE_META[item.qtype].ic + "</span>" + TYPE_LABEL[item.qtype] + "</span>"
                : '<div class="hq-dd" data-dd="' + i + '"><button type="button" class="hq-ddb">'
                  + '<span class="ic">' + TYPE_META[item.qtype].ic + "</span>" + TYPE_LABEL[item.qtype]
                  + '<span class="car">▼</span></button></div>')
            + (sect ? "" : '<label class="hq-reqt" title="Must be answered before submitting">'
                + '<input type="checkbox" data-f="required"' + (item.required ? " checked" : "") + dis + ">"
                + '<span class="hq-tgl"></span><span class="rt">required</span></label>')
            + (locked ? "" : '<button class="hq-x" data-dup title="Duplicate" style="font-size:13px">⧉</button>'
                + '<button class="hq-x" data-rm title="Remove">✕</button>')
            + "</div>"
            + grid
            + "</div>";
        } else {
          // ---------- a compact, scannable row ----------
          var lbl = item.label ? esc(item.label) : (sect ? "Untitled section" : "Untitled question");
          row = '<div class="hq-qr' + (sect ? " sect2" : "") + '" data-row="' + i + '">'
            + (locked ? "" : '<span class="hq-grip" title="Drag to reorder">⠿</span>')
            + (sect ? '<span class="num" style="background:var(--brand-glow);color:var(--brand)">§</span>'
                    : '<span class="num">' + myn + "</span>")
            + '<span class="lb' + (item.label ? "" : " em") + '">' + lbl + "</span>"
            + (sect ? "" : '<span class="ty"><span class="ic">' + TYPE_META[item.qtype].ic + "</span>"
                + TYPE_LABEL[item.qtype] + "</span>")
            + (!sect && item.required ? '<span class="rq" title="Required"></span>' : "")
            + "</div>";
        }
        return ins(i) + row;
      }).join("") + ins(d.length);

      if (!locked) {
        var nQ = d.filter(function (x) { return x.qtype !== "section"; }).length;
        html += '<div class="hq-stickybar"><button class="hq-btn" id="hqAdd">+ Add a question</button>'
          + '<button class="hq-btn" id="hqAddSec">+ Add a section</button>'
          + '<span class="hq-dim">' + nQ + " question" + (nQ === 1 ? "" : "s")
          + ' · <span id="hqDirty">' + (S.dirty ? "unsaved changes" : "saved") + "</span></span>"
          + '<span style="flex:1"></span>'
          + '<span class="hq-dim">the Save button on top saves everything at once</span></div>';
      }
      body.innerHTML = html;
      window.scrollTo(0, sy);

      var focusLbl = function () {
        var el = body.querySelector('.hq-ed[data-i="' + S.qFocus + '"] .lbl');
        if (el) {
          el.focus({ preventScroll: true });
          el.closest(".hq-ed").scrollIntoView({ block: "nearest" });
        }
      };

      // compact rows expand on click
      body.querySelectorAll(".hq-qr").forEach(function (row) {
        row.onclick = function (e) {
          if (e.target.classList.contains("hq-grip")) return;
          S.qFocus = +row.dataset.row;
          paintQuestions(body, q, canM);
          focusLbl();
        };
      });

      if (locked) {
        var mark0 = null; // nothing below applies
        return;
      }
      var mark = function () { S.dirty = true; var el = body.querySelector("#hqDirty"); if (el) el.textContent = "unsaved changes"; };

      var insertAt = function (at, item) {
        d.splice(at, 0, item);
        S.qFocus = at; mark(); paintQuestions(body, q, canM); focusLbl();
      };
      body.querySelectorAll("[data-ins]").forEach(function (z) {
        z.onclick = function () {
          insertAt(+z.dataset.ins,
            { qkey: null, label: "", description: "", qtype: "stars5", options: [], required: false });
        };
      });

      // ---- the expanded card's inputs ----
      body.querySelectorAll(".hq-ed").forEach(function (row) {
        var i = +row.dataset.i;
        row.querySelectorAll("[data-f]").forEach(function (inp) {
          var f = inp.dataset.f;
          var syncOpts = function () {
            // one input per choice now; blanks are kept while typing so a half-typed
            // choice does not vanish under the cursor, and dropped on save/repaint
            var ot = row.querySelector('[data-f="oth"]');
            var lines2 = [];
            row.querySelectorAll('[data-f="opt"]').forEach(function (el2) {
              lines2.push(el2.value.trim());
            });
            lines2 = lines2.filter(function (o) { return o && o !== OTH; });
            if (ot && ot.checked) lines2.push(OTH);
            d[i].options = lines2;
          };
          var syncScale = function () {
            var gv = function (f2) { var el2 = row.querySelector('[data-f="' + f2 + '"]'); return el2 ? el2.value : ""; };
            d[i].options = [gv("sc_lo") || "1", gv("sc_hi") || "5",
                            gv("sc_l1").trim(), gv("sc_l2").trim()];
          };
          // the Georgian side writes into item.i18n.ka; an emptied field removes its key,
          // and an emptied block removes the language, so "no translation" stays truly absent
          var syncKa = function () {
            var ka = {};
            var gv = function (f2) {
              var el2 = row.querySelector('[data-f="' + f2 + '"]');
              return el2 ? el2.value.trim() : "";
            };
            if (gv("ka_label")) ka.label = gv("ka_label");
            if (gv("ka_description")) ka.description = gv("ka_description");
            if (gv("ka_lo")) ka.lo = gv("ka_lo");
            if (gv("ka_hi")) ka.hi = gv("ka_hi");
            if (gv("ka_other")) ka.other = gv("ka_other");
            // each Georgian choice sits beside its English one, so they pair by POSITION
            // in the DOM and are stored keyed by the English text (unchanged contract:
            // reordering can never re-point a translation)
            var eng = [], kal = [];
            row.querySelectorAll('[data-f="opt"]').forEach(function (el2) { eng.push(el2.value.trim()); });
            row.querySelectorAll('[data-f="kaopt"]').forEach(function (el2) { kal.push(el2.value.trim()); });
            if (eng.length) {
              var opt = {};
              eng.forEach(function (o, oi) { if (o && kal[oi]) opt[o] = kal[oi]; });
              if (Object.keys(opt).length) ka.opt = opt;
            }
            d[i].i18n = Object.keys(ka).length ? { ka: ka } : null;
          };
          inp.oninput = function () {
            if (f.indexOf("ka_") === 0) syncKa();
            else if (f === "opt" || f === "kaopt" || f === "oth") { syncOpts(); syncKa(); }
            else if (f.indexOf("sc_") === 0) syncScale();
            else if (f === "required") d[i].required = inp.checked;
            else d[i][f] = inp.value;
            mark();
          };
          if (f === "oth" || f === "sc_lo" || f === "sc_hi")
            inp.onchange = function () {
              if (f === "oth") syncOpts(); else syncScale();
              mark();
            };
        });
        var addb = row.querySelector("[data-optadd]");
        if (addb) addb.onclick = function () {
          var opts = (d[i].options || []).slice();
          var oth = opts.indexOf(OTH) >= 0;
          opts = opts.filter(function (o) { return o !== OTH; });
          opts.push("");
          if (oth) opts.push(OTH);
          d[i].options = opts;
          mark(); paintQuestions(body, q, canM);
          var ins = document.querySelectorAll('.hq-ed.on [data-f="opt"]');
          if (ins.length) ins[ins.length - 1].focus();
        };
        row.querySelectorAll("[data-optrm]").forEach(function (b2) {
          b2.onclick = function () {
            var oi = +b2.dataset.optrm;
            var opts = (d[i].options || []).filter(function (o) { return o !== OTH; });
            var gone = opts[oi];
            var oth = (d[i].options || []).indexOf(OTH) >= 0;
            opts.splice(oi, 1);
            if (oth) opts.push(OTH);
            d[i].options = opts;
            // drop the orphaned translation with it
            if (gone && d[i].i18n && d[i].i18n.ka && d[i].i18n.ka.opt) delete d[i].i18n.ka.opt[gone];
            mark(); paintQuestions(body, q, canM);
          };
        });
        var rm = row.querySelector("[data-rm]");
        if (rm) rm.onclick = function () {
          d.splice(i, 1); S.qFocus = null; mark(); paintQuestions(body, q, canM);
        };
        var dup = row.querySelector("[data-dup]");
        if (dup) dup.onclick = function () {
          insertAt(i + 1, { qkey: null, label: d[i].label, description: d[i].description,
                            qtype: d[i].qtype, options: (d[i].options || []).slice(),
                            required: d[i].required,
                            i18n: d[i].i18n ? JSON.parse(JSON.stringify(d[i].i18n)) : null });
        };
      });

      // ---- the type picker menu ----
      body.querySelectorAll(".hq-dd").forEach(function (dd) {
        var i2 = +dd.dataset.dd;
        dd.querySelector(".hq-ddb").onclick = function (e) {
          e.stopPropagation();
          var already = dd.querySelector(".hq-ddm");
          document.querySelectorAll(".hq-ddm").forEach(function (m) { m.remove(); });
          if (already) return;
          var m = document.createElement("div");
          m.className = "hq-ddm";
          m.innerHTML = Object.keys(TYPE_LABEL).map(function (t) {
            return (t === "section" ? '<div class="hq-ddsep"></div>' : "")
              + '<div class="hq-ddi' + (d[i2].qtype === t ? " on" : "") + '" data-t="' + t + '">'
              + '<span class="ic">' + TYPE_META[t].ic + "</span><div><b>" + TYPE_LABEL[t]
              + "</b><em>" + TYPE_META[t].hint + "</em></div></div>";
          }).join("");
          dd.appendChild(m);
          m.querySelectorAll(".hq-ddi").forEach(function (it) {
            it.onclick = function (ev) {
              ev.stopPropagation();
              var t = it.dataset.t;
              m.remove();
              if (t === d[i2].qtype) return;
              d[i2].qtype = t;
              if (t === "scale") d[i2].options = ["1", "5", "", ""];
              else if (t === "section") { d[i2].options = []; d[i2].required = false; }
              else if (!CHOICE_T[t]) d[i2].options = [];
              mark(); paintQuestions(body, q, canM); focusLbl();
            };
          });
        };
      });
      if (!document.__hqDdCloser) {
        document.__hqDdCloser = true;
        document.addEventListener("click", function () {
          document.querySelectorAll(".hq-ddm").forEach(function (m) { m.remove(); });
        });
      }

      // ---- drag to reorder (grab the ⠿, drop above/below any row) ----
      var dragI = null, dropAt = null;
      var clearMarks = function () {
        body.querySelectorAll(".hq-drop-a,.hq-drop-b").forEach(function (r) {
          r.classList.remove("hq-drop-a", "hq-drop-b");
        });
      };
      body.querySelectorAll(".hq-qr").forEach(function (row) {
        var grip = row.querySelector(".hq-grip");
        if (!grip) return;
        grip.onmousedown = function () { row.draggable = true; };
        row.ondragstart = function (e) {
          dragI = +row.dataset.row; e.dataTransfer.effectAllowed = "move";
          row.style.opacity = ".45";
        };
        row.ondragend = function () {
          row.draggable = false; row.style.opacity = ""; clearMarks(); dragI = null;
        };
      });
      body.querySelectorAll(".hq-qr,.hq-ed").forEach(function (row) {
        row.ondragover = function (e) {
          if (dragI == null) return;
          e.preventDefault();
          var r = row.getBoundingClientRect();
          var before = e.clientY < r.top + r.height / 2;
          clearMarks();
          row.classList.add(before ? "hq-drop-a" : "hq-drop-b");
          dropAt = { i: +(row.dataset.row != null ? row.dataset.row : row.dataset.i), before: before };
        };
        row.ondrop = function (e) {
          e.preventDefault();
          if (dragI == null || !dropAt) return;
          var to = dropAt.i + (dropAt.before ? 0 : 1);
          if (dragI < to) to--;
          if (to !== dragI) {
            var it = d.splice(dragI, 1)[0];
            d.splice(to, 0, it);
            S.qFocus = null; mark();
          }
          dragI = null; dropAt = null;
          paintQuestions(body, q, canM);
        };
      });

      body.querySelector("#hqAdd").onclick = function () {
        insertAt(d.length, { qkey: null, label: "", description: "", qtype: "stars5", options: [], required: false });
      };
      body.querySelector("#hqAddSec").onclick = function () {
        insertAt(d.length, { qkey: null, label: "", description: "", qtype: "section", options: [], required: false });
      };

      HOOKS.questions = function () {
        if (!d.length) return null;                    // a fresh draft: nothing to save yet
        // `taken` must include RETIRED server-side keys too (q.questions has them all):
        // reusing a retired key would resurrect that question's history under a new label
        var taken = new Set(d.filter(function (x) { return x.qkey; }).map(function (x) { return x.qkey; }));
        (q.questions || []).forEach(function (x) { taken.add(x.qkey); });
        var payload = d.map(function (x) {
          if (!x.qkey) { x.qkey = slugify(x.label, taken); taken.add(x.qkey); }
          return { qkey: x.qkey, label: x.label, description: x.description,
                   qtype: x.qtype, options: x.options, required: x.required,
                   i18n: x.i18n || null };
        });
        for (var pi = 0; pi < payload.length; pi++) {
          if (!payload[pi].label.trim()) throw new Error("Question " + (pi + 1) + " needs a label");
          if (CHOICE_T[payload[pi].qtype]
              && (payload[pi].options || []).filter(Boolean).length < 2)
            throw new Error("'" + payload[pi].label.slice(0, 40) + "' needs at least 2 choices");
          if (payload[pi].qtype === "scale") {
            var slo = parseInt((payload[pi].options || [])[0], 10);
            var shi = parseInt((payload[pi].options || [])[1], 10);
            if (isNaN(slo) || isNaN(shi) || slo >= shi)
              throw new Error("'" + payload[pi].label.slice(0, 40) + "': the scale must run low to high");
          }
        }
        return payload;
      };
    }

    /* ================================================================ settings */
    function paintSettings(body, q, canM) {
      var draft = q.status === "draft";
      var lockNote = !canM ? "You can look, but changing settings needs manage access."
        : draft ? ""
        : q.status === "published" ? "Published: only the Active switch and the audience can change — the words people answer under are locked."
        : "A " + q.status + " questionnaire is read-only.";
      // draft: everything editable; published: only the `also` field (the audience);
      // closed/archived: NOTHING — the old test left those controls live and the server
      // 409'd only after the user had already edited (post-merge audit, 2026-08-17)
      var dis = function (also) { return (!canM || !(draft || (q.status === "published" && also))) ? " disabled" : ""; };
      var depts = {};
      (S.roster || []).forEach(function (p) { if (p.department && p.status === "active") depts[p.department] = 1; });
      var kaW = (q.i18n && q.i18n.ka) || {};
      var audSig = function (k, arr) { return k + "|" + arr.slice().sort().join(","); };
      var aud0 = audSig(q.audience_kind, (q.audience_values || []).map(function (v) { return String(v).toLowerCase(); }));
      body.innerHTML =
        (lockNote ? '<div class="hq-dim" style="margin-bottom:12px">' + esc(lockNote) + "</div>" : "")
        + '<div class="hq-card" style="padding:20px 24px"><h4 class="eyebrow">Wording</h4>'
        + '<div class="hq-wgrid">'
        + '<div class="hq-field full"><label class="hq-lab">Title</label><input class="hq-fld bx" style="width:100%;font-size:17.5px;font-weight:750" id="hsTitle" value="' + esc(q.title) + '"' + dis() + "></div>"
        + '<div class="hq-field"><label class="hq-lab">Description (shown on the card)</label><textarea class="hq-flda bx" id="hsDesc"' + dis() + ">" + esc(q.description || "") + "</textarea></div>"
        + '<div class="hq-field"><label class="hq-lab">Instructions (shown above the questions)</label><textarea class="hq-flda bx" id="hsInstr"' + dis() + ">" + esc(q.instructions || "") + "</textarea></div>"
        + '<div class="hq-field full"><label class="hq-lab">Confidentiality note (always visible to the employee)</label><textarea class="hq-flda bx" id="hsConf"' + dis() + ">" + esc(q.confidentiality || "") + "</textarea></div>"
        + '<div class="hq-field full"><div class="hq-kaw"><div class="hq-lab" style="color:var(--brand)">ქართული — the wording the team reads by default</div>'
        + '<input class="hq-fld bx" style="width:100%;font-size:16px;font-weight:750;margin-top:6px" id="hsKaTitle" value="' + esc(kaW.title || "") + '" placeholder="სათაური ქართულად…"' + dis() + ">"
        + '<textarea class="hq-flda bx" style="margin-top:7px" id="hsKaDesc" placeholder="აღწერა (ბარათზე ჩანს)…"' + dis() + ">" + esc(kaW.description || "") + "</textarea>"
        + '<textarea class="hq-flda bx" style="margin-top:7px" id="hsKaInstr" placeholder="ინსტრუქცია (კითხვების ზემოთ)…"' + dis() + ">" + esc(kaW.instructions || "") + "</textarea>"
        + '<textarea class="hq-flda bx" style="margin-top:7px" id="hsKaConf" placeholder="კონფიდენციალურობის შენიშვნა…"' + dis() + ">" + esc(kaW.confidentiality || "") + "</textarea>"
        + "</div></div>"
        + "</div></div>"
        + '<div class="hq-card" style="padding:20px 24px"><h4 class="eyebrow">Status</h4>'
        + (q.status === "draft"
            ? '<div class="hq-dim">Not active yet — it goes live for everyone the moment you press <b>Finalize &amp; send</b>.</div>'
          : q.status === "published" || q.status === "closed"
            ? '<label class="hq-reqt" style="gap:11px"><input type="checkbox" id="hsActive"'
              + (q.status === "published" ? " checked" : "") + (canM ? "" : " disabled") + ">"
              + '<span class="hq-tgl big"></span><span class="rt" style="font-size:13.5px">'
              + (q.status === "published"
                  ? "Active — people can open it and submit"
                  : "Not active — nobody can submit; every answer is kept") + "</span></label>"
            : '<div class="hq-dim">Archived — hidden from everyone.</div>')
        + "</div>"
        + '<div class="hq-card" style="padding:20px 24px"><h4 class="eyebrow">Who receives it</h4>'
        + '<div class="hq-dim" style="margin-bottom:10px">People and departments come from the '
        + '<a href="#page=hr-directory" style="color:var(--brand);font-weight:700">Team Directory</a> — '
        + "add or move someone there and this list follows.</div>"
        + '<div class="hq-audsel">'
        + ["all", "departments", "emails", "anon_depts"].map(function (k) {
            var nAll = (S.roster || []).filter(function (p2) { return p2.status === "active"; }).length;
            var sub = { all: "All " + nAll + " people — office and crew alike",
                        departments: "Whole teams at once",
                        emails: "Hand-pick specific people, one by one",
                        anon_depts: "Nobody's name is recorded — every team gets its own link" }[k];
            return '<label class="hq-audopt' + (q.audience_kind === k ? " on" : "") + '">'
              + '<input type="radio" name="hsAud" value="' + k + '"'
              + (q.audience_kind === k ? " checked" : "") + dis(true) + ">"
              + "<b>" + { all: "Everyone on the People list", departments: "Chosen departments",
                          emails: "Chosen people",
                          anon_depts: "Anonymous by department" }[k] + "</b>"
              + "<span>" + sub + '</span><span class="tick">✓</span></label>';
          }).join("")
        + "</div>"
        + '<div id="hsAudVals"></div></div>';
      function paintAudVals() {
        var kind = (body.querySelector('input[name="hsAud"]:checked') || {}).value || q.audience_kind;
        var el = body.querySelector("#hsAudVals");
        if (kind === "all") { el.innerHTML = ""; return; }
        var picked = new Set((q.audience_values || []).map(function (v) { return v.toLowerCase(); }));
        var nByDept = {};
        (S.roster || []).forEach(function (p) {
          if (p.status === "active" && p.department) nByDept[p.department] = (nByDept[p.department] || 0) + 1;
        });
        var locked2 = !!dis(true);

        if (kind === "anon_depts") {
          // ANONYMOUS BY DEPARTMENT (his calls 2026-08-17): every active person with an
          // email starts in their team; one team expands at a time, ✕ leaves a person
          // out, "Move someone into this team" pulls them across. Each team gets its
          // own anonymous link — the link carries the TEAM, never the person.
          var CATS = ["Helpers", "Drivers", "Foremen", "Sales Representatives",
                      "Support Team", "Other"];
          var defCat = function (p2) {
            var d2 = p2.department || "";
            if (d2 === "Helpers" || d2 === "Drivers" || d2 === "Foremen") return d2;
            if (d2 === "Sales") return "Sales Representatives";
            if (d2 === "Customer Service") return "Support Team";
            return "Other";
          };
          var people2 = (S.roster || []).filter(function (p2) {
            return p2.status === "active" && p2.email;
          });
          if (S.anonFor !== q.id) {
            S.anonMap = {};
            var stored2 = q.audience_kind === "anon_depts" ? (q.audience_values || []) : [];
            if (stored2.length) {
              var inMap = {};
              stored2.forEach(function (v2) {
                var pp = String(v2).split("|");
                if (pp.length === 2) inMap[pp[1].toLowerCase()] = pp[0];
              });
              people2.forEach(function (p2) {
                S.anonMap[p2.email] = inMap[p2.email] || "__out__";
              });
            } else {
              people2.forEach(function (p2) { S.anonMap[p2.email] = defCat(p2); });
            }
            S.anonFor = q.id;
            S.anonOpen = null;
            S.anonAdd = null;
          }
          // an excluded person stays visible (muted) under their home team, one click away
          var homeCat = function (p2) {
            return S.anonMap[p2.email] === "__out__" ? defCat(p2) : S.anonMap[p2.email];
          };
          var recv = people2.filter(function (p2) {
            return S.anonMap[p2.email] !== "__out__";
          }).length;
          var byName = function (a2, b2) {
            return (a2.name || a2.email).localeCompare(b2.name || b2.email);
          };
          el.innerHTML = '<div class="hq-dim" style="margin-bottom:4px"><b>' + recv + " of "
            + people2.length + "</b> people will receive their team's anonymous link."
            + (locked2 ? "" : " Open a team to see the names — ✕ leaves someone out, + brings them back.")
            + "</div>"
            + CATS.map(function (cat2) {
                var mine = people2.filter(function (p2) { return homeCat(p2) === cat2; }).sort(byName);
                var nIn = mine.filter(function (p2) { return S.anonMap[p2.email] !== "__out__"; }).length;
                var nOut = mine.length - nIn;
                var open = S.anonOpen === cat2;
                return '<div class="hq-anr' + (open ? " on" : "") + '" data-cat="' + esc(cat2) + '">'
                  + '<button type="button" class="hd"><b>' + esc(cat2) + "</b>"
                  + '<span class="n">' + nIn + " receiving" + (nOut ? " · " + nOut + " out" : "") + "</span>"
                  + '<span class="ch">▾</span></button>'
                  + (!open ? "" : '<div class="bd"><div class="gr">'
                      + mine.map(function (p2) {
                          var outNow = S.anonMap[p2.email] === "__out__";
                          return '<div class="hq-anp2' + (outNow ? " off" : "") + '" data-pe="' + esc(p2.email) + '">'
                            + '<span class="dt" style="background:' + deptColor(p2.department) + '"></span>'
                            + '<span class="nm">' + esc(p2.name || p2.email) + "</span>"
                            + (p2.department && p2.department !== cat2 ? "<em>" + esc(p2.department) + "</em>" : "")
                            + (locked2 ? "" : '<button type="button" class="x" title="'
                               + (outNow ? "Include again" : "Leave out") + '">' + (outNow ? "+" : "✕") + "</button>")
                            + "</div>";
                        }).join("") + "</div>"
                      + (locked2 ? "" : '<button type="button" class="hq-anadd" data-add="' + esc(cat2)
                          + '">+ Move someone into this team…</button>'
                          + (S.anonAdd !== cat2 ? "" : '<div class="hq-anpick">'
                              + people2.filter(function (p2) { return homeCat(p2) !== cat2; }).sort(byName)
                                  .map(function (p2) {
                                    return '<button type="button" class="pk" data-pk="' + esc(p2.email) + '">'
                                      + esc(p2.name || p2.email) + "<em>" + esc(homeCat(p2)) + "</em></button>";
                                  }).join("") + "</div>"))
                      + "</div>")
                  + "</div>";
              }).join("")
            + '<div id="hqAnLinks" style="margin-top:14px"></div>';
          el.querySelectorAll(".hq-anr > .hd").forEach(function (hd2) {
            hd2.onclick = function () {
              var c3 = hd2.parentElement.dataset.cat;
              S.anonOpen = S.anonOpen === c3 ? null : c3;
              S.anonAdd = null;
              paintAudVals();
            };
          });
          if (!locked2) {
            el.querySelectorAll(".hq-anp2 .x").forEach(function (bx) {
              bx.onclick = function () {
                var row2 = bx.closest(".hq-anp2");
                var cat3 = row2.closest(".hq-anr").dataset.cat;
                var em3 = row2.dataset.pe;
                S.anonMap[em3] = S.anonMap[em3] === "__out__" ? cat3 : "__out__";
                markDirty(); paintAudVals();
              };
            });
            el.querySelectorAll(".hq-anadd").forEach(function (ba) {
              ba.onclick = function () {
                S.anonAdd = S.anonAdd === ba.dataset.add ? null : ba.dataset.add;
                paintAudVals();
              };
            });
            el.querySelectorAll(".hq-anpick .pk").forEach(function (pk) {
              pk.onclick = function () {
                S.anonMap[pk.dataset.pk] = S.anonAdd;
                markDirty(); paintAudVals();
              };
            });
          }
          // the team links, live from the bridge (minted on demand; the public page
          // refuses drafts, so showing them early is safe)
          if (canM) {
            api("/api/_hrqadmin?view=anonlinks&id=" + q.id).then(function (lk) {
              var host2 = el.querySelector("#hqAnLinks");
              if (!host2 || !lk.links || !lk.links.length) return;
              host2.innerHTML = '<div class="hq-dim" style="margin-bottom:7px;font-weight:800;'
                + 'letter-spacing:.05em;text-transform:uppercase;font-size:10.5px">The team links'
                + (q.status !== "published" ? " · live once you finalize" : "") + "</div>"
                + lk.links.map(function (l2) {
                    return '<div class="hq-anlk"><b>' + esc(l2.category) + "</b>"
                      + "<code>" + esc(l2.url) + "</code>"
                      + '<span class="hq-dim">' + l2.people + "</span>"
                      + '<button class="hq-btn" data-cp="' + esc(l2.url) + '">Copy</button></div>';
                  }).join("");
              host2.querySelectorAll("[data-cp]").forEach(function (b2) {
                b2.onclick = function () {
                  navigator.clipboard.writeText(b2.dataset.cp).then(function () {
                    b2.textContent = "Copied"; setTimeout(function () { b2.textContent = "Copy"; }, 1400);
                  });
                };
              });
            }).catch(function () {});
          }
          return;
        }

        if (kind === "emails") {
          // HAND-PICKED PEOPLE (his design, 2026-08-18): chosen ones sit above as tags,
          // the picker below shows ONLY who is not yet added — pick someone and they
          // leave the list. State survives repaints per questionnaire.
          if (S.audSelFor !== q.id) {
            S.audSel = new Set((q.audience_values || []).map(function (v) { return String(v).toLowerCase(); }));
            S.audSelFor = q.id; S.pplQ = "";
          }
          var byEmail = {};
          (S.roster || []).forEach(function (p) { if (p.email) byEmail[p.email] = p; });
          var tags = Array.from(S.audSel).sort().map(function (em3) {
            var per = byEmail[em3];
            return '<span class="hq-tag"><span>' + esc(per ? per.name || em3 : em3)
              + (per && per.department ? " <em>· " + esc(per.department) + "</em>"
                 : (per ? "" : " <em>· no longer on the list</em>")) + "</span>"
              + '<input type="checkbox" data-aud="' + esc(em3) + '" checked hidden>'
              + (locked2 ? "" : '<button data-rme="' + esc(em3) + '" title="Remove">✕</button>')
              + "</span>";
          }).join("");
          var q3 = (S.pplQ || "").toLowerCase();
          var pool = (S.roster || []).filter(function (p) {
            if (p.status !== "active" || !p.email || S.audSel.has(p.email)) return false;
            if (!q3) return true;
            return [p.name, p.email, p.department, p.alias].some(function (v) {
              return String(v || "").toLowerCase().indexOf(q3) >= 0;
            });
          }).slice(0, 30);
          el.innerHTML =
            '<div class="hq-tags">' + (tags || '<span class="hq-dim">Nobody picked yet — find people below and click to add them.</span>') + "</div>"
            + (locked2 ? "" :
              '<div class="hq-ppl"><input id="hqPplQ" placeholder="Find a person to add — name, team or email…" value="' + esc(S.pplQ || "") + '">'
              + '<div class="ls">' + (pool.map(function (p) {
                  return '<div class="pp" data-add="' + esc(p.email) + '">'
                    + '<span class="dot" style="background:' + deptColor(p.department) + '"></span>'
                    + "<b>" + esc(p.name || p.email) + "</b>"
                    + '<span class="hq-dim">' + esc(p.title || "") + "</span>"
                    + "<em>" + esc(p.department || "") + "</em></div>";
                }).join("") || '<div class="hq-dim" style="padding:11px 14px">'
                  + (q3 ? "Nobody matches — or they are already added." : "Everyone with an email is already added.") + "</div>")
              + "</div></div>");
          if (!locked2) {
            var pq = el.querySelector("#hqPplQ");
            pq.oninput = function () {
              S.pplQ = this.value; var at = this.selectionStart;
              paintAudVals();
              var n = el.querySelector("#hqPplQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
            };
            el.querySelectorAll("[data-add]").forEach(function (row) {
              row.onclick = function () { S.audSel.add(row.dataset.add); markDirty(); paintAudVals(); };
            });
            el.querySelectorAll("[data-rme]").forEach(function (b) {
              b.onclick = function () { S.audSel.delete(b.dataset.rme); markDirty(); paintAudVals(); };
            });
          }
          return;
        }

        var items = Object.keys(depts).sort().map(function (dpt) {
          return { v: dpt.toLowerCase(), lab: dpt + " · " + (nByDept[dpt] || 0) + " people" };
        });
        // stored audience members who are no longer active must stay VISIBLE and KEPT —
        // rendering only active rows made any settings save silently shrink the audience
        var known = new Set(items.map(function (it) { return it.v; }));
        picked.forEach(function (v) {
          if (!known.has(v)) items.push({ v: v, lab: v + " · no longer active on the People list" });
        });
        el.innerHTML = items.length
          ? '<div class="hq-chipgrid">' + items.map(function (it) {
              var parts = it.lab.split(" · ");
              return '<label class="hq-chip' + (picked.has(it.v) ? " on" : "") + (locked2 ? " dis" : "") + '">'
                + '<input type="checkbox" data-aud="' + esc(it.v) + '"'
                + (picked.has(it.v) ? " checked" : "") + dis(true) + ">"
                + '<span class="dot" style="background:' + deptColor(parts[0]) + '"></span>'
                + "<b>" + esc(parts[0]) + "</b>"
                + (parts[1] ? "<em>" + esc(parts[1]) + "</em>" : "")
                + '<span class="tick">✓</span></label>';
            }).join("") + "</div>"
          : '<div class="hq-dim">' + (kind === "departments"
              ? "No departments yet — add people on the Team Directory first."
              : "The People list is empty.") + "</div>";
        el.querySelectorAll(".hq-chip input").forEach(function (cb) {
          cb.onchange = function () { cb.closest(".hq-chip").classList.toggle("on", cb.checked); markDirty(); };
        });
      }
      paintAudVals();
      body.querySelectorAll('input[name="hsAud"]').forEach(function (r) {
        r.onchange = function () {
          body.querySelectorAll(".hq-audopt").forEach(function (c) {
            c.classList.toggle("on", c.querySelector("input").checked);
          });
          markDirty();
          paintAudVals();
        };
      });
      var act = body.querySelector("#hsActive");
      if (act) act.onchange = async function () {
        var on = act.checked;
        if (!(await hqConfirm(on
            ? { t: "Switch it back on?", b: "People will be able to open it and submit again.",
                yes: "Make it active" }
            : { t: "Deactivate?", b: "Nobody will be able to submit until you switch it back on. "
                + "Every answer already given is kept.", yes: "Deactivate", danger: true }))) {
          act.checked = !on; return;
        }
        try {
          await post({ action: on ? "activate" : "close", id: q.id });
          toast(on ? "Active — open for answers" : "Deactivated");
          go();
        } catch (e) { act.checked = !on; toast(e.message, true); }
      };
      // settings edits feed the ONE Save button on top; typing marks the page dirty
      ["hsTitle", "hsDesc", "hsInstr", "hsConf"].forEach(function (id2) {
        var el2 = body.querySelector("#" + id2);
        if (el2 && !el2.disabled) el2.addEventListener("input", markDirty);
      });
      HOOKS.settings = !canM ? null : function () {
        var kind = (body.querySelector('input[name="hsAud"]:checked') || {}).value || q.audience_kind;
        var vals;
        if (kind === "anon_depts") {
          vals = [];
          Object.keys(S.anonMap || {}).forEach(function (em4) {
            if (S.anonMap[em4] && S.anonMap[em4] !== "__out__")
              vals.push(S.anonMap[em4] + "|" + em4);
          });
        } else {
          vals = [].map.call(body.querySelectorAll("[data-aud]:checked"), function (c) { return c.dataset.aud; });
        }
        var payload = { action: "update_meta", id: q.id };
        // audience travels ONLY when it actually changed — a wording-only save must
        // never re-state (and thereby reshape) the audience as a side effect
        if (audSig(kind, vals.map(function (v) { return String(v).toLowerCase(); })) !== aud0) {
          payload.audience_kind = kind; payload.audience_values = vals;
        }
        if (q.status === "draft") {
          var kaV = {};
          [["title", "#hsKaTitle"], ["description", "#hsKaDesc"],
           ["instructions", "#hsKaInstr"], ["confidentiality", "#hsKaConf"]].forEach(function (pr) {
            var el3 = body.querySelector(pr[1]);
            var v3 = el3 ? el3.value.trim() : "";
            if (v3) kaV[pr[0]] = v3;
          });
          Object.assign(payload, {
            title: body.querySelector("#hsTitle").value,
            description: body.querySelector("#hsDesc").value,
            instructions: body.querySelector("#hsInstr").value,
            confidentiality: body.querySelector("#hsConf").value,
            i18n: Object.keys(kaV).length ? { ka: kaV } : {},
          });
        }
        return payload;
      };
    }

    /* ================================================================ preview */
    // "What they will receive", literally: the exact email finalize sends (server-rendered
    // for the admin's own name and address) plus the form drawn the way the employee page
    // draws it — disabled controls, real labels, real options.
    async function openPreview(q) {
      // the SHAREABLE preview (his call 2026-08-17): one live URL for test users — the
      // exact respondent experience, drafts included, and nothing they enter is saved.
      // (The old in-admin mock + invite-email overlay lived here; he asked for this.)
      var pv;
      try { pv = await api("/api/_hrqadmin?view=previewlink&id=" + q.id); }
      catch (e) { toast(e.message, true); return; }
      var old = document.getElementById("hqOvl");
      if (old) old.remove();
      var ovl = document.createElement("div");
      ovl.id = "hqOvl"; ovl.className = "hq-ovl";
      ovl.innerHTML = '<div class="pane" style="max-width:600px">'
        + '<div class="hq-row" style="margin-bottom:10px"><b style="font-size:15px">Preview link</b>'
        + '<span style="flex:1"></span><button class="hq-btn" id="pvX">Close</button></div>'
        + '<div class="hq-dim" style="margin-bottom:12px;line-height:1.6">Send this to anyone whose feedback you want. '
        + "They walk through the form exactly as the team will — even while it is still a draft — "
        + "and <b>nothing they enter is saved</b>. The link stays the same for this questionnaire.</div>"
        + '<div class="hq-anlk"><code style="font-size:12px">' + esc(pv.url) + "</code>"
        + '<button class="hq-btn" id="pvCp">Copy</button>'
        + '<a class="hq-btn" href="' + esc(pv.url) + '" target="_blank" rel="noopener" style="text-decoration:none">Open</a></div>'
        + "</div>";
      document.body.appendChild(ovl);
      ovl.querySelector("#pvX").onclick = function () { ovl.remove(); };
      ovl.onclick = function (e) { if (e.target === ovl) ovl.remove(); };
      ovl.querySelector("#pvCp").onclick = function () {
        navigator.clipboard.writeText(pv.url).then(function () {
          ovl.querySelector("#pvCp").textContent = "Copied";
          setTimeout(function () {
            var b2 = ovl.querySelector("#pvCp");
            if (b2) b2.textContent = "Copy";
          }, 1400);
        });
      };
    }

    /* ================================================================ invites */
    // The page LOOPS the batched send until the server says nothing remains — each request
    // claims-then-mails a few people, so a tab closed mid-way loses nothing (the next
    // "Send invites" click, or the next publish, picks up exactly where it stopped).
    async function sendInvites(qid) {
      var total = 0, guard = 0;
      toast("Sending invites…");
      while (guard++ < 40) {
        var r;
        try { r = await post({ action: "send_invites", id: qid }); }
        catch (e) { toast("Invites: " + e.message, true); return; }
        total += r.sent;
        var extra = r.mode !== "live" ? " · TEST mode — everything lands at " + r.test_to : "";
        if (!r.remaining || (!r.sent && !r.failed)) {
          toast("Invites done — " + total + " sent"
            + (r.failed ? " · " + r.failed + " failed (retry with Send invites)" : "")
            + (r.no_email ? " · " + r.no_email + " people have no email yet" : "") + extra,
            !!r.failed);
          if (S.view === "q" && S.qtab === "submissions") go();
          return;
        }
        toast("Sending invites… " + total + " sent · " + r.remaining + " to go" + extra);
      }
    }

    /* ============================================================ one response */
    async function paintOneResponse(body, canR) {
      var d;
      try { d = await api("/api/_hrqadmin?view=response&id=" + S.qid + "&email=" + encodeURIComponent(S.subOpen)); }
      catch (e) { S.subOpen = null; toast(e.message, true); return paintSubmissions(body, canR); }
      var r = d.response;
      var answerHtml = function (qq, v) {
        if (qq.qtype === "section") return "";
        if (v == null || v === "") return '<span class="hq-dim">— not answered</span>';
        if (qq.qtype === "stars5") return '<span style="color:var(--warn)">' + "★".repeat(clampStar(v))
          + '</span> <span class="hq-dim">' + esc(v) + "/5</span>";
        if (qq.qtype === "scale") return esc(v) + '<span class="hq-dim"> of ' + esc((qq.options || [])[1] || "") + "</span>";
        if (qq.qtype === "multi") return esc(safeArr(v).join(", "));
        return esc(v);
      };
      body.innerHTML =
        '<div class="hq-row" style="margin-bottom:12px">'
        + '<button class="hq-btn" id="hrBack">← Everyone</button>'
        + "<b style=\"font-size:15px\">" + esc(d.name || d.email) + "</b>"
        + '<span class="hq-dim">' + esc(d.email)
        + (r && r.department ? " · " + esc(r.department) : "") + "</span>"
        + '<span style="flex:1"></span>'
        + (r && (r.status === "submitted" || r.status === "resubmitted") && canR
            ? '<button class="hq-btn" id="hrReop">Reopen</button>' : "")
        + "</div>"
        + '<div class="hq-dim" style="margin-bottom:12px">'
        + (d.invite ? (d.invite.status === "sent" ? "Invited " + esc(fmtWhen(d.invite.sent_at)) : "Invite " + esc(d.invite.status)) : "Not invited yet")
        + (r ? " · " + esc(r.status.replace("_", " "))
             + (r.submitted_at ? " " + esc(fmtWhen(r.submitted_at)) : "")
             + (r.reopened_by ? " · reopened by " + esc(String(r.reopened_by).split("@")[0]) : "")
          : " · has not started") + "</div>"
        + '<div class="hq-card">'
        + (d.questions || []).map(function (qq) {
            if (qq.qtype === "section")
              return '<div style="margin:14px 0 4px;padding:7px 12px;border-left:3px solid var(--brand);background:var(--panel-2);border-radius:0 8px 8px 0;font-weight:800;font-size:13px">'
                + esc(qq.label) + "</div>";
            return '<div class="hq-txt"><b>' + esc(qq.label) + "</b><br>" + answerHtml(qq, d.answers[qq.id]) + "</div>";
          }).join("")
        + "</div>";
      body.querySelector("#hrBack").onclick = function () { S.subOpen = null; paintSubmissions(body, canR); };
      var rb = body.querySelector("#hrReop");
      if (rb) rb.onclick = async function () {
        if (!(await hqConfirm({ t: "Reopen this response?",
            b: "<b>" + esc(d.email) + "</b> will be able to change and resubmit their answers. "
              + "This is recorded.", yes: "Reopen" }))) return;
        try { await post({ action: "reopen", id: S.qid, email: d.email }); paintOneResponse(body, canR); }
        catch (e) { toast(e.message, true); }
      };
    }

    /* ================================================================ submissions */
    async function paintSubmissions(body, canR) {
      if (S.subOpen) return paintOneResponse(body, canR);
      await loadSub();
      if (S.sub.anon) {
        // ANONYMOUS: a category rollup — no names exist, which is the point
        var cats = S.sub.cats || [];
        var tot = { people: 0, invited: 0, started: 0, submitted: 0 };
        cats.forEach(function (c2) {
          tot.people += c2.people; tot.invited += c2.invited;
          tot.started += c2.started; tot.submitted += c2.submitted;
        });
        body.innerHTML =
          '<div class="hq-kpis">'
          + '<div class="hq-kpi"><b>' + tot.people + "</b><span>people invited to answer</span></div>"
          + '<div class="hq-kpi"><b>' + tot.invited + "</b><span>invite emails sent</span></div>"
          + '<div class="hq-kpi"><b>' + tot.started + "</b><span>in progress</span></div>"
          + '<div class="hq-kpi"><b>' + tot.submitted + "</b><span>submitted</span>"
          + '<div class="pb"><i style="width:' + (tot.people ? Math.round(tot.submitted / tot.people * 100) : 0)
          + '%"></i></div></div></div>'
          + '<div class="hq-dim" style="margin-bottom:10px">Anonymous questionnaire — answers '
          + "carry the team, never the person. Submission counts can pass the team's size if "
          + "someone opens the link on two devices.</div>"
          + '<div class="hq-row" style="margin-bottom:10px">'
          + (S.q && S.q.status === "published" && S.home && S.home.can_manage
              ? '<span style="flex:1"></span><button class="hq-btn" id="hbInv">Send invites</button>' : "")
          + "</div>"
          + '<div class="hq-card" style="padding:0;overflow:hidden"><table class="hq-tbl board"><thead><tr>'
          + "<th>Team</th><th class=\"r\">People</th><th class=\"r\">Invited</th>"
          + "<th class=\"r\">In progress</th><th class=\"r\">Submitted</th></tr></thead><tbody>"
          + cats.map(function (c2) {
              return "<tr><td><b>" + esc(c2.category) + "</b></td>"
                + '<td class="r">' + c2.people + "</td>"
                + '<td class="r">' + c2.invited + "</td>"
                + '<td class="r">' + c2.started + "</td>"
                + '<td class="r hq-new" style="color:var(--pos);font-weight:800">' + c2.submitted + "</td></tr>";
            }).join("")
          + "</tbody></table></div>";
        var ib2 = body.querySelector("#hbInv");
        if (ib2) ib2.onclick = function () { sendInvites(S.qid); };
        return;
      }
      var board = S.sub.board, counts = {};
      board.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
      var done = (counts.submitted || 0) + (counts.resubmitted || 0);
      var order = { reopened: 0, in_progress: 1, not_started: 2, submitted: 3, resubmitted: 3 };
      var rows = board.slice().sort(function (a, b) {
        return (order[a.status] || 0) - (order[b.status] || 0)
          || String(a.department || "").localeCompare(String(b.department || ""))
          || String(a.name || a.email).localeCompare(String(b.name || b.email));
      }).filter(function (r) {
        if (S.subFilter && r.status !== S.subFilter) return false;
        if (S.subQ) {
          var q2 = S.subQ.toLowerCase();
          if ((r.name || "").toLowerCase().indexOf(q2) < 0 && r.email.indexOf(q2) < 0) return false;
        }
        return true;
      });
      var pill = function (s) {
        var map = { not_started: ["n", "not started"], in_progress: ["a", "in progress"],
                    submitted: ["g", "submitted"], resubmitted: ["g", "resubmitted"],
                    reopened: ["b", "reopened"] };
        var m = map[s] || ["n", esc(s)];
        return '<span class="hq-st ' + m[0] + '"><i></i>' + m[1] + "</span>";
      };
      var initials = function (nm, em) {
        var p = String(nm || em || "?").trim().split(/\s+/);
        return ((((p[0] || "")[0] || "") + ((p[1] || "")[0] || "")).toUpperCase()) || "?";
      };
      body.innerHTML =
        '<div class="hq-kpis">'
        + '<div class="hq-kpi"><b>' + board.length + "</b><span>in the audience</span></div>"
        + '<div class="hq-kpi"><b>' + done + "</b><span>submitted</span></div>"
        + '<div class="hq-kpi"><b>' + (counts.in_progress || 0) + "</b><span>in progress</span></div>"
        + '<div class="hq-kpi"><b>' + (counts.not_started || 0) + "</b><span>not started</span></div>"
        + '<div class="hq-kpi"><b>' + fmtPct(done, board.length) + "</b><span>completion</span>"
        + '<div class="pb"><i style="width:' + (board.length ? Math.round(done / board.length * 100) : 0) + '%"></i></div></div></div>'
        + '<div class="hq-row" style="margin-bottom:10px">'
        + '<select class="hq-sel" id="hbF"><option value="">Every status</option>'
        + ["not_started", "in_progress", "submitted", "resubmitted", "reopened"].map(function (s) {
            return '<option value="' + s + '"' + (S.subFilter === s ? " selected" : "") + ">" + s.replace("_", " ") + "</option>";
          }).join("") + "</select>"
        + '<input class="hq-in" id="hbQ" placeholder="Find a person…" value="' + esc(S.subQ) + '">'
        + '<span class="hq-dim">' + rows.length + " shown</span>"
        + (S.q && S.q.status === "published" && S.home && S.home.can_manage
            ? '<span style="flex:1"></span><button class="hq-btn" id="hbInv">Send invites</button>' : "")
        + "</div>"
        + '<div class="hq-card" style="padding:0;overflow:hidden"><table class="hq-tbl board"><thead><tr>'
        + "<th>Person</th><th>Department</th><th>Status</th><th>Invited</th><th>Submitted</th><th></th></tr></thead><tbody>"
        + (rows.map(function (r) {
            var invited = r.no_email ? '<span class="hq-st a"><i></i>no email yet</span>'
              : !r.invite ? '<span class="hq-dim">—</span>'
              : r.invite.status === "sent" ? '<span class="hq-ok">✓ ' + esc(fmtWhen(r.invite.sent_at, true)) + "</span>"
              : r.invite.status === "failed" ? '<span class="hq-st r"><i></i>failed</span>'
              : '<span class="hq-dim">sending…</span>';
            var clickable = canR && r.email;
            var dc = deptColor(r.department);
            return "<tr" + (clickable ? ' class="rowlink" data-open="' + esc(r.email)
                + '" title="Open this response"' : "") + ">"
              + '<td><div class="hq-pcell"><span class="hq-av" style="background:' + dc + '22;color:' + dc + '">'
              + esc(initials(r.name, r.email)) + "</span><span>"
              + '<span class="nm">' + esc(r.name || r.email || "—") + "</span>"
              + (r.name && r.email ? '<div class="em">' + esc(r.email) + "</div>" : "")
              + "</span></div></td>"
              + "<td>" + (r.department ? '<span class="hq-dept"><i style="background:' + dc + '"></i>'
                  + esc(r.department) + "</span>" : '<span class="hq-dim">—</span>') + "</td>"
              + "<td>" + pill(r.status)
              + (r.reopened_by ? ' <span class="hq-dim">by ' + esc(String(r.reopened_by).split("@")[0]) + "</span>" : "") + "</td>"
              + "<td>" + invited + "</td>"
              + '<td class="hq-dim">' + (r.submitted_at ? esc(fmtWhen(r.submitted_at)) : "—") + "</td>"
              + '<td class="r hq-dim">' + (clickable ? "open ›" : "") + "</td></tr>";
          }).join("") || '<tr><td colspan="6" class="hq-dim" style="padding:14px">Nobody matches.</td></tr>')
        + "</tbody></table></div>";
      var ib = body.querySelector("#hbInv");
      if (ib) ib.onclick = function () { sendInvites(S.qid); };
      body.querySelector("#hbF").onchange = function () { S.subFilter = this.value; paintSubmissions(body, canR); };
      var qi = body.querySelector("#hbQ");
      qi.oninput = function () {
        S.subQ = this.value; var at = this.selectionStart;
        paintSubmissions(body, canR).then(function () {
          var n = body.querySelector("#hbQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
        });
      };
      body.querySelectorAll("[data-open]").forEach(function (tr) {
        tr.onclick = function () { S.subOpen = tr.dataset.open; paintSubmissions(body, canR); };
      });
    }

    /* ================================================================ results */
    async function paintResults(body) {
      await loadRes();
      // sections are layout, not data — they hold no answers and get no chart
      var R = S.res, questions = R.questions.filter(function (x) { return x.active && x.qtype !== "section"; });
      var subs = R.individuals.filter(function (r) { return r.status === "submitted" || r.status === "resubmitted"; });
      var depts = [...new Set(subs.map(function (r) { return r.department || "—"; }))].sort();
      var view = S.resDept ? subs.filter(function (r) { return (r.department || "—") === S.resDept; }) : subs;
      var qById = {}; R.questions.forEach(function (x) { qById[x.id] = x; });
      var html = '<div class="hq-kpis">'
        + '<div class="hq-kpi"><b>' + R.audience_size + "</b><span>audience</span></div>"
        + '<div class="hq-kpi"><b>' + subs.length + "</b><span>submitted</span></div>"
        + '<div class="hq-kpi"><b>' + fmtPct(subs.length, R.audience_size) + "</b><span>completion</span></div>"
        + '<div class="hq-kpi"><b>' + (R.individuals.length - subs.length) + "</b><span>reopened / pending</span></div></div>"
        + '<div class="hq-row" style="margin-bottom:12px">'
        + '<select class="hq-sel" id="hrDept"><option value="">All departments</option>'
        + depts.map(function (dpt) { return '<option' + (S.resDept === dpt ? " selected" : "") + ">" + esc(dpt) + "</option>"; }).join("")
        + "</select>"
        + (S.q && S.q.audience_kind === "anon_depts" ? ""    // anonymous: there IS no person
          : '<select class="hq-sel" id="hrWho"><option value="">Aggregate — everyone</option>'
          + view.map(function (r) { return '<option value="' + esc(r.email) + '"' + (S.resPerson === r.email ? " selected" : "") + ">" + esc(r.name || r.email) + "</option>"; }).join("")
          + "</select>")
        + '<span style="flex:1"></span><button class="hq-btn" id="hrCsv">Download CSV</button></div>';

      if (S.resPerson) {
        var person = view.filter(function (r) { return r.email === S.resPerson; })[0];
        if (!person) { S.resPerson = ""; return paintResults(body); }
        html += '<div class="hq-card"><h4>' + esc(person.name || person.email)
          + ' <span class="hq-dim">' + esc(person.department || "") + " · submitted "
          + esc(fmtWhen(person.submitted_at)) + "</span></h4>"
          + questions.map(function (qq) {
              var v = person.answers[qq.id];
              var shown = v == null || v === "" ? '<span class="hq-dim">— not answered</span>'
                : qq.qtype === "multi" ? esc(safeArr(v).join(", "))
                : qq.qtype === "stars5" ? "★".repeat(clampStar(v)) + '<span class="hq-dim"> (' + esc(v) + "/5)</span>"
                : qq.qtype === "scale" ? esc(v) + '<span class="hq-dim"> of ' + esc((qq.options || [])[1] || "") + "</span>"
                : esc(v);
              return '<div class="hq-txt"><b>' + esc(qq.label) + "</b><br>" + shown + "</div>";
            }).join("") + "</div>";
      } else {
        html += '<div class="hq-resgrid">' + questions.map(function (qq) {
          var vals = view.map(function (r) { return r.answers[qq.id]; })
            .filter(function (v) { return v != null && v !== ""; });
          var inner;
          if (qq.qtype === "stars5" || qq.qtype === "scale") {
            var lo3 = qq.qtype === "scale" ? (parseInt((qq.options || [])[0], 10) || 1) : 1;
            var hi3 = qq.qtype === "scale" ? (parseInt((qq.options || [])[1], 10) || 5) : 5;
            var nums = vals.map(Number).filter(function (n) { return n >= lo3 && n <= hi3; });
            var avg = nums.length ? (nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) : null;
            var steps = [];
            for (var st2 = hi3; st2 >= lo3; st2--) steps.push(st2);
            var mx = Math.max.apply(null, steps.map(function (s3) {
              return nums.filter(function (n) { return n === s3; }).length; }).concat([1]));
            inner = '<div class="hq-dim" style="margin-bottom:6px">average <b style="color:var(--ink)">'
              + (avg == null ? "—" : avg.toFixed(2)) + "</b> of " + hi3 + " · " + nums.length + " answers</div>"
              + steps.map(function (s2) {
                  var n = nums.filter(function (x2) { return x2 === s2; }).length;
                  return '<div class="hq-bar"><span>' + (qq.qtype === "stars5" ? "★".repeat(s2) : s2)
                    + '</span><span class="tr"><i style="width:'
                    + Math.round(n / mx * 100) + '%"></i></span><span class="n">' + n + "</span></div>";
                }).join("");
          } else if (qq.qtype === "single" || qq.qtype === "multi" || qq.qtype === "dropdown") {
            var counts2 = {}, otherTexts = [];
            (qq.options || []).forEach(function (o) { counts2[o] = 0; });
            vals.forEach(function (v) {
              (qq.qtype === "multi" ? safeArr(v) : [v]).forEach(function (o) {
                if (o in counts2) counts2[o]++;
                else if (String(o).indexOf("Other: ") === 0 && OTH in counts2) {
                  counts2[OTH]++; otherTexts.push(String(o).slice(7));
                }
              });
            });
            var mx2 = Math.max.apply(null, Object.keys(counts2).map(function (k) { return counts2[k]; }).concat([1]));
            inner = '<div class="hq-dim" style="margin-bottom:6px">' + vals.length + " answers"
              + (qq.qtype === "multi" ? " · several choices allowed" : "") + "</div>"
              + (qq.options || []).map(function (o) {
                  return '<div class="hq-bar"><span>' + esc(o) + '</span><span class="tr"><i style="width:'
                    + Math.round(counts2[o] / mx2 * 100) + '%"></i></span><span class="n">' + counts2[o]
                    + (vals.length ? " · " + Math.round(counts2[o] / vals.length * 100) + "%" : "") + "</span></div>";
                }).join("")
              + (otherTexts.length
                  ? '<div class="hq-dim" style="margin-top:7px">Other, in their words: '
                    + otherTexts.slice(0, 12).map(esc).join(" · ")
                    + (otherTexts.length > 12 ? " …" : "") + "</div>" : "");
          } else {
            inner = vals.length
              ? view.filter(function (r) { return r.answers[qq.id]; }).map(function (r) {
                  return '<div class="hq-txt">' + esc(r.answers[qq.id])
                    + '<div class="who">' + esc(r.name || r.email) + (r.department ? " · " + esc(r.department) : "") + "</div></div>";
                }).join("")
              : '<div class="hq-dim">No written answers yet.</div>';
          }
          return '<div class="hq-card"><h4>' + esc(qq.label)
            + ' <span class="hq-dim" style="font-weight:600">' + TYPE_LABEL[qq.qtype] + "</span></h4>" + inner + "</div>";
        }).join("") + "</div>";
      }
      body.innerHTML = html;
      body.querySelector("#hrDept").onchange = function () { S.resDept = this.value; S.resPerson = ""; paintResults(body); };
      var whoSel = body.querySelector("#hrWho");
      if (whoSel) whoSel.onchange = function () { S.resPerson = this.value; paintResults(body); };
      body.querySelector("#hrCsv").onclick = function () {
        // the ld-planning CSV pattern — plus a formula guard: a leading = + - @ or tab
        // would execute in Excel on HR's machine, and answer text is employee-controlled
        var escC = function (v) {
          v = v == null ? "" : String(v);
          if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
          return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        var head = ["Email", "Name", "Department", "Status", "Submitted"].concat(questions.map(function (qq) { return qq.label; }));
        var lines = [head.map(escC).join(",")];
        view.forEach(function (r) {
          lines.push([r.email, r.name || "", r.department || "", r.status, r.submitted_at || ""]
            .concat(questions.map(function (qq) {
              var v = r.answers[qq.id];
              return v == null ? "" : qq.qtype === "multi" ? safeArr(v).join("; ") : v;
            })).map(escC).join(","));
        });
        var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (S.q ? S.q.title.replace(/[^\w \-]+/g, "") : "questionnaire") + " results.csv";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      };
    }

    /* ================================================================ router */
    async function go() {
      paintTabs();
      main.innerHTML = '<div class="rs-loading" style="padding:22px">Loading…</div>';
      try {
        if (!S.home) await loadHome();
        if (S.view === "q" && S.qid) { if (!S.roster) try { await loadRoster(); } catch (e) {} await paintQ(); }
        else { S.view = "home"; await paintHome(); }
      } catch (e) {
        main.innerHTML = '<div class="hq-card"><b>Could not load</b><div class="hq-dim">' + esc(e.message || e) + "</div></div>";
      }
    }
    await go();
  },
});
