/* SALES page: Conversations — every call and text with a customer, in one thread,
   with the RingSense transcript of each recorded call read inline.

   Built lead-first, not transcript-first (Tornike 2026-08-17: "i just need this
   transcript to be linked to each lead ... i need user to be able to see the whole
   conversation"). You search for a person, not for a recording.

   DATA PATH: nothing here uses RS.load. Transcripts are ~95k rows of raw customer
   speech — too big to ship and too sensitive to serve from the generic dataset path,
   so both tables sit in the bridge's EXCLUDE_TABLES and everything arrives through
   two gated endpoints: /api/_convsearch?q= (leads) and /api/_convthread?job= (the
   thread + its transcripts in one round trip).

   The thread reads like a messaging app on purpose: ours on the right, theirs on the
   left, so "who said what" is legible before you read a word. */

const CONV = (() => {
  // module-level so a global filter change (which re-runs render wholesale) does not
  // throw away the lead you are reading
  const S = { q: "", leads: [], job: null, thread: null, open: {}, busy: false, err: "" };

  function injectStyle() {
    const old = document.getElementById("cnv-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "cnv-style";
    st.textContent = `
    .cnv-wrap{display:grid;grid-template-columns:340px 1fr;gap:16px;align-items:start}
    @media(max-width:900px){.cnv-wrap{grid-template-columns:1fr}}
    .cnv-side{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;
      position:sticky;top:8px;max-height:calc(100vh - var(--pg-chrome, 220px));display:flex;flex-direction:column}
    .cnv-search{display:flex;gap:8px;margin-bottom:10px}
    .cnv-search input{flex:1;background:var(--bg);border:1px solid var(--line);border-radius:8px;
      padding:9px 11px;color:var(--ink);font-size:14px}
    .cnv-search button{background:var(--blue);border:0;color:#fff;border-radius:8px;padding:9px 14px;
      font-weight:600;cursor:pointer}
    .cnv-hits{overflow:auto;flex:1;margin:0 -4px}
    .cnv-hit{padding:9px 10px;border-radius:9px;cursor:pointer;border:1px solid transparent}
    .cnv-hit:hover{background:var(--bg)}
    .cnv-hit.on{background:var(--bg);border-color:var(--blue)}
    .cnv-hit b{display:block;font-size:13.5px}
    .cnv-hit span{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
    .cnv-pills{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap}
    .cnv-pill{font-size:10.5px;padding:1px 7px;border-radius:999px;background:var(--bg);
      border:1px solid var(--line);color:var(--muted)}
    .cnv-pill.tr{border-color:var(--purple);color:var(--purple)}
    .cnv-main{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px;min-height:420px}
    .cnv-lead{display:flex;flex-wrap:wrap;gap:14px;align-items:baseline;padding-bottom:12px;
      border-bottom:1px solid var(--line);margin-bottom:16px}
    .cnv-lead h2{margin:0;font-size:19px}
    .cnv-lead .meta{color:var(--muted);font-size:12.5px}
    .cnv-thread{display:flex;flex-direction:column;gap:14px}
    .cnv-ev{max-width:min(760px,86%)}
    .cnv-ev.out{align-self:flex-end}
    .cnv-ev.in{align-self:flex-start}
    .cnv-head{font-size:11.5px;color:var(--muted);margin-bottom:4px}
    .cnv-ev.out .cnv-head{text-align:right}
    .cnv-body{border:1px solid var(--line);border-radius:12px;padding:10px 13px;background:var(--bg)}
    .cnv-ev.out .cnv-body{border-color:var(--blue)}
    .cnv-call{display:flex;align-items:center;gap:10px;font-size:13px}
    .cnv-ico{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:0 0 26px;
      background:var(--panel);border:1px solid var(--line);font-size:13px}
    .cnv-miss .cnv-body{border-color:var(--neg)}
    .cnv-miss .cnv-ico{color:var(--neg)}
    .cnv-txt{font-size:13.5px;white-space:pre-wrap;line-height:1.45}
    .cnv-tbtn{margin-left:auto;background:none;border:1px solid var(--line);color:var(--purple);
      border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer;white-space:nowrap}
    .cnv-tbtn:hover{border-color:var(--purple)}
    .cnv-tr{margin-top:10px;border-top:1px dashed var(--line);padding-top:10px}
    .cnv-sum{font-size:12.5px;color:var(--ink);background:var(--panel);border-left:3px solid var(--purple);
      padding:7px 10px;border-radius:0 8px 8px 0;margin-bottom:9px;line-height:1.5}
    .cnv-sum h5{margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--purple)}
    .cnv-utt{display:grid;grid-template-columns:52px 108px 1fr;gap:8px;font-size:12.5px;padding:3px 0;
      line-height:1.45}
    .cnv-utt .t{color:var(--muted);font-variant-numeric:tabular-nums;font-size:11.5px}
    .cnv-utt .s{color:var(--blue);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cnv-utt.them .s{color:var(--warn)}
    .cnv-empty{color:var(--muted);text-align:center;padding:70px 20px;font-size:14px}
    .cnv-x{align-self:center;width:min(760px,86%);opacity:.95}
    .cnv-day{align-self:center;font-size:11px;color:var(--muted);background:var(--bg);
      border:1px solid var(--line);border-radius:999px;padding:2px 12px}
    `;
    document.head.appendChild(st);
  }

  const esc = s => RSC.esc(s == null ? "" : String(s));
  const isOut = d => d === "Outgoing" || d === "Outbound";

  function dur(sec) {
    if (sec == null) return "";
    const s = Math.max(0, Math.round(sec));
    return s < 60 ? s + "s" : Math.floor(s / 60) + "m " + String(s % 60).padStart(2, "0") + "s";
  }
  function clock(sec) {
    const s = Math.max(0, Math.round(Number(sec) || 0));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  // Event times are NY-local wall times (fct_ringcentral's basis), NOT instants — so they
  // are printed as written, never re-zoned by the portal's timezone picker.
  const tOf = v => String(v || "").slice(11, 16);
  const dOf = v => String(v || "").slice(0, 10);

  async function search(host) {
    S.busy = true; S.err = ""; paintSide(host);
    try {
      const r = await ZTZ.api("/api/_convsearch?q=" + encodeURIComponent(S.q));
      S.leads = (r && r.leads) || [];
    } catch (e) {
      const raw = String(e && e.message || e);
      // The mart is rebuilt by the nightly run; between a fresh deploy and that run the
      // table can legitimately not exist yet. Say so in English instead of showing a
      // MySQL 1146 to a salesperson.
      S.err = /doesn't exist|1146/i.test(raw)
        ? "Conversations are still being assembled — this fills in after the next data refresh."
        : raw;
      S.leads = [];
    }
    S.busy = false; paintSide(host);
  }

  async function openLead(host, job) {
    S.job = job; S.thread = null; S.open = {}; paintMain(host); paintSide(host);
    try {
      S.thread = await ZTZ.api("/api/_convthread?job=" + encodeURIComponent(job));
    } catch (e) { S.thread = { error: String(e && e.message || e) }; }
    paintMain(host);
  }

  function paintSide(host) {
    const box = host.querySelector("#cnvHits");
    if (!box) return;
    if (S.busy) { box.innerHTML = `<div class="rs-loading" style="padding:14px">Searching…</div>`; return; }
    if (S.err) { box.innerHTML = `<div class="cnv-empty" style="padding:20px">${esc(S.err)}</div>`; return; }
    if (!S.leads.length) {
      box.innerHTML = `<div class="cnv-empty" style="padding:26px 10px;font-size:12.5px">${
        S.q ? "No lead matches that." : "Search by customer name, phone number or job number."}</div>`;
      return;
    }
    box.innerHTML = S.leads.map(l => `
      <div class="cnv-hit${l["Job No"] === S.job ? " on" : ""}" data-job="${esc(l["Job No"])}">
        <b>${esc(l["Customer"] || "(no name)")}</b>
        <span>${esc(l["Job No"])} · ${esc(l["Phone"] || "")} · ${esc(l["Status"] || "")}</span>
        <div class="cnv-pills">
          <i class="cnv-pill">${l["Calls"] || 0} calls</i>
          <i class="cnv-pill">${l["Texts"] || 0} texts</i>
          ${Number(l["Transcripts"]) ? `<i class="cnv-pill tr">${l["Transcripts"]} transcribed</i>` : ""}
        </div>
      </div>`).join("");
    box.querySelectorAll(".cnv-hit").forEach(el =>
      el.onclick = () => openLead(host, el.dataset.job));
  }

  function transcriptHtml(tr, custName) {
    if (!tr) return "";
    let extra = "";
    const parse = j => { try { return JSON.parse(j || "null"); } catch (e) { return null; } };
    const hi = parse(tr["Highlights Json"]), ns = parse(tr["Next Steps Json"]);
    // RingSense returns these as [{start,end,value}] — NOT plain strings. Rendered raw,
    // the summary box showed a wall of JSON to the reader (caught in review 2026-08-18).
    const listOf = v => Array.isArray(v) ? v.map(x =>
      typeof x === "string" ? x
        : (x && (x.value || x.text || x.title || x.name)) || "").filter(Boolean) : [];
    const sumRaw = tr["Summary"];
    const sumParsed = typeof sumRaw === "string" && sumRaw.trim().startsWith("[")
      ? listOf(parse(sumRaw)) : null;
    const summary = sumParsed && sumParsed.length ? sumParsed.join(" ") : (sumRaw || "");
    if (summary) extra += `<div class="cnv-sum"><h5>Summary</h5>${esc(summary)}</div>`;
    const hl = listOf(hi), st = listOf(ns);
    if (hl.length) extra += `<div class="cnv-sum"><h5>Highlights</h5>${hl.map(esc).join("<br>")}</div>`;
    if (st.length) extra += `<div class="cnv-sum"><h5>Next steps</h5>${st.map(esc).join("<br>")}</div>`;
    const us = tr.utterances || [];
    // Who is US and who is THEM: RingSense names BOTH sides (the customer too), so
    // "has a name" cannot tell them apart. The speaker carrying an extensionId is on
    // our phone system; everyone else is the customer.
    const spk = parse(tr["Speakers Json"]) || [];
    const ours = new Set(spk.filter(s => s && s.extensionId).map(s => s.speakerId));
    const rows = us.map(u => {
      const isUs = ours.has(u["Speaker Id"]);
      // RingSense identifies OUR people by extension but leaves the customer as a raw
      // phone number. The lead already knows who they are, so use that name.
      const label = isUs ? (u["Speaker Name"] || "Us")
        : (custName || (/^[+\d][\d\s()+-]*$/.test(String(u["Speaker Name"] || "")) ? "Customer" : u["Speaker Name"]) || "Customer");
      return `
      <div class="cnv-utt${isUs ? "" : " them"}">
        <div class="t">${clock(u["Start"])}</div>
        <div class="s">${esc(label)}</div>
        <div>${esc(u["Text"])}</div>
      </div>`;
    }).join("");
    return `<div class="cnv-tr">${extra}${rows || `<div class="cnv-empty" style="padding:14px">No speech captured.</div>`}</div>`;
  }

  /* The thread renderer, shared. The Sales Person Analysis drawer mounts the SAME
     markup (CONV.mountThread) so a conversation looks and behaves identically
     wherever it is read — one renderer, not two that drift apart. */
  function threadHtml(ev, tr, open, customerName, extras) {
    const h = { Customer: customerName || (ev[0] && ev[0]["Customer"]) || "Customer" };
    let lastDay = "";
    // `extras` are foreign rows (the lead file's milestones) that belong in the SAME
    // stream. They are merged and sorted HERE, before render — an earlier version
    // inserted them into the DOM afterwards and they all piled up out of order.
    const items = ev.map((e, i) => ({ at: String(e["Event At"] || ""), e: e, i: i }))
      .concat((extras || []).map(x => ({ at: String(x.at || ""), html: x.html })))
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    const body = items.map((it) => {
      const day = it.at.slice(0, 10);
      let sep = "";
      if (day !== lastDay) { lastDay = day; sep = `<div class="cnv-day">${esc(day)}</div>`; }
      if (it.html) return sep + `<div class="cnv-x">${it.html}</div>`;
      const e = it.e, i = it.i;
      const out = isOut(e["Direction"]);
      const who = out ? (e["Agent"] || "Us") : (h["Customer"] || "Customer");
      const head = `${esc(who)} · ${esc(tOf(e["Event At"]))}${e["Pre Create"] ? " · before the lead existed" : ""}`;
      if (e["Kind"] === "SMS") {
        return sep + `<div class="cnv-ev ${out ? "out" : "in"}" data-at="${esc(e["Event At"] || "")}">
          <div class="cnv-head">${head}</div>
          <div class="cnv-body"><div class="cnv-txt">${esc(e["Message Text"] || "(no text captured)")}</div></div>
        </div>`;
      }
      const missed = !out && /missed|voicemail/i.test(String(e["Result"] || ""));
      const t = e["Telephony Session Id"] ? tr[e["Telephony Session Id"]] : null;
      const opened = !!open[i];
      return sep + `<div class="cnv-ev ${out ? "out" : "in"}${missed ? " cnv-miss" : ""}" data-at="${esc(e["Event At"] || "")}">
        <div class="cnv-head">${head}</div>
        <div class="cnv-body">
          <div class="cnv-call">
            <div class="cnv-ico">${out ? "↗" : (missed ? "✕" : "↙")}</div>
            <div>${out ? "Called" : "Called in"}${e["Duration Seconds"] ? " · " + esc(dur(e["Duration Seconds"])) : ""}
              <span style="color:var(--muted)"> · ${esc(e["Result"] || "")}</span></div>
            ${t ? `<button class="cnv-tbtn" data-i="${i}">${opened ? "Hide" : "Read"} transcript${
              e["Utterance Count"] ? " (" + e["Utterance Count"] + ")" : ""}</button>` : ""}
          </div>
          ${opened && t ? transcriptHtml(t, h["Customer"]) : ""}
        </div>
      </div>`;
    }).join("");
    return `<div class="cnv-thread">${body}</div>`;
  }

  /* Render a thread into any element and keep its own expand state. Used by this
     page AND by the Sales Person Analysis lead drawer. */
  function mountThread(el, ev, tr, customerName, extras) {
    const open = {};
    const draw = () => {
      el.innerHTML = threadHtml(ev, tr, open, customerName, extras);
      el.querySelectorAll(".cnv-tbtn").forEach(b => b.onclick = () => {
        open[b.dataset.i] = !open[b.dataset.i];
        draw();
      });
    };
    draw();
  }

  function paintMain(host) {
    const box = host.querySelector("#cnvMain");
    if (!box) return;
    if (!S.job) {
      box.innerHTML = `<div class="cnv-empty">Pick a lead on the left to read the whole conversation —
        every call and text, with the transcript of anything RingSense recorded.</div>`;
      return;
    }
    if (!S.thread) { box.innerHTML = `<div class="rs-loading" style="padding:40px">Loading the conversation…</div>`; return; }
    if (S.thread.error) { box.innerHTML = `<div class="cnv-empty">${esc(S.thread.error)}</div>`; return; }
    const ev = S.thread.events || [];
    if (!ev.length) { box.innerHTML = `<div class="cnv-empty">No calls or texts recorded for this lead.</div>`; return; }
    const h = ev[0];
    const nTr = ev.filter(e => e["Has Transcript"]).length;
    box.innerHTML = `
      <div class="cnv-lead">
        <h2>${esc(h["Customer"] || "(no name)")}</h2>
        <div class="meta">${esc(S.job)} · ${esc(h["Phone Norm"] || "")}</div>
        <div class="meta">${esc(h["Status"] || "")}${h["Assigned"] ? " · " + esc(h["Assigned"]) : ""}${
          h["Source"] ? " · " + esc(h["Source"]) : ""}</div>
        <div class="meta" style="margin-left:auto">${ev.length} events · ${nTr} transcribed</div>
      </div>
      <div id="cnvThread"></div>`;
    mountThread(box.querySelector("#cnvThread"), ev, S.thread.transcripts || {}, h["Customer"]);
  }

  return { injectStyle, search, openLead, paintSide, paintMain, mountThread, threadHtml, S };
})();

/* EXPLICIT export. `const CONV` at the top level of a classic script lives in the
   global LEXICAL scope, which is NOT window — so the lead file's `window.CONV`
   check was always false and the conversation silently never mounted (2026-08-18). */
window.CONV = CONV;

registerPage({
  id: "conversations",
  group: "sales",
  title: "Conversations",
  async render(host) {
    CONV.injectStyle();
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Conversations</h1>
        <p>Every call and text with a customer, in one thread — with the transcript of each recorded call.
          <span class="freshness">· transcripts exist for recorded calls from 19 Jun 2026 onward</span></p>
      </div>
      <div class="cnv-wrap">
        <div class="cnv-side">
          <div class="cnv-search">
            <input id="cnvQ" type="search" placeholder="Name, phone or job #" value="${RSC.esc(CONV.S.q)}">
            <button id="cnvGo">Find</button>
          </div>
          <div class="cnv-hits" id="cnvHits"></div>
        </div>
        <div class="cnv-main" id="cnvMain"></div>
      </div>`;
    const q = host.querySelector("#cnvQ");
    const go = () => { CONV.S.q = q.value.trim(); CONV.search(host); };
    host.querySelector("#cnvGo").onclick = go;
    q.onkeydown = e => { if (e.key === "Enter") go(); };
    CONV.paintSide(host);
    CONV.paintMain(host);
    requestAnimationFrame(() => RSC.fit());
  },
});
