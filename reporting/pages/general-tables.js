/* GENERAL TABLES — the reference tables the office owns.
 *
 * Home for the small lookup tables that drive planning but belong to the business, not to a
 * report: today the DEPOTS (his "List of Bases"), which decide which truck can run which job.
 * Built as a container so the next reference table drops in beside it (Tornike 2026-07-29:
 * "in administration, create a new field, name it general tables and have it there").
 */
registerPage({
  id: "general-tables",
  title: "General Tables",
  subtitle: "Reference tables the office owns — edited here, used everywhere.",
  datasets: [],

  render: function (host) {
    var RSC = window.RS_COMPONENTS || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__GT || (window.__GT = { bases: null, loading: false, msg: "" });

    host.innerHTML = '<style id="gtCss">'
      + ".gt-wrap{max-width:1100px}"
      + ".gt-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px}"
      + ".gt-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:3px}"
      + ".gt-hd b{font-size:15.5px;letter-spacing:-.2px}"
      + ".gt-sub{font-size:12.5px;color:var(--faint);line-height:1.55;margin-bottom:13px}"
      + ".gt-tbl{width:100%;border-collapse:collapse;font-size:13px}"
      + ".gt-tbl th{text-align:left;font-size:9.5px;font-weight:800;text-transform:uppercase;"
      + "letter-spacing:.07em;color:var(--faint);padding:0 10px 6px 0}"
      + ".gt-tbl td{padding:4px 10px 4px 0;vertical-align:middle}"
      + ".gt-in{width:100%;font:inherit;font-size:13px;color:var(--ink);background:var(--panel-2);"
      + "border:1px solid var(--line-2);border-radius:9px;padding:8px 11px}"
      + ".gt-in:focus{outline:none;border-color:var(--blue)}"
      + ".gt-btn{font:inherit;font-size:12px;font-weight:750;color:var(--ink);background:var(--panel-2);"
      + "border:1px solid var(--line-2);border-radius:9px;padding:7px 13px;cursor:pointer;white-space:nowrap}"
      + ".gt-btn:hover{border-color:var(--blue)}"
      + ".gt-btn.pri{background:var(--brand);color:var(--brand-ink);border:0}"
      + ".gt-msg{font-size:12.5px;font-weight:650;margin-top:10px;min-height:17px}"
      + ".gt-fleet{font-size:11.5px;color:var(--faint);font-weight:650}"
      + ".gt-none{color:var(--neg,#b02a37)}"
      + "</style><div class='gt-wrap'><div id='gtBody'></div></div>";

    function paint() {
      var body = host.querySelector("#gtBody");
      if (!body) return;
      var bs = S.bases;
      body.innerHTML = '<div class="gt-card">'
        + '<div class="gt-hd"><b>Bases &middot; our depots</b></div>'
        + '<div class="gt-sub">A truck leaves its depot and comes back to the same one, so each job is '
        + 'planned from the depot with the shortest round trip &mdash; out to where the goods are, on to the '
        + 'delivery, and home again. A depot can only take a job when one of its own trucks fits the load, '
        + 'so a depot with no truck is never used. Truck home depots come from the Fleet File.</div>'
        + (bs == null ? '<div class="gt-sub">Loading&hellip;</div>' : tbl(bs))
        + '<div class="gt-msg" id="gtMsg">' + esc(S.msg) + "</div></div>";
      wire();
    }

    function tbl(bs) {
      var live = bs.filter(function (b) { return +b.active; });
      var row = function (b) {
        var id = b ? b.id : "new";
        var fleet = b ? (+b.trucks || 0) : 0;
        return '<tr data-bid="' + esc(id) + '">'
          + '<td><input class="gt-in" data-f="name" value="' + esc(b ? b.name : "")
          +   '" placeholder="e.g. VA"></td>'
          + '<td style="width:110px"><input class="gt-in" data-f="zip" inputmode="numeric" maxlength="5" value="'
          +   esc(b ? b.zip : "") + '" placeholder="22102"></td>'
          + '<td><input class="gt-in" data-f="address" value="' + esc(b ? (b.address || "") : "")
          +   '" placeholder="filled from the zip"></td>'
          + '<td class="gt-fleet' + (b && !fleet ? " gt-none" : "") + '">'
          +   (b ? (fleet ? fleet + (fleet === 1 ? " truck" : " trucks") : "no truck") : "") + "</td>"
          + '<td style="white-space:nowrap">'
          +   '<button class="gt-btn' + (b ? "" : " pri") + '" data-save="' + esc(id) + '">'
          +   (b ? "Save" : "Add base") + "</button>"
          +   (b ? ' <button class="gt-btn" data-del="' + esc(id) + '">Remove</button>' : "")
          + "</td></tr>";
      };
      return '<table class="gt-tbl"><tr><th>Name</th><th>Zip</th><th>Address</th><th>Fleet</th><th></th></tr>'
        + live.map(row).join("") + row(null) + "</table>";
    }

    function load() {
      if (S.loading) return;
      S.loading = true;
      fetch(ZTZ.API + "/api/_ldbases", { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
        .then(function (r) { return r.json(); })
        .then(function (j) { S.bases = (j && j.bases) || []; })
        .catch(function () { S.bases = []; S.msg = "Could not load the bases."; })
        .then(function () { S.loading = false; paint(); });
    }

    function send(body, btn) {
      btn.disabled = true;
      S.msg = "Saving…"; var m = host.querySelector("#gtMsg"); if (m) m.textContent = S.msg;
      fetch(ZTZ.API + "/api/_ldbases", { method: "POST",
        headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
        body: JSON.stringify(body) })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (o) {
          btn.disabled = false;
          if (!o.ok || (o.j && o.j.error)) { S.msg = (o.j && o.j.error) || "Save failed"; paint(); return; }
          S.msg = "Saved ✓ — job assignments follow on the next data rebuild";
          S.bases = null; load();
        })
        .catch(function (e) { btn.disabled = false; S.msg = String(e); paint(); });
    }

    function wire() {
      Array.prototype.forEach.call(host.querySelectorAll("[data-save],[data-del]"), function (b) {
        b.onclick = function () {
          var del = b.hasAttribute("data-del");
          var id = b.getAttribute(del ? "data-del" : "data-save");
          if (del) {
            if (!window.confirm("Remove this depot? Jobs planned from it move to the next-best "
                                + "depot on the next rebuild.")) return;
            send({ id: +id, delete: 1 }, b);
            return;
          }
          var tr = b.closest("tr"), payload = { name: "", zip: "", address: "" };
          Array.prototype.forEach.call(tr.querySelectorAll("[data-f]"), function (i) {
            payload[i.getAttribute("data-f")] = i.value.trim();
          });
          if (id !== "new") payload.id = +id;
          send(payload, b);
        };
      });
    }

    paint();
    if (S.bases == null) load(); else paint();
  },
});
