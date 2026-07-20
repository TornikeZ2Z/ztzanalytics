/* GENERAL SETTINGS (SETTINGS group, admin-only) — office-editable values that used to be
   hardcoded in pipeline code (Tornike 2026-07-21: "I don't like having hardcoded values in
   this system at all"). Stored in `app_settings` via the bridge (/api/_gset); the pipeline
   reads them at the start of every run, so an edit takes effect on the next run — and for
   Money Flow's foreman names, on the next nightly rebuild. */

registerPage({
  id: "general-settings",
  group: "settings",
  title: "General Settings",
  async render(host) {
    var esc = RSC.esc;

    if (!document.getElementById("gsCss")) {
      var st = document.createElement("style"); st.id = "gsCss";
      st.textContent = `
        .gs-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
        .gs-head p{margin:4px 0 16px;font-size:12.5px;color:var(--muted);max-width:640px}
        .gs-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;padding:16px 18px;margin-bottom:14px;max-width:760px}
        .gs-card h3{margin:0 0 4px;font-size:14.5px;font-weight:800}
        .gs-card .sub{font-size:11.5px;color:var(--faint);margin-bottom:12px}
        .gs-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
        .gs-chip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;background:var(--panel-2);border:1px solid var(--line-2);border-radius:999px;padding:6px 8px 6px 13px}
        .gs-chip button{font:inherit;font-weight:800;color:var(--faint);background:transparent;border:0;cursor:pointer;padding:0 5px;border-radius:50%}
        .gs-chip button:hover{color:#b02a37}
        .gs-pair{display:grid;grid-template-columns:1fr 24px 1fr 34px;gap:8px;align-items:center;margin-bottom:6px;font-size:12.5px}
        .gs-pair .arr{text-align:center;color:var(--faint);font-weight:800}
        .gs-add{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}
        .gs-add input{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:9px;padding:8px 11px;min-width:210px}
        .gs-btn{font:inherit;font-size:12px;font-weight:800;background:var(--brand);color:var(--brand-ink);border:0;border-radius:9px;padding:8px 15px;cursor:pointer}
        .gs-btn[disabled]{opacity:.55;cursor:default}
        .gs-btn.ghost{background:var(--panel-2);color:var(--muted);border:1px solid var(--line-2)}
        .gs-meta{font-size:10.5px;color:var(--faint);margin-top:8px}
        .gs-ok{color:#1c7a4a;font-size:11.5px;font-weight:700;margin-left:10px}
        .gs-err{color:#b02a37;font-size:11.5px;font-weight:700;margin-left:10px}
        .gs-x{font-size:12px;color:var(--faint);background:transparent;border:1px solid var(--line-2);border-radius:7px;cursor:pointer;padding:4px 8px}
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
        p: "Applied by the calendar loader: whenever the LEFT address appears as the foreman, it is recorded as the RIGHT one.",
        kind: "pairs",
      },
      foreman_translator_corrections: {
        t: "Foreman translator corrections",
        p: "Applied by Money Flow before looking a foreman up in the translator sheet.",
        kind: "pairs",
      },
    };

    host.innerHTML = '<div class="gs-head"><h1>General Settings</h1>'
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
            }).join("") : '<span style="color:var(--faint);font-size:12px">— empty —</span>') + "</div>"
            + '<div class="gs-add"><input data-gin placeholder="name@example.com">'
            + '<button class="gs-btn ghost" data-gadd>Add</button></div>';
        } else {
          inner = (cur.length ? cur.map(function (p, i) {
              return '<div class="gs-pair"><span>' + esc(p[0]) + '</span><span class="arr">→</span><span>' + esc(p[1])
                + '</span><button class="gs-x" title="remove" data-grm="' + i + '">✕</button></div>';
            }).join("") : '<div style="color:var(--faint);font-size:12px;margin-bottom:8px">— empty —</div>')
            + '<div class="gs-add"><input data-gin placeholder="from@example.com"><input data-gin2 placeholder="to@example.com">'
            + '<button class="gs-btn ghost" data-gadd>Add</button></div>';
        }
        return '<div class="gs-card" data-gname="' + name + '"><h3>' + m.t + '</h3><div class="sub">' + m.p + "</div>"
          + inner
          + '<div style="margin-top:12px"><button class="gs-btn" data-gsave>Save</button><span data-gmsg></span></div>'
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
