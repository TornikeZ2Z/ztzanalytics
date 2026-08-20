/* GENERAL SETTINGS (SETTINGS group, admin-only) — office-editable values that used to be
   hardcoded in pipeline code (Tornike 2026-07-21: "I don't like having hardcoded values in
   this system at all"). Stored in `app_settings` via the bridge (/api/_gset); the pipeline
   reads them at the start of every run, so an edit takes effect on the next run — and for
   Money Flow's foreman names, on the next nightly rebuild. */

registerPage({
  id: "general-settings",
  group: "settings",
  title: "General Translators",
  async render(host) {
    var esc = RSC.esc;

    if (!document.getElementById("gsCss")) {
      var st = document.createElement("style"); st.id = "gsCss";
      // THE COMPONENT KIT (rs.css) now supplies the page head, the card and its title, the
      // description line, the add fields and the buttons. What is left below is what the kit
      // does not name — the masonry columns, the removable e-mail token, the from→to mapping
      // row — plus one one-line adjustment TO a kit component.
      st.textContent = `
        /* plain length: min() is not valid in column-width, so the whole declaration was
           dropped and the page rendered as ONE 2090px column of label/value pairs. */
        #gsBody{column-width:560px;column-gap:16px}
        /* the card itself is a kit .panel; this is only the column-break behaviour, because a
           card split across two columns mid-form is unreadable */
        .gs-card{break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid;
          display:inline-block;width:100%}
        /* the title stays an h3 so the card keeps a heading level — drop the browser's margin */
        .gs-card .panel-title{margin:0 0 4px}
        /* A REMOVABLE TOKEN, which the kit cannot say: .rs-pill states a verdict and .rs-tog
           switches a filter — neither carries a ✕ that deletes the value it is showing. */
        .gs-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
        .gs-chip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;background:var(--panel-2);border:1px solid var(--line-2);border-radius:999px;padding:6px 8px 6px 13px}
        .gs-chip button{font:inherit;font-weight:800;color:var(--faint);background:transparent;border:0;cursor:pointer;padding:0 5px;border-radius:50%}
        .gs-chip button:hover{color:var(--neg)}
        /* one from→to mapping, on a grid so the arrows line up down the card */
        .gs-pair{display:grid;grid-template-columns:1fr 24px 1fr 34px;gap:8px;align-items:center;margin-bottom:6px;font-size:12.5px}
        .gs-pair .arr{text-align:center;color:var(--faint);font-weight:800}
        .gs-x{font-size:12px;color:var(--faint);background:transparent;border:1px solid var(--line-2);border-radius:7px;cursor:pointer;padding:4px 8px}
        .gs-add{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}
        .gs-actions{margin-top:12px}
        .gs-empty{color:var(--faint);font-size:12px}
        div.gs-empty{margin-bottom:8px}
        .gs-err{color:var(--neg);font-size:11.5px;font-weight:700;margin-left:10px}
        .gs-meta{font-size:10.5px;color:var(--faint);margin-top:8px}
        .gs-load{padding:40px;text-align:center;color:var(--faint)}`;
      document.head.appendChild(st);
    }

    var META = {
      ignored_foreman_emails: {
        t: "Ignored foreman e-mails",
        p: "These people are NEVER the foreman of a job, even when they are on the calendar event — office accounts, partner sales people. Used by Money Flow and the calendar loader.",
        kind: "emails",
      },
      branch_owner_emails: {
        t: "Branch owner e-mails",
        p: "Skipped when a calendar event lists several people, unless the owner is the only one there — so an owner tagging along doesn’t hide the real foreman.",
        kind: "emails",
      },
      calendar_email_corrections: {
        t: "Calendar e-mail corrections",
        p: "Step 1, at calendar load: the LEFT address is recorded as the RIGHT one — the address the fleet/closing world uses. (A person can have two addresses; this and the next map translate between the sheets that disagree about which one is 'his'. They run at different steps, so they do not conflict.)",
        kind: "pairs",
      },
      foreman_translator_corrections: {
        t: "Foreman translator corrections",
        p: "Step 2, inside Money Flow only: applied right before the ForFormulas translator lookup, because that sheet may list the person under the other address. Once the old Net Cash sheet is retired, aligning the sheets on one address makes both maps deletable.",
        kind: "pairs",
      },
    };

    host.innerHTML = '<div class="rs-page-head"><h1>General Translators</h1>'
      + '<p>Values the system used to have hardcoded — now editable here. Changes apply on the next pipeline run (within ~6 hours); Money Flow foreman names refresh on the next rebuild.</p></div>'
      + '<div id="gsBody"><div class="gs-load">Loading…</div></div>';

    var S = { data: null };

    async function load() {
      var r = await fetch(ZTZ.API + "/api/_gset", { headers: { "Authorization": "Bearer " + ZTZ.getToken() } });
      if (r.status === 403) throw new Error("Admin only — your account can’t edit settings.");
      if (!r.ok) throw new Error("HTTP " + r.status);
      S.data = await r.json();
    }
    async function save(name, value, card) {
      var btn = card.querySelector("[data-gsave]");
      var msg = card.querySelector("[data-gmsg]");
      btn.disabled = true; msg.textContent = "";
      try {
        var r = await fetch(ZTZ.API + "/api/_gset", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
          body: JSON.stringify({ name: name, value: value }),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
        await load(); paint();
      } catch (e) {
        btn.disabled = false;
        msg.innerHTML = '<span class="gs-err">' + esc(String(e && e.message || e)) + "</span>";
      }
    }

    function paint() {
      var body = document.getElementById("gsBody");
      var settings = (S.data && S.data.settings) || {};
      body.innerHTML = Object.keys(META).map(function (name) {
        var m = META[name];
        var cur = (settings[name] && settings[name].value) || [];
        var meta = settings[name] || {};
        var inner;
        if (m.kind === "emails") {
          inner = '<div class="gs-chips">' + (cur.length ? cur.map(function (em, i) {
              return '<span class="gs-chip">' + esc(em) + '<button title="remove" data-grm="' + i + '">✕</button></span>';
            }).join("") : '<span class="gs-empty">— empty —</span>') + "</div>"
            + '<div class="gs-add"><input class="rs-inp" data-gin placeholder="name@example.com">'
            + '<button class="rs-btn" data-gadd>Add</button></div>';
        } else {
          inner = (cur.length ? cur.map(function (p, i) {
              return '<div class="gs-pair"><span>' + esc(p[0]) + '</span><span class="arr">→</span><span>' + esc(p[1])
                + '</span><button class="gs-x" title="remove" data-grm="' + i + '">✕</button></div>';
            }).join("") : '<div class="gs-empty">— empty —</div>')
            + '<div class="gs-add"><input class="rs-inp" data-gin placeholder="from@example.com"><input class="rs-inp" data-gin2 placeholder="to@example.com">'
            + '<button class="rs-btn" data-gadd>Add</button></div>';
        }
        return '<div class="panel rs-noanim gs-card" data-gname="' + name + '"><h3 class="panel-title">' + m.t + '</h3><div class="rs-hint">' + m.p + "</div>"
          + inner
          + '<div class="gs-actions"><button class="rs-btn pri" data-gsave>Save</button><span data-gmsg></span></div>'
          + '<div class="gs-meta">' + (meta.at ? "Last saved " + esc(meta.at) + " by " + esc(String(meta.by || "")) : "Never edited (seeded defaults)") + "</div></div>";
      }).join("");

      Array.prototype.forEach.call(body.querySelectorAll(".gs-card"), function (card) {
        var name = card.getAttribute("data-gname");
        var m = META[name];
        var cur = ((settings[name] && settings[name].value) || []).slice();
        Array.prototype.forEach.call(card.querySelectorAll("[data-grm]"), function (b) {
          b.onclick = function () { cur.splice(+b.getAttribute("data-grm"), 1); save(name, cur, card); };
        });
        var add = card.querySelector("[data-gadd]");
        if (add) add.onclick = function () {
          var a = card.querySelector("[data-gin]").value.trim().toLowerCase();
          if (!a) return;
          if (m.kind === "emails") cur.push(a);
          else {
            var b2 = card.querySelector("[data-gin2]").value.trim().toLowerCase();
            if (!b2) return;
            cur.push([a, b2]);
          }
          save(name, cur, card);
        };
        var sv = card.querySelector("[data-gsave]");
        if (sv) sv.onclick = function () { save(name, cur, card); };
      });
    }

    try { await load(); paint(); }
    catch (e) { document.getElementById("gsBody").innerHTML = '<div class="gs-load">' + esc(String(e && e.message || e)) + "</div>"; }
  },
});
