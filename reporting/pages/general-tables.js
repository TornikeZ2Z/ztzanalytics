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
    // window.RSC is the real global (assets/rs-components.js:3). This read RS_COMPONENTS,
    // which has never existed, so `|| {}` handed every one of these pages an EMPTY object
    // and each helper quietly fell through to its local fallback. Nothing looked wrong
    // until `collapsible` -- the one member with no fallback -- was called, and Packing
    // Control and Storage Control died with "RSC.collapsible is not a function".
    var RSC = window.RSC || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__GT || (window.__GT = { bases: null, loading: false, msg: "" });

    // The card, its head, the reading line, the table, the inputs and the buttons now come from
    // THE COMPONENT KIT in rs.css. What is left here is the page's own width, its status line,
    // and three one-line adjustments TO kit components.
    host.innerHTML = '<style id="gtCss">'
      + ".gt-wrap{max-width:var(--rs-row-max);margin:0 auto}"
      // these inputs live in table cells, so they fill their column instead of asking for the kit's 210px
      + ".gt-wrap .rs-inp{width:100%;min-width:0}"
      // form rows, not reading rows: the input already carries its own padding, so the cell adds less
      + ".gt-wrap .rs-table td{padding:6px 12px}"
      // a form wearing a data table's clothes: no zebra, no row hover -- those say
      // "these are records to scan", and these are fields to fill in
      + ".gt-wrap .rs-table tbody tr:nth-child(even) td{background:transparent}"
      + ".gt-wrap .rs-table tbody tr:hover td{background:transparent}"
      // "no truck" is the reason a depot can never be used, so it is a real negative, not a quiet one
      + ".gt-wrap .rs-table td.gt-none{color:var(--neg);font-weight:700}"
      // the save/remove status line, with its height reserved so a message never shifts the card
      + ".gt-msg{font-size:12.5px;font-weight:650;margin-top:10px;min-height:17px}"
      + "</style><div class='gt-wrap'><div id='gtBody'></div></div>";

    function paint() {
      var body = host.querySelector("#gtBody");
      if (!body) return;
      var bs = S.bases;
      body.innerHTML = '<div class="panel rs-noanim">'
        + '<div class="panel-head"><div class="panel-title">Bases &middot; our depots</div></div>'
        + '<div class="rs-hint">A truck leaves its depot and comes back to the same one, so each job is '
        + 'planned from the depot with the shortest round trip &mdash; out to where the goods are, on to the '
        + 'delivery, and home again. A depot can only take a job when one of its own trucks fits the load, '
        + 'so a depot with no truck is never used. Truck home depots come from the Fleet File.</div>'
        + (bs == null ? '<div class="rs-hint">Loading&hellip;</div>' : tbl(bs))
        + '<div class="gt-msg" id="gtMsg">' + esc(S.msg) + "</div></div>";
      wire();
    }

    function tbl(bs) {
      var live = bs.filter(function (b) { return +b.active; });
      var row = function (b) {
        var id = b ? b.id : "new";
        var fleet = b ? (+b.trucks || 0) : 0;
        return '<tr data-bid="' + esc(id) + '">'
          + '<td><input class="rs-inp" data-f="name" value="' + esc(b ? b.name : "")
          +   '" placeholder="e.g. VA"></td>'
          + '<td style="width:110px"><input class="rs-inp" data-f="zip" inputmode="numeric" maxlength="5" value="'
          +   esc(b ? b.zip : "") + '" placeholder="22102"></td>'
          + '<td><input class="rs-inp" data-f="address" value="' + esc(b ? (b.address || "") : "")
          +   '" placeholder="filled from the zip"></td>'
          + '<td class="' + (b && !fleet ? "gt-none" : "muted") + '">'
          +   (b ? (fleet ? fleet + (fleet === 1 ? " truck" : " trucks") : "no truck") : "") + "</td>"
          + '<td class="nowrap">'
          +   '<button class="rs-btn' + (b ? "" : " pri") + '" data-save="' + esc(id) + '">'
          +   (b ? "Save" : "Add base") + "</button>"
          +   (b ? ' <button class="rs-btn" data-del="' + esc(id) + '">Remove</button>' : "")
          + "</td></tr>";
      };
      return '<div class="rs-tablewrap"><table class="rs-table">'
        + '<thead><tr><th>Name</th><th>Zip</th><th>Address</th><th>Fleet</th><th></th></tr></thead><tbody>'
        + live.map(row).join("") + row(null) + "</tbody></table></div>";
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
        b.onclick = async function () {
          var del = b.hasAttribute("data-del");
          var id = b.getAttribute(del ? "data-del" : "data-save");
          if (del) {
            if (!(await RSC.confirm({ title: "Remove this depot?",
                  body: "Jobs planned from it move to the next-best depot on the next rebuild.",
                  yes: "Remove", danger: true }))) return;
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
