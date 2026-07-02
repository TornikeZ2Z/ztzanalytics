/* Source Identification — the source-attribution lineage for BOTH facts, shown
   separately. Moveboard: raw Source -> (Returned kept / Google-Local phone match)
   -> source_correction translate -> Post-Card state splitter -> Source Connector.
   Closing: Booked from + the lead's Source From Moveboard -> Corrected-Source
   8-branch SWITCH -> translate -> final Source. Answers "how did we end up with
   the source we show?" per job. (Closing lineage columns populate after the M1
   curated rebuild.) */
registerPage({
  id: "source-identification",
  group: "pulse",
  title: "Source Identification",
  async render(host) {
    const [mb, cl] = await Promise.all([RS.load("moveboard"), RS.load("closing")]);
    const esc = RSC.esc, nf = RS.fmtN;
    const val = v => (v == null || v === "") ? "—" : String(v);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Source Identification</h1>
        <p>How each job's source is attributed — from the raw value to what the report shows.
           Moveboard and the Closing Sheet resolve source <b>independently</b>.
           <span class="freshness">· respects the global filters</span></p>
      </div>
      <div class="rs-tabs">
        <button class="rs-tab on" data-t="mb">Moveboard source</button>
        <button class="rs-tab" data-t="cl">Closing Sheet source</button>
      </div>
      <div id="siBody"></div>`;

    const body = host.querySelector("#siBody");
    let tab = "mb";
    host.querySelectorAll(".rs-tab").forEach(b => b.onclick = () => {
      tab = b.dataset.t;
      host.querySelectorAll(".rs-tab").forEach(x => x.classList.toggle("on", x === b));
      draw();
    });

    // ---- helper: pipeline "stage" strip ----
    const stages = (items) => `<div class="si-flow">` + items.map((s, i) =>
      `<div class="si-stage"><div class="si-n">${s.n}</div><div class="si-l">${esc(s.l)}</div>` +
      (s.s ? `<div class="si-s">${esc(s.s)}</div>` : "") + `</div>` +
      (i < items.length - 1 ? `<div class="si-arrow">→</div>` : "")).join("") + `</div>`;

    // ---- lineage table: group by the ordered key columns, count, tag "how" ----
    const lineage = (rows, keys, howFn, headers) => {
      if (!rows.length) {
        return `<div class="panel" style="padding:18px;color:var(--muted)">No rows for the current filters.</div>`;
      }
      const g = {};
      rows.forEach(r => {
        const k = keys.map(c => val(r[c])).join(" ‖ ");
        (g[k] = g[k] || { row: r, n: 0 }); g[k].n++;
      });
      const list = Object.values(g).sort((a, b) => b.n - a.n);
      const total = rows.length || 1;
      const head = "<tr>" + headers.map((h, i) =>
        `<th class="${i === 0 ? "" : ""}">${esc(h)}</th>`).join("") +
        `<th>How</th><th>Jobs</th><th>%</th></tr>`;
      const bodyRows = list.slice(0, 400).map(o => {
        const cells = keys.map(c => `<td>${esc(val(o.row[c]))}</td>`).join("");
        const how = howFn(o.row);
        return `<tr>${cells}<td><span class="si-tag ${how.cls}">${esc(how.label)}</span></td>` +
          `<td>${nf(o.n)}</td><td>${(100 * o.n / total).toFixed(1)}%</td></tr>`;
      }).join("");
      const note = list.length > 400
        ? `<div style="color:var(--muted);font-size:11px;padding:6px 2px">showing 400 of ${nf(list.length)} distinct paths</div>` : "";
      return `<div class="tabwrap"><table class="tab si-tab"><thead>${head}</thead><tbody>${bodyRows}</tbody></table></div>${note}`;
    };

    function drawMoveboard() {
      const rows = RS.filtered("moveboard", mb);
      if (!rows.length) { body.innerHTML = `<div class="panel" style="padding:18px;color:var(--muted)">No leads for the current filters.</div>`; return; }
      const raw = c => rows.filter(c).length;
      const isPC = r => /^Post Card - /i.test(String(r["Source Connector"] || ""));
      const isGL = r => String(r["Source"]) === "Google Local" && String(r["Source Before Adjustment"]) !== "Google Local";
      const translated = r => val(r["Source"]) !== val(r["Source Before Adjustment"]) && !isGL(r);
      const distinctRaw = new Set(rows.map(r => val(r["Source Before Adjustment"]))).size;

      const how = r => {
        if (isPC(r)) return { label: "Post-Card state split", cls: "pc" };
        if (isGL(r)) return { label: "Google Local (phone match)", cls: "gl" };
        if (String(r["Source Before Adjustment"]) === "Returned Customer") return { label: "Returned Customer", cls: "rc" };
        if (translated(r)) return { label: "Translated", cls: "tr" };
        return { label: "Unchanged", cls: "un" };
      };

      body.innerHTML =
        stages([
          { n: nf(distinctRaw), l: "Raw sources", s: "Source (as entered)" },
          { n: nf(raw(isGL)), l: "Google Local", s: "phone-matched" },
          { n: nf(rows.filter(translated).length), l: "Translated", s: "via Source Translator" },
          { n: nf(raw(isPC)), l: "Post-Card split", s: "by state" },
        ]) +
        `<div class="panel"><div class="panel-head"><span class="panel-title">Moveboard source lineage</span>
           <span class="pm" style="margin-left:auto;color:var(--faint);font-size:11px">${nf(rows.length)} leads · raw → adjusted → connector</span></div>` +
        lineage(rows, ["Source Before Adjustment", "Source", "Source Connector"], how,
          ["Raw source", "After translate", "Source Connector (final)"]) + `</div>`;
    }

    function drawClosing() {
      const rows = RS.filtered("closing", cl).filter(r => r["Record Source"] !== "trip");
      const has = rows.length && ("Corrected Source" in rows[0]) && rows.some(r => r["Corrected Source"] != null);
      if (!has) {
        body.innerHTML = `<div class="panel" style="padding:20px;color:var(--muted);line-height:1.6">
          The closing source-lineage columns (<code>Booked From</code>, <code>Source From Moveboard</code>,
          <code>Corrected Source</code>) populate after the warehouse is rebuilt with the M1 source logic.
          Trigger a <b>Refresh</b> (or wait for the 6-hour cron), then this tab lights up.<br><br>
          Meanwhile the final <b>Source</b> is already correct on every other page.</div>`;
        return;
      }
      if (!rows.length) { body.innerHTML = `<div class="panel" style="padding:18px;color:var(--muted)">No jobs for the current filters.</div>`; return; }

      const bf = r => String(r["Booked From"] || ""), sfm = r => String(r["Source From Moveboard"] || ""), cs = r => String(r["Corrected Source"] || "");
      const how = r => {
        if (["Returned Customer", "Return Customer"].includes(bf(r))) return { label: "Returned override", cls: "rc" };
        if (bf(r) === "Recommended") return { label: "Recommended override", cls: "rc" };
        if (sfm(r) === "Google Local") return { label: "Google Local (from lead)", cls: "gl" };
        if (/Post Card/i.test(sfm(r))) return { label: "Post Card (from lead)", cls: "pc" };
        if (cs(r) && cs(r) === sfm(r) && cs(r) !== bf(r)) return { label: "From moveboard lead", cls: "mb" };
        return { label: "Booked-from", cls: "un" };
      };
      const cnt = f => rows.filter(f).length;
      const fromLead = cnt(r => cs(r) === sfm(r) && cs(r) && cs(r) !== bf(r)) + cnt(r => sfm(r) === "Google Local" || /Post Card/i.test(sfm(r)));

      body.innerHTML =
        stages([
          { n: nf(rows.length), l: "Closed jobs", s: "in scope" },
          { n: nf(cnt(r => ["Returned Customer", "Return Customer", "Recommended"].includes(bf(r)))), l: "Overrides", s: "Returned / Recommended" },
          { n: nf(fromLead), l: "From the lead", s: "Source From Moveboard" },
          { n: nf(new Set(rows.map(r => val(r["Source"]))).size), l: "Final sources", s: "after translate" },
        ]) +
        `<div class="panel"><div class="panel-head"><span class="panel-title">Closing Sheet source lineage</span>
           <span class="pm" style="margin-left:auto;color:var(--faint);font-size:11px">${nf(rows.length)} jobs · booked-from + lead → corrected → final</span></div>` +
        lineage(rows, ["Booked From", "Source From Moveboard", "Corrected Source", "Source"], how,
          ["Booked from (raw)", "Source From Moveboard", "Corrected Source (key)", "Final Source"]) + `</div>`;
    }

    function draw() { (tab === "mb" ? drawMoveboard : drawClosing)(); }
    draw();
  },
});
