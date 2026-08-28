/* PACKING CONTROL — what the load needed, against what the crew sold.
 *
 * Every move has a physical packing need: boxes to fill, furniture to wrap, mattresses to
 * cover. The calendar records that need item by item; the office sheet records what was
 * actually sold. Put them on one row and the difference is measurable — per job, and then
 * per foreman.
 *
 * WHY THE ENGINE LIVES HERE AND NOT IN THE MART. Every number on this page is a comparison
 * against peers, and "peers" depends on what is on screen: March, or the whole year, or one
 * book. A median baked nightly would silently answer a different question than the one the
 * filter bar is asking. So fct_packing_job ships the per-job facts and this file computes the
 * medians, the rank-sum test and the score for whatever window is selected.
 *
 * THE DISCIPLINE. Customers pack their own things all the time. It is legitimate, it depresses
 * a foreman's numbers through no fault of his, and it is the FIRST thing to rule out — which
 * is exactly what the confidence badge tests: self-packing lands at random, so it cannot
 * explain a shortfall that is foreman-specific, consistent, and present on several independent
 * measures. Single jobs are a spot-check queue. They are never evidence.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_packing_job) {
    // PAYLOAD CONTRACT: a column missing from this list never arrives, however well the page
    // is written. Anything the engine reads has to be named here.
    RS.DATASETS.fct_packing_job = {
      table: "fct_packing_job",
      cols: ["Job Code", "Day", "Customer", "Foreman", "Foreman Email", "Company",
             "Job Type", "Moving Type", "Foreman Typed",
             "Sold USD", "Quoted USD", "Real CF", "Sold CF", "Total Charge", "Recorded", "Itemised",
             "Boxes Sold", "Tape Sold", "Wrap Sold", "Covers Sold", "Item Lines",
             "Calendar CF", "Inv Boxes", "Inv Furniture", "Inv Wrappable", "Inv Mattresses",
             "Quoted Units", "Packed By Owner", "No Quote", "Has Inventory",
             "Packing Units", "USD per Unit", "USD per 100 CF", "Tape per Box",
             "Cover Cover Pct", "Wrap Cover Pct", "CF Ratio", "Zero Pack", "Quote Leak",
             "Flags", "Event Id", "Calendar Id", "Contract URL", "Calendar Only"],
    };
  }
})();

registerPage({
  id: "packing-control",
  title: "Packing Control",
  subtitle: "The packing each load needed, against what the crew sold — and who is out of line with everyone else.",
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

    /* ---------------------------------------------------------------- the dials
     * Kept together and named, because these are the numbers that decide whether a person's
     * name appears on a board about honesty. Changing one is a decision, not a tweak.
     */
    var DIAL = {
      flag: 12,        // concern score at or above this puts a foreman on the board
      minJobs: 10,     // fewer comparable jobs than this: a profile, never a judgement
      mwuN: 8,         // each side of the rank-sum test needs this many jobs
      minPeers: 3,     // below this many comparable foremen there is no fleet to compare with
      fdr: 0.05,       // false-discovery rate across every test on screen (Benjamini-Hochberg)
      boxesPerTape: 8, // one roll of tape covers about this many boxes
      cfUnder: 0.9,    // real CF below this share of the calendar's = under-reporting
      zeroUsd: 20,     // "booked nothing" -- the mart's own threshold, named here for the page
    };

    var S = window.__PK || (window.__PK = {
      rows: null, month: "", co: "", open: null, q: "", sort: "score", flagOnly: false,
      memo: null, memoKey: "",
      // "board" | "profile", and which man the profile is open on
      view: "board", fm: "", chkOnly: false,
    });

    /* ================================================================ THE ENGINE
     * Three pure functions. Exposed on window.PKENG so they can be exercised directly with
     * synthetic data — a scoring rule that has never been run against a known answer is a
     * rule nobody should be judged by.
     */
    function median(xs) {
      var v = xs.filter(function (x) { return x != null && isFinite(x); }).sort(function (a, b) { return a - b; });
      if (!v.length) return null;
      var n = v.length;
      return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
    }

    function mean(xs) {
      var v = xs.filter(function (x) { return x != null && isFinite(x); });
      if (!v.length) return null;
      return v.reduce(function (a, x) { return a + x; }, 0) / v.length;
    }

    function erfc(x) {
      // Numerical Recipes' rational approximation — |error| < 1.2e-7, which is four orders
      // finer than any p-value threshold on this page.
      var z = Math.abs(x), t = 1 / (1 + z / 2);
      var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
        t * (-0.82215223 + t * 0.17087277)))))))));
      return x >= 0 ? r : 2 - r;
    }

    /* One-sided tie-corrected Mann-Whitney U: is sample `a` shifted BELOW sample `b`?
     * This is the brake on false accusations. A low median alone means nothing — one bad week
     * drags an average. This asks whether the whole distribution sits low. Returns null when
     * either side is too small to say anything, and "too small to say" must never render as
     * "clean". */
    function mwu(a, b) {
      a = a.filter(function (x) { return x != null && isFinite(x); });
      b = b.filter(function (x) { return x != null && isFinite(x); });
      if (a.length < DIAL.mwuN || b.length < DIAL.mwuN) return null;
      var pooled = a.map(function (v) { return [v, 0]; }).concat(b.map(function (v) { return [v, 1]; }));
      pooled.sort(function (x, y) { return x[0] - y[0]; });
      var n = pooled.length, i = 0, ra = 0, tie = 0;
      while (i < n) {
        var j = i;
        while (j + 1 < n && pooled[j + 1][0] === pooled[i][0]) j++;
        var rank = (i + j) / 2 + 1, t = j - i + 1;
        for (var k = i; k <= j; k++) if (pooled[k][1] === 0) ra += rank;
        if (t > 1) tie += t * t * t - t;
        i = j + 1;
      }
      var na = a.length, nb = b.length;
      var u = ra - na * (na + 1) / 2;
      var mu = na * nb / 2;
      var sd2 = na * nb / 12 * ((n + 1) - tie / (n * (n - 1)));
      if (!(sd2 > 0)) return null;
      var z = (u - mu + 0.5) / Math.sqrt(sd2);     // continuity-corrected, lower tail
      return 0.5 * erfc(-z / Math.SQRT2);
    }

    /* THE MEASURES. Every one is peer-relative: the score is entirely "how does he compare
     * with the other foremen on this", with no absolute thresholds anywhere. An earlier build
     * charged the zero-booking rate and the cubic-feet ratio against fixed constants, and
     * simulation showed what that does -- hold twelve foremen identical and raise the FLEET's
     * own zero-booking rate from 10% to 45%, and the number of them above the concern line
     * goes from three to all twelve, with nobody having changed his behaviour.
     *
     * `group` is the multiplicity guard. The two money measures share a numerator (one Sold
     * USD over two different denominators) and their p-values correlate at about r = 0.93, so
     * counting them as two independent confirmations counts one fact twice. Signals are
     * counted once per group, never once per measure.
     */
    var MEASURES = [
      { k: "USD per 100 CF", lab: "$ per 100 CF", w: 30, fmt: "usd", group: "rate",
        help: "Packing sold per 100 cubic feet moved, over the jobs where he sold something." },
      { k: "USD per Unit", lab: "$ per packing unit", w: 30, fmt: "usd", group: "rate",
        help: "Packing sold per box and wrappable piece on the truck. Corrects for load size." },
      // stat:"mean": a median of a 0/1 column can only ever print 0% or 100%, which put
      // "100% jobs that booked · fleet 100%" beside "26% booked nothing at all" on one
      // screen. The SHARE is the honest number, it makes this term of the score smooth
      // instead of a step, and the rank-sum test is untouched (it reads the raw 0/1 jobs).
      { k: "Booked Anything", lab: "Jobs that sold packing", w: 15, fmt: "pct", group: "booked", stat: "mean",
        help: "Share of his jobs where any packing at all was sold." },
      { k: "CF Ratio", lab: "CF vs the calendar", w: 15, fmt: "num", group: "cf",
        help: "Cubic feet the crew reported against what the calendar recorded." },
      { k: "Cover Cover Pct", lab: "Mattress covers", w: 10, fmt: "pct", group: "covers",
        help: "Share of the mattresses on the truck that got a cover." },
      { k: "Wrap Cover Pct", lab: "Shrink wrap", w: 5, fmt: "pct", group: "wrap",
        help: "Share of wrappable pieces that got wrap." },
      { k: "Tape per Box", lab: "Tape per box", w: 5, fmt: "num", group: "tape",
        help: "Rolls sold per box on the truck. One roll covers about " + DIAL.boxesPerTape + "." },
    ];
    var SCALE = MEASURES.reduce(function (a, m) { return a + m.w; }, 0);

    /* Benjamini-Hochberg across every test on screen.
     *
     * This is the correction the board cannot do without. Seven tests per foreman across
     * twenty of them is well over a hundred chances for an ordinary man to look unusual, and a
     * simulation of a null world -- everyone drawn from one distribution, nobody doing
     * anything wrong -- put at least one innocent foreman on the strongest badge in 71% of
     * runs. Controlling the false-discovery rate over the whole screen, rather than testing
     * each man as though he were the only one being looked at, is what makes the badge mean
     * what it says.
     */
    function bhCutoff(ps, q) {
      var v = ps.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
      var m = v.length, cut = 0;
      for (var i = 0; i < m; i++) if (v[i] <= (i + 1) / m * q) cut = v[i];
      return cut;                        // 0 means nothing survives, which is a real answer
    }

    /* Per foreman: the profile, the score, and how far it can be trusted. */
    function rollup(jobs) {
      // Only jobs that were actually written up can be compared. A job the office has not
      // closed out is not a job the crew got wrong.
      var live = jobs.filter(function (r) { return !r["Packed By Owner"] && r["Recorded"]; });
      var by = {};
      live.forEach(function (r) {
        var f = r.Foreman;
        if (!f) return;
        (by[f] || (by[f] = [])).push(r);
      });
      function col(rs, k) { return rs.map(function (r) { return r[k]; }); }

      var names = Object.keys(by).sort();
      var others = {};
      names.forEach(function (name) {
        var o = [];
        names.forEach(function (x) { if (x !== name) o = o.concat(by[x]); });
        others[name] = o;
      });

      // LEAVE ONE OUT. The baseline a man is scored against has to be the one he is tested
      // against. Scoring him against a fleet median that includes his own jobs, while the
      // rank-sum test compared him with a pool that excluded them, had the score and the test
      // answering two different questions -- and on a heavily tied measure the card could
      // report a shortfall the test had just declined to confirm.
      var fleetEx = {}, fleetAll = {};
      var statOf = function (m, xs) { return m.stat === "mean" ? mean(xs) : median(xs); };
      MEASURES.forEach(function (m) {
        fleetAll[m.k] = statOf(m, col(live, m.k));
        fleetEx[m.k] = {};
        names.forEach(function (name) { fleetEx[m.k][name] = statOf(m, col(others[name], m.k)); });
      });

      // pass one: every p-value on screen, so the correction can see them all at once
      var raw = names.map(function (name) {
        var rs = by[name], ps = {}, med = {}, cnt = {}, tested = 0;
        MEASURES.forEach(function (m) {
          var mine = col(rs, m.k);
          med[m.k] = statOf(m, mine);
          cnt[m.k] = mine.filter(function (x) { return x != null; }).length;
          ps[m.k] = mwu(mine, col(others[name], m.k));
          if (ps[m.k] != null) tested++;
        });
        return { name: name, rs: rs, ps: ps, med: med, cnt: cnt, tested: tested };
      });
      var allP = [];
      raw.forEach(function (r) { MEASURES.forEach(function (m) { allP.push(r.ps[m.k]); }); });
      var cut = bhCutoff(allP, DIAL.fdr);

      return raw.map(function (r) {
        var name = r.name, rs = r.rs, n = rs.length, med = r.med, ps = r.ps;
        var fleet = {};
        MEASURES.forEach(function (m) { fleet[m.k] = fleetEx[m.k][name]; });

        // A measure is only charged for if it could be compared. Covers exist only on jobs
        // carrying mattresses and tape only on jobs carrying boxes, so a man with ten jobs can
        // have a "median" cover rate resting on two of them -- which used to be worth ten
        // points. The bar is the one the rank-sum test uses: what we would not test, we do not
        // charge for.
        var scoredOn = 0, score = 0, maxScore = 0;
        MEASURES.forEach(function (m) {
          var f = fleet[m.k], v = med[m.k];
          if (!f || f <= 0 || v == null || r.cnt[m.k] < DIAL.mwuN) return;
          scoredOn++;
          maxScore += m.w;
          score += Math.max(0, Math.min(1, (f - v) / f)) * m.w;
        });
        // scored out of what could actually be measured, then put back on the full scale, so
        // two foremen with different measurable job mixes still sit on one axis
        if (maxScore > 0) score = score / maxScore * SCALE;

        // A SIGNAL is: survives the false-discovery correction, sits below the leave-one-out
        // baseline, and is counted once per group so correlated measures cannot vote twice.
        var seen = {}, below = 0, lowKeys = [];
        MEASURES.forEach(function (m) {
          if (ps[m.k] == null || cut <= 0 || ps[m.k] > cut) return;
          if (med[m.k] == null || fleet[m.k] == null || med[m.k] >= fleet[m.k]) return;
          lowKeys.push(m.lab);
          if (!seen[m.group]) { seen[m.group] = 1; below++; }
        });
        var bestP = null;
        MEASURES.forEach(function (m) {
          if (ps[m.k] != null && (bestP == null || ps[m.k] < bestP)) bestP = ps[m.k];
        });
        var tested = r.tested;

        var conf = !tested ? "THIN" : below >= 2 ? "STRONG" : below === 1 ? "WEAK" : "NORMAL";
        // No peers, no score: filter down to one book in one month and a lone foreman becomes
        // his own baseline, with nobody left to be below.
        var scored = n >= DIAL.minJobs && names.length >= DIAL.minPeers && scoredOn > 0;

        // rough size of what may be going unrecorded: the per-unit gap, over the units handled
        var opp = 0;
        if (scored && fleet["USD per Unit"] && med["USD per Unit"] != null) {
          var gap = fleet["USD per Unit"] - med["USD per Unit"];
          if (gap > 0) rs.forEach(function (r) { opp += gap * (r["Packing Units"] || 0); });
        }

        // The verdict must be read off the SAME number the card prints. Judging the raw
        // float while displaying the rounded one put "score 12 - in line" on a board whose
        // own note says the line is 12, and a board that contradicts itself is not believed.
        var shown = scored ? Math.round(score) : null;
        var verdict = !scored ? "thin"
          : (shown >= DIAL.flag && conf === "STRONG") ? "review"
          : shown >= DIAL.flag ? "look"
          : conf === "THIN" ? "untested" : "ok";

        return {
          name: name, jobs: rs, n: n, med: med, ps: ps, below: below, bestP: bestP,
          score: shown, conf: conf, verdict: verdict, tested: tested,
          scoredOn: scoredOn, peers: names.length, lowKeys: lowKeys, cut: cut,
          zeroRate: n ? rs.filter(function (r) { return r["Zero Pack"]; }).length / n : 0,
          opp: opp, fleet: fleet, fleetAll: fleetAll,
          all: jobs.filter(function (r) { return r.Foreman === name; }),
          sold: rs.reduce(function (a, r) { return a + (+r["Sold USD"] || 0); }, 0),
          quoted: rs.reduce(function (a, r) { return a + (+r["Quoted USD"] || 0); }, 0),
          units: rs.reduce(function (a, r) { return a + (+r["Packing Units"] || 0); }, 0),
          selfPacked: jobs.filter(function (r) { return r.Foreman === name && r["Packed By Owner"]; }).length,
        };
      });
    }
    window.PKENG = { median: median, mean: mean, mwu: mwu, rollup: rollup, MEASURES: MEASURES, DIAL: DIAL };

    /* ================================================================ formatting */
    // the NJ calendar day, not the browser's UTC one -- an evening reader must not see
    // today's jobs stamped "upcoming"
    var TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    var WEEK_AGO = new Date(Date.now() - 7 * 864e5)
      .toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    // what the Upcoming view owns: everything from today forward, PLUS a calendar-only job
    // from the last 7 days. That job happened, no office-sheet row exists yet, and no other
    // view can show it (the evidence views rightly refuse rows with no sheet) -- without
    // this it would vanish from the whole page at midnight, unchecked.
    function isUpcoming(r) {
      if (!r.Day) return false;
      if (r.Day >= TODAY) return true;
      return !!r["Calendar Only"] && r.Day >= WEEK_AGO;
    }
    /* THE CLICK-THROUGHS. Every job row can open the calendar event behind it (the eid is
     * base64 of "eventId calendarId" -- Google's own deep-link format), and the digital
     * contract where one exists, shown by its FILE ID (the full id is on the tooltip). */
    function calHref(r) {
      if (!r["Event Id"] || !r["Calendar Id"]) return null;
      try {
        return "https://calendar.google.com/calendar/event?eid="
          + btoa(r["Event Id"] + " " + r["Calendar Id"])
            .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
      } catch (e) { return null; }
    }
    function dcFileId(r) {
      var m = String(r["Contract URL"] || "").match(/\/d\/([A-Za-z0-9_-]{10,})/);
      return m ? m[1] : null;
    }
    function jobLinks(r) {
      var h = "", c = calHref(r);
      // the contract URL is our own Drive listing, but an href scheme is not a place for trust
      var fid = /^https:\/\//i.test(String(r["Contract URL"] || "")) ? dcFileId(r) : null;
      if (c) h += '<a target="_blank" rel="noopener" href="' + c + '">event ↗</a>';
      if (fid) h += (h ? " · " : "")
        + '<a class="pk-fid" target="_blank" rel="noopener" href="' + esc(r["Contract URL"])
        + '" title="digital contract · file id ' + esc(fid) + '">' + esc(fid.slice(0, 10)) + '…</a>';
      return h || '<span style="color:var(--faint)">—</span>';
    }
    var usd = function (v, d) {
      return v == null || !isFinite(v) ? "—" :
        "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d });
    };
    var pct = function (v) { return v == null || !isFinite(v) ? "—" : Math.round(v * 100) + "%"; };
    var num = function (v, d) { return v == null || !isFinite(v) ? "—" : (+v).toFixed(d == null ? 2 : d); };
    function fmtM(m, v) { return m.fmt === "usd" ? usd(v, 2) : m.fmt === "pct" ? pct(v) : num(v); }
    function monthOf(d) { return String(d || "").slice(0, 7); }
    function dayLab(d) {
      if (!d) return "—";
      var p = String(d).slice(0, 10).split("-");
      return p[2] + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1];
    }
    var VERDICT = {
      review:   { lab: "Needs review",    cls: "v-review" },
      look:     { lab: "Worth a look",    cls: "v-look" },
      ok:       { lab: "In line",         cls: "v-ok" },
      untested: { lab: "Not enough data", cls: "v-thin" },
      thin:     { lab: "Too few jobs",    cls: "v-thin" },
    };

    /* ================================================================ style
     * SEVERITY IS COLOUR, CERTAINTY IS TEXTURE. The two things a reader must not confuse are
     * "how far out of line" and "how sure are we" — so they use different channels entirely:
     * the verdict carries the hue, the confidence badge carries a fill pattern. A weak signal
     * can never borrow the visual weight of a strong one.
     */
    host.innerHTML = '<style id="pkCss">'
      + ".pk{--t1:27px;--t2:15px;--t3:13.5px;--t4:12.5px;--t5:12px;--t6:10.5px;max-width:none;"
      + "font-variant-numeric:tabular-nums}"
      + ".pk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}"
      + ".pk-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".pk-kpi b{display:block;font-size:var(--t1);letter-spacing:-.6px;line-height:1.1}"
      + ".pk-kpi span{display:block;font-size:var(--t6);font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".pk-kpi small{display:block;font-size:var(--t5);color:var(--muted);margin-top:3px}"
      + ".pk-kpi.neg b{color:var(--neg)} .pk-kpi.warn b{color:var(--warn)} .pk-kpi.pos b{color:var(--pos)}"
      // ---- tabs + the foreman file ----
      + ".pk-tabs{display:flex;gap:4px;margin:2px 0 16px}"
      + ".pk-tabs button{font:inherit;font-size:13.5px;font-weight:750;color:var(--muted);background:transparent;"
      + "border:0;border-radius:10px;padding:9px 16px;cursor:pointer}"
      + ".pk-tabs button:hover{background:var(--panel-2);color:var(--ink)}"
      + ".pk-tabs button.on{background:var(--brand);color:var(--brand-ink)}"
      + ".pk-dim{font-size:var(--t4);color:var(--faint)}"
      + ".pk-dim2{font-size:var(--t5);color:var(--faint);line-height:1.55;margin:0 0 10px;display:block}"
      + ".pk-pcard{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;"
      + "background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--line-2);"
      + "border-radius:16px;padding:18px 22px;margin-bottom:14px}"
      + ".pk-pcard.v-review{border-left-color:var(--neg)} .pk-pcard.v-look{border-left-color:var(--warn)}"
      + ".pk-pcard.v-ok{border-left-color:var(--pos)} .pk-pcard.v-thin{border-left-color:var(--line-2)}"
      + ".pk-pid{display:flex;align-items:center;gap:15px;min-width:0}"
      + ".pk-av{flex:0 0 auto;width:54px;height:54px;border-radius:50%;background:var(--brand);color:var(--brand-ink);"
      + "display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;letter-spacing:.5px}"
      + ".pk-pid h2{margin:0 0 6px;font-size:25px;font-weight:800;letter-spacing:-.5px;line-height:1.15}"
      + ".pk-chips{display:flex;flex-wrap:wrap;gap:6px}"
      + ".pk-chip{font-size:var(--t5);font-weight:700;color:var(--muted);background:var(--panel-2);"
      + "border:1px solid var(--line-2);border-radius:999px;padding:3px 10px}"
      + ".pk-pscore{text-align:right;flex:0 0 auto}"
      + ".pk-pscore b{display:block;font-size:42px;font-weight:800;letter-spacing:-1.5px;line-height:1}"
      + ".pk-pscore b.na{color:var(--faint)}"
      + ".pk-pscore span{display:block;font-size:var(--t3);font-weight:800;margin-top:4px}"
      + ".pk-pscore small{display:block;font-size:var(--t6);font-weight:800;letter-spacing:.06em;color:var(--faint);margin-top:3px}"
      + ".pk-sec{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:14px}"
      + ".pk-sec h4{margin:0 0 4px;font-size:var(--t2);font-weight:800}"
      + ".pk-sec h4 .pk-dim{font-weight:600;margin-left:6px}"
      // NARROW ADJUSTMENTS TO THE KIT TABLE, and nothing more. The table, its header, the
      // right-aligned .num column and the pills inside it all come from rs.css; what stays
      // here is only what this page's evidence tables need on top of it — a cell that carries
      // a second explanatory line reads top-aligned, and the gap / significance tints are this
      // page's own reading of a row.
      // TOP-ALIGN ONLY THE CELLS THAT WRAP. Applied to every td it was harmless while rows
      // were 40px; once the kit gave rows room to breathe (2026-08-24) a single-line number
      // pinned to the top of a 56px row and left a visible band under it. A cell with a
      // <small> sub-line still has to start at the top, so it keeps it by name.
      + ".pk .rs-table td:has(small){vertical-align:top}"
      + ".pk .rs-table td small{display:block;font-weight:500;margin-top:2px;max-width:400px}"
      + ".pk .rs-table td.pk-neg{color:var(--neg);font-weight:700}"
      + ".pk .rs-table td.pk-pos{color:var(--pos);font-weight:700}"
      + ".pk .rs-table tr.pk-sig td{background:color-mix(in srgb,var(--neg) 8%,transparent)}"
      // a row the comparison set aside: present as evidence, faded because it is not counted
      + ".pk .rs-table tr.pk-aside td{color:var(--faint)}"
      + ".pk-mrow{display:grid;grid-template-columns:120px 60px 90px 92px 92px 1fr;gap:10px;align-items:center;"
      + "padding:7px 2px;border-bottom:1px solid var(--line);font-size:var(--t4)}"
      + ".pk-mrow:last-child{border-bottom:0}"
      + ".pk-mhead{font-size:var(--t6);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);border-bottom:1px solid var(--line)}"
      + ".pk-mrow .r{text-align:right}.pk-mrow .neg b{color:var(--neg)}"
      + ".pk-mbar{position:relative;height:9px;border-radius:5px;background:var(--panel-2);overflow:visible;min-width:80px}"
      + ".pk-mbar i{display:block;height:100%;border-radius:5px}"
      + ".pk-mbar i.lo{background:var(--neg)} .pk-mbar i.hi{background:var(--pos)}"
      // the others' rate as a marker on his own bar: one glance says over or under
      + ".pk-mbar u{position:absolute;top:-3px;width:2px;height:15px;background:var(--ink);opacity:.55}"
      // a cap on the kit scroller: the evidence tables are long by nature and must not push
      // the section below them off the screen
      + ".pk-jwrap{max-height:520px}"
      + ".pk-dhact{display:flex;align-items:center;gap:8px;flex:0 0 auto}"
      // THE CONTROL BAR COMES FROM THE KIT. .rs-bar / .rs-fld / .rs-sel / .rs-inp / .rs-seg /
      // .rs-tog / .rs-btn used to be copied out here under pk- names; they are one vocabulary
      // now, and the only thing this page still says about the bar is where it sits — under
      // the KPI strip, which carries no bottom margin of its own.
      + ".pk .rs-bar{margin:16px 0 10px}"
      // the job-check "what to check" column: a reason line that may wrap, beside numbers
      // that may not
      + ".pk-why{font-size:var(--t5);color:var(--muted);line-height:1.45;min-width:220px;max-width:380px;white-space:normal}"
      + ".pk-load{white-space:nowrap;color:var(--muted)}"
      // the kit gives links inside .rs-table their look; the drawer table and the spot-check
      // queue are this page's own components, so they carry it themselves
      + ".pk-tbl a,.pk-q a{color:var(--blue);text-decoration:none;font-weight:700;"
      + "font-size:var(--t5);white-space:nowrap}"
      + ".pk-tbl a:hover,.pk-q a:hover{text-decoration:underline}"
      + "a.pk-fid{font-family:ui-monospace,Consolas,monospace;font-size:10.5px}"
      // the board
      + ".pk-grid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start}"
      + "@media(max-width:1100px){.pk-grid{grid-template-columns:minmax(0,1fr)}}"
      + ".pk-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;"
      + "padding:14px 16px 14px 18px;margin-bottom:10px;cursor:pointer;position:relative;overflow:hidden;"
      + "transition:border-color .12s,transform .12s}"
      + ".pk-card:hover{border-color:var(--line-2);transform:translateX(1px)}"
      + ".pk-card.sel{border-color:var(--blue)}"
      + ".pk-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--line-2)}"
      + ".pk-card.v-review::before{background:var(--neg)} .pk-card.v-look::before{background:var(--warn)}"
      + ".pk-card.v-ok::before{background:var(--pos)} .pk-card.v-thin::before{background:var(--line-2)}"
      // the drawer Reading panel is handed the same v-* verdict class, which had no rule
      // at all -- severity never reached the one panel that states the accusation
      + ".pk-read{border:1px solid var(--line-2);border-left-width:4px;border-radius:10px;padding:10px 13px}"
      + ".pk-read.v-review{border-left-color:var(--neg)} .pk-read.v-look{border-left-color:var(--warn)}"
      + ".pk-read.v-ok{border-left-color:var(--pos)} .pk-read.v-thin{border-left-color:var(--line-2)}"
      + ".pk-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}"
      + ".pk-name{font-size:var(--t2);font-weight:750;letter-spacing:-.2px}"
      + ".pk-sub{font-size:var(--t5);color:var(--faint);margin-left:auto;text-align:right;white-space:nowrap}"
      + ".pk-pill{font-size:var(--t6);font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "padding:3px 8px;border-radius:999px;border:1px solid}"
      + ".v-review .pk-pill{color:var(--neg);border-color:var(--neg);background:var(--neg-bg)}"
      + ".v-look .pk-pill{color:var(--warn);border-color:var(--warn);background:var(--warn-bg)}"
      + ".v-ok .pk-pill{color:var(--pos);border-color:var(--pos);background:var(--pos-bg)}"
      + ".v-thin .pk-pill{color:var(--faint);border-color:var(--line-2)}"
      // CERTAINTY = TEXTURE. same neutral ink, different fill; never competes with severity.
      + ".pk-conf{font-size:var(--t6);font-weight:800;letter-spacing:.05em;padding:3px 8px;border-radius:999px;"
      + "border:1px solid var(--line-2);color:var(--muted)}"
      + ".pk-conf.c-strong{color:var(--ink);border-color:var(--ink);"
      + "background:repeating-linear-gradient(135deg,transparent 0 3px,color-mix(in srgb,var(--ink) 22%,transparent) 3px 6px)}"
      + ".pk-conf.c-weak{background:repeating-linear-gradient(135deg,transparent 0 5px,"
      + "color-mix(in srgb,var(--muted) 16%,transparent) 5px 7px)}"
      + ".pk-conf.c-thin{border-style:dashed}"
      // the peer-delta bars: fleet median is the centre line, the foreman is the marker
      + ".pk-bars{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px 16px;margin-top:12px}"
      + ".pk-b label{display:flex;justify-content:space-between;font-size:var(--t6);color:var(--faint);"
      + "text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:4px}"
      + ".pk-b label b{color:var(--muted);font-weight:800}"
      + ".pk-track{position:relative;height:7px;background:var(--panel-2);border:1px solid var(--line);border-radius:4px}"
      + ".pk-track i{position:absolute;top:-1px;bottom:-1px;width:2px;background:var(--line-2);left:50%}"
      + ".pk-track u{position:absolute;top:0;bottom:0;border-radius:3px}"
      + ".pk-track u.lo{background:var(--neg)} .pk-track u.hi{background:var(--pos)}"
      + ".pk-track.na{opacity:.35}"
      // side rail
      + ".pk-rail{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px}"
      + ".pk-rail h4{margin:0 0 10px;font-size:var(--t6);font-weight:800;letter-spacing:.08em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".pk-row{display:flex;justify-content:space-between;gap:10px;font-size:var(--t4);padding:5px 0;"
      + "border-bottom:1px solid var(--line)}"
      + ".pk-row:last-child{border-bottom:0}"
      + ".pk-row b{font-weight:700}"
      + ".pk-q{border:0;background:none;text-align:left;width:100%;color:inherit;font:inherit;cursor:pointer;"
      + "padding:8px 0;border-bottom:1px solid var(--line);display:block}"
      + ".pk-q:last-child{border-bottom:0}"
      + ".pk-q:hover{color:var(--blue)}"
      + ".pk-q em{display:block;font-style:normal;font-size:var(--t5);color:var(--neg);margin-top:2px}"
      + ".pk-q span{font-size:var(--t5);color:var(--faint)}"
      // drawer
      + ".pk-scrim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:60;opacity:0;pointer-events:none;transition:opacity .18s}"
      + ".pk-scrim.on{opacity:1;pointer-events:auto}"
      + ".pk-draw{position:fixed;top:0;right:0;bottom:0;width:min(760px,50vw);background:var(--bg);"
      + "border-left:1px solid var(--line-2);z-index:61;transform:translateX(100%);transition:transform .22s ease;"
      + "display:flex;flex-direction:column}"
      + "@media(max-width:900px){.pk-draw{width:100vw}}"
      + ".pk-draw.on{transform:none}"
      + ".pk-dh{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;gap:12px}"
      + ".pk-dh h3{margin:0;font-size:20px;letter-spacing:-.3px}"
      + ".pk-dh p{margin:3px 0 0;font-size:var(--t5);color:var(--faint)}"
      + ".pk-x{margin-left:auto;background:none;border:1px solid var(--line);color:var(--muted);border-radius:9px;"
      + "width:30px;height:30px;font-size:16px;cursor:pointer;line-height:1;flex:none}"
      + ".pk-x:hover{color:var(--ink);border-color:var(--line-2)}"
      + ".pk-db{padding:16px 20px 40px;overflow:auto;flex:1;min-height:0}"
      // the drawer body could never scroll: .pk-draw is the flex column, but the content is
      // injected into #pkDrawIn -- a plain div between them with no height of its own -- so
      // flex:1 / overflow:auto on .pk-db had no box to work against
      + "#pkDrawIn{display:flex;flex-direction:column;height:100%;min-height:0}"
      // border-left-width restated: this later shorthand was silently resetting the 4px
      // severity accent the earlier .pk-read rule promises
      + ".pk-read{background:var(--panel);border:1px solid var(--line);border-radius:12px;"
      + "padding:14px 16px;margin-bottom:14px;border-left-width:4px}"
      + ".pk-read h5{margin:0 0 8px;font-size:var(--t6);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}"
      + ".pk-read p{margin:0 0 9px;font-size:var(--t3);line-height:1.6;color:var(--ink)}"
      + ".pk-read p:last-child{margin-bottom:0}"
      + ".pk-cause{display:flex;gap:10px;font-size:var(--t4);line-height:1.55;padding:8px 0;border-top:1px solid var(--line)}"
      + ".pk-cause b{flex:none;width:18px;height:18px;border-radius:5px;background:var(--line);color:var(--muted);"
      + "font-size:var(--t6);display:grid;place-items:center;margin-top:1px}"
      + ".pk-cause span{color:var(--muted)}.pk-cause span i{font-style:normal;color:var(--ink);font-weight:650}"
      + ".pk-tbl{width:100%;border-collapse:collapse;font-size:var(--t4)}"
      + ".pk-tbl th{text-align:right;font-size:var(--t6);letter-spacing:.05em;text-transform:uppercase;"
      + "color:var(--faint);font-weight:800;padding:6px 8px;border-bottom:1px solid var(--line-2);position:sticky;top:0;background:var(--bg)}"
      + ".pk-tbl th:first-child,.pk-tbl td:first-child{text-align:left}"
      + ".pk-tbl td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}"
      + ".pk-tbl tr.f td{background:var(--neg-bg)}"
      + ".pk-tbl tr.sp td{opacity:.5}"
      + ".pk-tbl em{font-style:normal;color:var(--neg);font-size:var(--t5)}"
      + ".pk-spark{display:flex;align-items:flex-end;gap:3px;height:44px;margin-top:6px}"
      + ".pk-spark div{flex:1;border-radius:2px 2px 0 0;background:var(--line-2);position:relative;min-height:2px}"
      + ".pk-spark div.hot{background:var(--neg)} .pk-spark div.mid{background:var(--warn)}"
      + ".pk-spark div.cool{background:var(--pos)}"
      + ".pk-sparkx{display:flex;gap:3px;font-size:8.5px;color:var(--faint);margin-top:3px}"
      + ".pk-sparkx span{flex:1;text-align:center}"
      + ".pk-empty{padding:34px;text-align:center;color:var(--faint);font-size:var(--t3);"
      + "background:var(--panel);border:1px solid var(--line);border-radius:14px}"
      + "</style>"
      + '<div class="pk"><div id="pkMain"></div></div>'
      + '<div class="pk-scrim" id="pkScrim"></div>'
      + '<div class="pk-draw" id="pkDraw"><div id="pkDrawIn"></div></div>';

    var main = host.querySelector("#pkMain");
    var scrim = host.querySelector("#pkScrim");
    var draw = host.querySelector("#pkDraw");

    /* ================================================================ data */
    main.innerHTML = '<div class="pk-empty">Loading packing records…</div>';
    RS.load("fct_packing_job").then(function (rows) {
      S.rows = (rows || []).map(function (r) {
        // the bridge ships DECIMALs as strings; every comparison below is numeric
        ["Sold USD", "Quoted USD", "Real CF", "Sold CF", "Total Charge", "Calendar CF",
         "USD per Unit", "USD per 100 CF", "Tape per Box", "Cover Cover Pct", "Wrap Cover Pct",
         "CF Ratio"].forEach(function (k) {
          r[k] = r[k] == null || r[k] === "" ? null : +r[k];
          if (r[k] != null && !isFinite(r[k])) r[k] = null;
        });
        ["Boxes Sold", "Tape Sold", "Wrap Sold", "Covers Sold", "Item Lines", "Inv Boxes",
         "Inv Furniture", "Inv Wrappable", "Inv Mattresses", "Quoted Units", "Packing Units",
         "Packed By Owner", "No Quote", "Has Inventory", "Zero Pack", "Quote Leak",
         "Recorded", "Itemised", "Calendar Only"].forEach(function (k) {
          r[k] = r[k] == null || r[k] === "" ? null : +r[k];
        });
        r.Day = String(r.Day || "").slice(0, 10);
        // A job that booked nothing has no RATE -- it has an absence, and an absence belongs
        // in its own measure rather than entering the two money medians as a literal $0.
        // Leaving the zeros in made the score a step function: it more than doubled the moment
        // over half a foreman's jobs booked nothing, because a median of mostly-zeros is zero.
        r["Booked Anything"] = !r["Recorded"] ? null : (r["Zero Pack"] ? 0 : 1);
        if (r["Zero Pack"]) { r["USD per 100 CF"] = null; r["USD per Unit"] = null; }
        return r;
      });
      invalidate();
      paint();
    }).catch(function (e) {
      main.innerHTML = '<div class="pk-empty">Could not load packing records — ' + esc(e && e.message || e) + "</div>";
    });

    function invalidate() { S.memo = null; S.memoKey = ""; }

    function view() {
      return S.rows.filter(function (r) {
        if (S.month && monthOf(r.Day) !== S.month) return false;
        if (S.co && (r.Company || "—") !== S.co) return false;
        return true;
      });
    }

    /* ================================================================ paint */
    function paint() {
      if (!S.rows) return;
      if (["board", "jobs", "profile", "future"].indexOf(S.view) < 0) S.view = "board";
      var rows = view();
      // THE FUTURE IS NOT EVIDENCE. The office sheet carries pre-filled rows for jobs that
      // have not happened yet -- money on a job the crew has not driven to says nothing
      // about the crew (Tornike, 2026-08-19). Everything dated after today lives in the
      // Upcoming tab and NOWHERE else: not in a comparison, not in a month row, not in the
      // evidence tables. This also puts the newest DONE job at the top of every list.
      var here = rows.filter(function (r) {
        return !r["Calendar Only"] && (!r.Day || r.Day <= TODAY);
      });
      // The engine is ~140 rank-sum tests over every job in the window. The name box and the
      // sort buttons change WHICH profiles are shown, never what they contain -- so the result
      // is cached against the only two inputs that can change it.
      var key = S.month + "|" + S.co;
      if (S.memoKey !== key || !S.memo) { S.memo = rollup(here); S.memoKey = key; }
      var profiles = S.memo;
      var fleet = profiles.length ? profiles[0].fleetAll : {};

      var sold = here.reduce(function (a, r) { return a + (+r["Sold USD"] || 0); }, 0);
      var flagged = profiles.filter(function (p) { return p.score != null && p.score >= DIAL.flag; });
      var strong = flagged.filter(function (p) { return p.conf === "STRONG"; });
      var opp = flagged.reduce(function (a, p) { return a + p.opp; }, 0);
      var invPct = here.length ? here.filter(function (r) { return r["Has Inventory"]; }).length / here.length : 0;

      var months = {}, cos = {};
      S.rows.forEach(function (r) { if (r.Day) months[monthOf(r.Day)] = 1; cos[r.Company || "—"] = 1; });
      var mList = Object.keys(months).sort();

      /* THE PAGE SAYS WHAT IT IS. It opened straight onto five bare numbers with no title and
       * no sentence — every other report in the portal introduces itself, and in a room full of
       * people this one arrived mid-thought (Tornike, before presenting it, 2026-08-12). */
      var html = '<div class="rs-page-head"><h1>Packing Control</h1>'
        + "<p>The packing each load actually needed, against what the crew sold — and who is "
        + "out of line with everyone else."
        + '<span class="freshness"> · every measure is a comparison with the other foremen, '
        + "never against a fixed target</span></p></div>"
        + '<div class="pk-tabs">'
        + '<button data-v="board" class="' + (S.view === "board" ? "on" : "") + '">The board</button>'
        + '<button data-v="jobs" class="' + (S.view === "jobs" ? "on" : "") + '">Job check</button>'
        + '<button data-v="profile" class="' + (S.view === "profile" ? "on" : "") + '">Foreman profile</button>'
        + '<button data-v="future" class="' + (S.view === "future" ? "on" : "") + '">Upcoming jobs · '
        + rows.filter(isUpcoming).length + "</button>"
        + "</div>";

      // the future view has no use for last month's totals; the job-check view carries
      // its own per-verdict counters instead
      if (S.view === "board" || S.view === "profile")
      html += '<div class="pk-kpis">'
        + kpi(usd(sold), "Packing sold", here.length.toLocaleString() + " jobs · "
              + profiles.length + " foremen", "")
        + kpi(String(profiles.filter(function (p) { return p.score != null; }).length), "Foremen scored",
              "of " + profiles.length + " on the board · "
              + profiles.reduce(function (a, p) { return a + p.n; }, 0).toLocaleString() + " jobs in the comparison", "")
        + kpi(String(flagged.length), "Above the concern line",
              strong.length + " with a peer test below the strict threshold",
              flagged.length ? (strong.length ? "neg" : "warn") : (profiles.length ? "pos" : ""))
        + kpi(usd(opp), "Distance to the fleet median",
              "what these jobs would have sold at the median rate — an arithmetic gap, not missing money",
              flagged.length ? "warn" : "")
        + kpi(pct(invPct), "Loads itemised", "jobs whose calendar lists the goods", invPct > 0.8 ? "pos" : "warn")
        + "</div>";

      // the profile's foreman pick is a bar field like any other -- the man has to be
      // resolved BEFORE the bar renders so the select can show him
      if (S.view === "profile" && profiles.length) {
        var pnames = profiles.map(function (p) { return p.name; }).sort();
        if (!S.fm || pnames.indexOf(S.fm) < 0) {
          var topP = profiles.filter(function (p) { return p.score != null; })
            .sort(function (a, b) { return b.score - a.score; })[0];
          S.fm = topP ? topP.name : pnames[0];
        }
      }
      var curYm = TODAY.slice(0, 7);
      // the bar's dropdowns are the kit's localSelect — bare divs here, mounted after the
      // innerHTML lands (same option values and order as the old <select>s)
      html += '<div class="rs-bar">'
        + '<div id="pkMonth"></div>'
        + (Object.keys(cos).length > 1 ? '<div id="pkCo"></div>' : "")
        + (S.view === "profile" && profiles.length ? '<div id="pkWho"></div>' : "")
        // the way back must survive an empty window -- the button, unlike the select,
        // renders on the profile view unconditionally
        + (S.view === "profile"
            ? '<button class="rs-btn" id="pkToBoard">← Back to the board</button>' : "")
        // THE WINDOW CONTROLS BELONG TO BOTH VIEWS; THE BOARD'S DO NOT. Month and company decide
        // which jobs the whole comparison is built from, so the file needs them as much as the
        // board does. Sorting, "only above the line" and the name search only arrange a list of
        // twenty cards — on a page showing one man they are furniture.
        + (S.view === "board" ?
            '<div class="rs-fld"><span>Sort</span><div class="rs-seg">'
            + seg("score", "By concern") + seg("sold", "By packing sold") + seg("jobs", "By jobs") + seg("name", "A–Z")
            + "</div></div>"
            + '<div class="rs-tog' + (S.flagOnly ? " on" : "") + '" id="pkFlag"><i></i>Only above the line</div>' : "")
        + (S.view === "jobs"
            ? '<div class="rs-tog' + (S.chkOnly ? " on" : "") + '" id="pkOnly"><i></i>Only jobs to check</div>' : "")
        + (S.view !== "profile"
            ? '<label class="rs-fld"><span>Find</span><input class="rs-inp" id="pkQ" placeholder="'
              + (S.view === "board" ? "Find a foreman…" : "Foreman or customer…")
              + '" value="' + esc(S.q) + '"></label>' : "")
        + "</div>";

      var tests = 0;
      profiles.forEach(function (p) { tests += p.tested; });
      // the board's own reading instructions. The file states its method inside each section,
      // beside the number it governs, so repeating this paragraph there would just push the man
      // himself below the fold — which on a page about one man is the wrong thing at the top.
      if (S.view === "board")
      html += '<p class="rs-hint"><b>How to read this.</b> Every measure on a card is a comparison with '
        + "the other foremen on the same measure, over the window selected above \u2014 nothing here is scored "
        + "against a fixed target, so the fleet getting better or worse together moves nobody onto this board. "
        + "Customers packing their own things is normal and legitimate; it lands at random, so it cannot "
        + "explain a shortfall that is one man's, consistent, and present on separate signals at once. That is "
        + "what the certainty badge tests. " + tests + " comparisons were run across " + profiles.length
        + " foremen, and a badge is only awarded to readings that survive a false-discovery correction over all "
        + "of them \u2014 without it, a simulation of a fleet where nobody was doing anything wrong still put an "
        + "innocent name on the board most of the time. <b>A high score is a reason to review, not proof of "
        + "anything.</b></p>";

      var shown = profiles.slice();
      if (S.flagOnly) shown = shown.filter(function (p) { return p.score != null && p.score >= DIAL.flag; });
      if (S.q) {
        var q = S.q.toLowerCase();
        shown = shown.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; });
      }
      shown.sort(function (a, b) {
        if (S.sort === "name") return a.name.localeCompare(b.name);
        if (S.sort === "jobs") return b.n - a.n;
        if (S.sort === "sold") return b.sold - a.sold;
        // by concern: scored first, highest first; unscored fall to the bottom by job count
        if ((a.score == null) !== (b.score == null)) return a.score == null ? 1 : -1;
        return (b.score || 0) - (a.score || 0) || b.n - a.n;
      });

      if (S.view === "profile") {
        html += paintProfile(here, profiles);
      } else if (S.view === "jobs") {
        html += paintJobs(here, profiles);
      } else if (S.view === "future") {
        html += paintFuture(rows);
      } else {
        html += '<div class="pk-grid"><div>'
          + (shown.length ? shown.map(card).join("")
              : here.length ? '<div class="pk-empty">No foreman matches that filter.</div>'
              : '<div class="pk-empty">No finished jobs in this window yet — the month is '
                + "still ahead. The Upcoming jobs tab holds what is scheduled.</div>")
          + "</div>" + rail(here, profiles, fleet) + "</div>";
      }

      main.innerHTML = html;
      // mount the kit dropdowns onto the divs painted above; state stays in S, exactly as
      // the old <select> onchange handlers left it
      RSC.localSelect(main.querySelector("#pkMonth"), {
        label: "Month", allLabel: "All months",
        values: mList.map(function (m) {
          return { v: m, l: monLab(m) + (m > curYm ? " · upcoming" : "") };
        }),
        value: S.month,
        onChange: function (v) { S.month = v; invalidate(); paint(); },
      });
      var coHost = main.querySelector("#pkCo");
      if (coHost) RSC.localSelect(coHost, {
        label: "Company", allLabel: "Both books",
        values: Object.keys(cos).sort(),
        value: S.co,
        onChange: function (v) { S.co = v; invalidate(); paint(); },
      });
      var whoHost = main.querySelector("#pkWho");
      if (whoHost) RSC.localSelect(whoHost, {
        label: "Foreman", required: true,
        values: profiles.map(function (p) { return p.name; }).sort().map(function (n) {
          var q2 = profileOf(n, profiles);
          return { v: n, l: n + (q2 && q2.score != null ? "  ·  " + q2.score : "") };
        }),
        value: S.fm,
        onChange: function (v) { S.fm = v; paint(); },
      });
      wire(here, profiles);
      // the note under the bar says every card is read "over the window selected above" — so
      // the collapsed pill has to keep naming that window
      RSC.collapsible(main.querySelector(".rs-bar"), "rsBarCollapsed:packing-control", {
        count: function () {
          var labels = [];
          if (S.month) labels.push(monLab(S.month));
          if (S.co) labels.push(S.co);
          // ONLY NAME FILTERS THIS VIEW ACTUALLY APPLIES. The profile reads the whole
          // `profiles` list, so the board's flag toggle and name search do nothing there —
          // and neither control is on screen to inspect or clear. The pill claiming them
          // active was telling the reader the numbers were narrowed when they were not.
          if (S.view === "board") {
            if (S.flagOnly) labels.push("Only above the line");
          }
          if (S.view !== "profile" && S.q) labels.push("Search");
          if (S.view === "profile" && S.fm) labels.push(S.fm);
          if (S.view === "jobs" && S.chkOnly) labels.push("Only jobs to check");
          return { n: labels.length, labels: labels };
        },
      });
      // an open file is a claim about the window on screen; if the window moved, either
      // restate it against the new numbers or take it down
      if (S.open) {
        var still = null;
        profiles.forEach(function (p) { if (p.name === S.open) still = p; });
        if (still) openF(still, null); else close();
      }
    }

    function kpi(v, lab, sub, cls) {
      return '<div class="pk-kpi ' + (cls || "") + '"><b>' + esc(v) + "</b><span>" + esc(lab)
        + "</span><small>" + esc(sub) + "</small></div>";
    }

    /* ================================================================ the foreman's file
     * A BOARD ANSWERS "WHO", A PROFILE ANSWERS "WHY HIM". The board ranks twenty men on one
     * screen, which is the right shape for a sweep and the wrong shape for the conversation
     * that follows it — you sit down with one foreman and the board can only tell you his
     * score. Everything below was already being computed by rollup() for every man on every
     * paint; almost none of it had anywhere to appear (Tornike, 2026-08-12).
     *
     * It stays a PACKING file. The warehouse knows a great deal more about a foreman — claims,
     * fuel, cash, reviews — and pulling all of it here would need six more fetches and make
     * this page about everything, which is the fastest way to make it about nothing. The one
     * outside number worth the join is his monthly grade, because it is the company's own
     * verdict on the same man over the same months.
     */
    function profileOf(name, profiles) {
      for (var i = 0; i < profiles.length; i++) if (profiles[i].name === name) return profiles[i];
      return null;
    }

    // his rate against the fleet's, month by month. The board is one window flattened; a man
    // who was fine until March and has drifted since reads as merely "below" there, and the
    // difference between a drift and a habit is the first thing anyone asks.
    function monthly(p, rows) {
      /* THE SAME STATISTIC THE REST OF THE PAGE USES, or this panel quietly scores a different
       * measure under the same name. The first version totalled his money and his cubic feet
       * and divided — a ratio of sums — while the KPI above it, the peer table, the board bars
       * and the drawer all take the MEDIAN of the per-job `USD per 100 CF` column, which
       * deliberately excludes jobs that booked nothing and jobs with no CF. The same
       * foreman-month therefore printed two different numbers under one label, and the drawer
       * contradicted the profile (full scan, 2026-08-12).
       *
       * Median of the per-job column now, on both sides, with the fleet line still excluding
       * him — a man with many jobs would otherwise be largely compared with himself. */
      var K = "USD per 100 CF";
      var mine = {}, others = {}, count = {};
      rows.forEach(function (r) {
        if (r["Packed By Owner"] || !r["Recorded"] || !r.Day) return;
        var m = monthOf(r.Day), his = r.Foreman === p.name;
        if (his) {
          count[m] = (count[m] || { n: 0, sold: 0, booked: 0 });
          count[m].n++;
          count[m].sold += (+r["Sold USD"] || 0);
          if (!r["Zero Pack"]) count[m].booked++;
        }
        var v = r[K];
        if (v == null || !isFinite(v)) return;      // no rate: excluded, exactly as rollup does
        (his ? (mine[m] = mine[m] || []) : (others[m] = others[m] || [])).push(v);
      });
      return Object.keys(count).sort().map(function (m) {
        var c = count[m];
        return { m: m, rate: median(mine[m] || []), fleet: median(others[m] || []),
                 n: c.n, sold: c.sold, bookedPct: c.n ? c.booked / c.n : null };
      });
    }

    function paintProfile(rows, profiles) {
      var p = profileOf(S.fm, profiles);
      if (!p) return '<div class="pk-empty">No foreman in this window.</div>';
      var v = VERDICT[p.verdict];

      var typed = {};
      p.all.forEach(function (r) { if (r["Foreman Typed"]) typed[r["Foreman Typed"]] = 1; });
      typed = Object.keys(typed).filter(function (t) { return t !== p.name; });

      var h = "";
      // ---- identity + verdict ------------------------------------------------------------
      h += '<div class="pk-pcard ' + v.cls + '">'
        + '<div class="pk-pid"><div class="pk-av">'
        + esc(p.name.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 2).toUpperCase())
        + "</div><div><h2>" + esc(p.name) + "</h2>"
        + '<div class="pk-chips"><span class="pk-chip">' + p.n + " comparable job" + (p.n === 1 ? "" : "s") + "</span>"
        + '<span class="pk-chip">' + usd(p.sold) + " sold</span>"
        + (p.selfPacked ? '<span class="pk-chip">' + p.selfPacked + " self-packed, set aside</span>" : "")
        + (typed.length ? '<span class="pk-chip" title="the office typed these on the sheet; counted as one man">'
            + typed.map(esc).join(", ") + "</span>" : "")
        + "</div></div></div>"
        + '<div class="pk-pscore">' + (p.score == null ? '<b class="na">—</b>' : "<b>" + p.score + "</b>")
        + "<span>" + v.lab + "</span><small>" + esc(confLab(p)) + "</small></div>"
        + "</div>";

      h += '<div class="pk-read ' + v.cls + '" style="margin:0 0 16px"><h5>Reading</h5><p>'
        + verdictText(p) + "</p></div>";

      // ---- the numbers -------------------------------------------------------------------
      var perJob = p.n ? p.sold / p.n : null;
      // this row is HIS numbers against HIS peers, and nothing else -- the sales side of a
      // job (what the quote carried) appears only where it explains a number away, never as
      // a measure of the man (Tornike, 2026-08-19: the page is about foremen)
      h += '<div class="pk-kpis" style="margin-bottom:16px">'
        + kpi(usd(p.med["USD per 100 CF"], 2), "$ per 100 CF",
              "fleet " + usd(p.fleet["USD per 100 CF"], 2), rel(p, "USD per 100 CF"))
        + kpi(usd(p.med["USD per Unit"], 2), "$ per packing unit",
              "fleet " + usd(p.fleet["USD per Unit"], 2), rel(p, "USD per Unit"))
        + kpi(pct(p.med["Booked Anything"]), "Jobs that sold packing",
              "fleet " + pct(p.fleet["Booked Anything"]), rel(p, "Booked Anything"))
        + kpi(usd(perJob), "Sold per job", p.n + " jobs · " + usd(p.units) .replace("$", "") + " units", "")
        + kpi(pct(p.zeroRate), "Sold nothing at all",
              (function () {
                var z = p.jobs.filter(function (r) { return r["Zero Pack"]; }).length;
                var nq = p.jobs.filter(function (r) { return r["Zero Pack"] && r["No Quote"]; }).length;
                return z ? nq + " of those " + z + " arrived with no packing on the quote" : "every job sold something";
              })(), p.zeroRate > 0.5 ? "warn" : "")
        + "</div>";

      // ---- against his peers -------------------------------------------------------------
      h += '<div class="pk-sec"><h4>Against his peers</h4>'
        + '<p class="pk-dim2">Each measure is his median against the median of every OTHER foreman '
        + "in this window — he is never compared with himself. <b>p</b> is the chance a gap this "
        + "large would appear if he were drawing from the same pool as everyone else; it is shown "
        + "only where the test could run at all, and a signal is counted only below the "
        + "board-wide corrected cutoff of " + (p.cut ? p.cut.toFixed(3) : "—") + ".</p>"
        + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Measure</th><th class="num">His median</th>'
        + '<th class="num">The others</th><th class="num">Gap</th><th class="num">Jobs tested</th>'
        + "<th>Reading</th></tr></thead><tbody>"
        + MEASURES.map(function (m) {
            var val = p.med[m.k], f = p.fleet[m.k], pv = p.ps[m.k];
            var d = (val != null && f) ? (val - f) / f : null;
            var sig = pv != null && p.cut != null && pv <= p.cut && val != null && f != null && val < f;
            var cnt = p.jobs.filter(function (r) { return r[m.k] != null; }).length;
            return "<tr" + (sig ? ' class="pk-sig"' : "") + "><td><b>" + esc(m.lab) + "</b>"
              + '<small class="pk-dim2">' + esc(m.help) + "</small></td>"
              + '<td class="num"><b>' + fmtM(m, val) + "</b></td>"
              + '<td class="num">' + fmtM(m, f) + "</td>"
              + '<td class="num ' + (d == null ? "" : d < 0 ? "pk-neg" : "pk-pos") + '">'
              + (d == null ? "—" : (d > 0 ? "+" : "") + Math.round(d * 100) + "%") + "</td>"
              + '<td class="num">' + cnt + "</td>"
              + "<td>" + (pv == null
                  ? '<span class="rs-pill mute">too few to test</span>'
                  : sig ? '<span class="rs-pill bad">below peers · p=' + pv.toFixed(3) + "</span>"
                  : '<span class="rs-pill ok">ordinary · p=' + pv.toFixed(3) + "</span>")
              + "</td></tr>";
          }).join("")
        + "</tbody></table></div></div>";

      // ---- month by month ----------------------------------------------------------------
      var mo = monthly(p, rows);
      if (mo.length > 1) {
        var maxR = mo.reduce(function (a, x) {
          return Math.max(a, x.rate || 0, x.fleet || 0);
        }, 0) || 1;
        h += '<div class="pk-sec"><h4>Month by month</h4>'
          + '<p class="pk-dim2">His $ per 100 CF against everyone else’s in the same month. '
          + "One window flattened into a single number cannot tell a drift from a habit, and that "
          + "is the first thing worth knowing about a man who is below the line.</p>"
          + '<div class="pk-mrow pk-mhead"><span>Month</span><span class="r">Jobs</span>'
          + '<span class="r">Sold</span><span class="r">His rate</span><span class="r">The others</span><span> </span></div>'
          + mo.map(function (x) {
              var w = x.rate == null ? 0 : Math.round(x.rate / maxR * 100);
              var fw = x.fleet == null ? 0 : Math.round(x.fleet / maxR * 100);
              var lo = x.rate != null && x.fleet != null && x.rate < x.fleet;
              return '<div class="pk-mrow"><span>' + esc(monLab(x.m)) + "</span>"
                + '<span class="r">' + x.n + "</span>"
                + '<span class="r">' + usd(x.sold) + "</span>"
                + '<span class="r ' + (lo ? "neg" : "") + '"><b>' + usd(x.rate, 2) + "</b></span>"
                + '<span class="r pk-dim">' + usd(x.fleet, 2) + "</span>"
                + '<span class="pk-mbar"><i style="width:' + w + '%" class="' + (lo ? "lo" : "hi") + '"></i>'
                + '<u style="left:' + fw + '%" title="the others’ rate this month"></u></span></div>';
            }).join("")
          + "</div>";
      }

      // ---- his jobs ----------------------------------------------------------------------
      var jl = p.all.slice().sort(function (a, b) { return String(b.Day).localeCompare(String(a.Day)); });
      h += '<div class="pk-sec"><h4>Every job in this window <span class="pk-dim">' + jl.length + "</span></h4>"
        + '<p class="pk-dim2">The evidence under every number above. Rows the comparison SET ASIDE are '
        + "marked: a customer who packed their own things, and a job whose sheet is not filed yet, "
        + "are not evidence of anything either way.</p>"
        + '<div class="rs-tablewrap pk-jwrap"><table class="rs-table"><thead><tr><th>Day</th><th>Job</th>'
        + '<th>Customer</th><th class="num">CF</th><th class="num">Units</th><th class="num">Quoted</th>'
        + '<th class="num">Sold</th><th class="num">$/100 CF</th><th class="num">$/unit</th>'
        + "<th>Note</th><th>Links</th></tr></thead><tbody>"
        + jl.map(function (r) {
            var aside = r["Packed By Owner"] || !r["Recorded"];
            return "<tr" + (aside ? ' class="pk-aside"' : "") + "><td>" + esc(dayLab(r.Day)) + "</td>"
              + "<td>" + esc(r["Job Code"] || "—") + "</td>"
              + "<td>" + esc(r.Customer || "—") + "</td>"
              + '<td class="num">' + (r["Real CF"] == null ? "—" : Math.round(r["Real CF"])) + "</td>"
              + '<td class="num">' + (r["Packing Units"] == null ? "—" : r["Packing Units"]) + "</td>"
              + '<td class="num">' + usd(r["Quoted USD"]) + "</td>"
              + '<td class="num"><b>' + usd(r["Sold USD"]) + "</b></td>"
              + '<td class="num">' + usd(r["USD per 100 CF"], 2) + "</td>"
              + '<td class="num">' + usd(r["USD per Unit"], 2) + "</td>"
              + "<td>" + (r["Packed By Owner"] ? '<span class="rs-pill mute">customer packed</span>'
                  : !r["Recorded"] ? (r.Day > TODAY ? '<span class="rs-pill ok">upcoming</span>'
                      : '<span class="rs-pill mute">not filed yet</span>')
                  : r["Zero Pack"] ? '<span class="rs-pill ' + (r["No Quote"] ? "mute" : "bad") + '">sold nothing'
                      + (r["No Quote"] ? " · none quoted" : "") + "</span>"
                  : "") + '</td><td class="nowrap">' + jobLinks(r) + "</td></tr>";
          }).join("")
        + "</tbody></table></div></div>";
      return h;
    }

    /* ================================================================ job check
     * "I need a check for EACH JOB" (Tornike, 2026-08-19). The board's statistics go quiet
     * on narrow windows by design -- ten jobs is too few to judge a MAN, but one job is
     * enough to check a JOB. Every job gets its own row and its own verdict, no statistics
     * required: the load, the quote, what was sold, and what this load would have sold at
     * the fleet's median rate.
     *
     * CALIBRATED ON THE REAL BOOK before shipping (1,370 comparable jobs): "sold nothing on
     * a real load" fires on 12%, "sold short" (under 35% of expected AND a $100+ gap) on
     * 12%, boxes-with-no-tape on 2%. Soft misses -- a mattress without a cover (20% of
     * jobs; the fleet only covers about half), missing wrap, crew CF under the calendar --
     * are LISTED but never drive the verdict alone: a checklist where every fifth row
     * screams is a checklist nobody reads.
     */
    function jobVerdict(r, medUnit, med100) {
      if (r["Packed By Owner"])
        return { v: "aside", why: ["the customer packed their own things — set aside"], exp: null };
      if (!r["Recorded"])
        return { v: "paper", why: ["packing not written up yet — nothing to check against"], exp: null };
      // the CF the expectation is priced on is the LARGER of the crew's figure and the
      // calendar's -- a crew that under-reports CF (flagged two lines down) must not be
      // allowed to shrink its own expectation and dodge the verdict with the same pen
      var units = r["Packing Units"];
      var cf = Math.max(r["Real CF"] || 0, r["Calendar CF"] || 0) || null;
      var exp = (units != null && units >= 3 && medUnit) ? units * medUnit
              : (cf && med100) ? cf / 100 * med100 : null;
      var sold = +r["Sold USD"] || 0, why = [], v = "ok";
      if (r["Zero Pack"]) {
        v = "nothing";
        why.push(((units || 0) >= 10 || (cf || 0) >= 200)
          ? "nothing sold on a real load" : "nothing sold — small load");
        if (r["No Quote"]) why.push("none on the quote either");
        else if ((+r["Quoted USD"] || 0) > 0) why.push("the quote carried " + usd(r["Quoted USD"]));
      } else if (r["Quote Leak"]) {
        v = "short";
        why.push("quoted " + usd(r["Quoted USD"]) + ", sold " + usd(sold));
      } else if (exp != null && sold < 0.35 * exp && exp - sold >= 100) {
        v = "short";
        why.push("sold " + usd(sold) + " where the fleet rate says about " + usd(exp));
      }
      // soft observations: worth an eyebrow, never a verdict on their own
      if (r["Itemised"]) {
        if ((r["Inv Mattresses"] || 0) >= 1 && (r["Covers Sold"] || 0) === 0)
          why.push(r["Inv Mattresses"] + " mattress" + (r["Inv Mattresses"] === 1 ? "" : "es") + ", no cover");
        if ((r["Inv Boxes"] || 0) >= 10 && (r["Tape Sold"] || 0) === 0)
          why.push(r["Inv Boxes"] + " boxes, no tape");
        if ((r["Inv Wrappable"] || 0) >= 5 && (r["Wrap Sold"] || 0) === 0)
          why.push("no wrap on " + r["Inv Wrappable"] + " wrappable pieces");
      }
      if (r["CF Ratio"] != null && r["CF Ratio"] < DIAL.cfUnder)
        why.push("crew CF " + Math.round((1 - r["CF Ratio"]) * 100) + "% under the calendar");
      return { v: v, why: why, exp: exp };
    }

    function paintJobs(here, profiles) {
      var live = here.filter(function (r) { return !r["Packed By Owner"] && r["Recorded"]; });
      var rateN = function (rs) {
        var n = 0;
        rs.forEach(function (r) { if (r["USD per Unit"] != null) n++; });
        return n;
      };
      // the rate the expectation is priced at: this window's own median -- gated on how
      // many jobs actually CARRY a rate, not on the row count, because zero-pack rows have
      // their rates nulled and a month of mostly-zeros would pass a row-count gate with a
      // median resting on four values. Too thin -> the whole book, same company filter.
      var widened = rateN(live) < 30;
      var base = widened ? S.rows.filter(function (r) {
        return !r["Calendar Only"] && r.Day && r.Day <= TODAY
          && !r["Packed By Owner"] && r["Recorded"]
          && (!S.co || (r.Company || "—") === S.co);
      }) : live;
      var medUnit = median(base.map(function (r) { return r["USD per Unit"]; }));
      var med100 = median(base.map(function (r) { return r["USD per 100 CF"]; }));
      var withProfile = {};
      (profiles || []).forEach(function (p) { withProfile[p.name] = 1; });

      // the KPIs are the WINDOW (board convention: the search box narrows the table, never
      // the numbers); verdicts are computed on everything, the search filters what renders
      var checked = here.slice()
        .sort(function (a, b) { return String(b.Day).localeCompare(String(a.Day)); })
        .map(function (r) { return { r: r, c: jobVerdict(r, medUnit, med100) }; });
      var counts = { ok: 0, short: 0, nothing: 0, paper: 0, aside: 0 }, gap = 0;
      checked.forEach(function (x) {
        counts[x.c.v]++;
        if ((x.c.v === "short" || x.c.v === "nothing") && x.c.exp != null)
          gap += Math.max(0, x.c.exp - (+x.r["Sold USD"] || 0));
      });
      var shown = checked;
      if (S.q) {
        var q = S.q.toLowerCase();
        shown = shown.filter(function (x) {
          return String(x.r.Foreman || "").toLowerCase().indexOf(q) >= 0
            || String(x.r.Customer || "").toLowerCase().indexOf(q) >= 0;
        });
      }
      if (S.chkOnly) shown = shown.filter(function (x) { return x.c.v === "short" || x.c.v === "nothing"; });
      var CAP = 500;

      var h = '<div class="pk-kpis" style="margin-bottom:16px">'
        + kpi(String(checked.length), "Jobs in this window",
              counts.aside ? counts.aside + " set aside — customer packed" : "every one gets its own verdict", "")
        + kpi(String(counts.ok), "In range", "sold in line with what the load called for", counts.ok ? "pos" : "")
        + kpi(String(counts.nothing), "Sold nothing", "the first rows to check", counts.nothing ? "neg" : "pos")
        + kpi(String(counts.short), "Sold short", "well under the fleet rate for that load", counts.short ? "warn" : "pos")
        + kpi(String(counts.paper), "Not filed yet", "no packing record to check against", counts.paper ? "warn" : "")
        + kpi(usd(gap), "Gap on the red rows", "expected at the fleet rate minus sold — a size, not missing money", gap > 0 ? "warn" : "")
        + "</div>";

      h += '<div class="pk-sec"><h4>Every job, checked one by one <span class="pk-dim">' + shown.length + "</span></h4>"
        + '<p class="pk-dim2">Newest first. <b>Expected</b> is what this load would sell at the fleet’s median rate ('
        + usd(medUnit, 2) + "/unit from " + rateN(base) + " priced jobs"
        + (widened ? " — the whole book, since this window is too thin to price alone" : "")
        + "; $" + (med100 == null ? "—" : Math.round(med100)) + "/100 CF when a load has no unit count). "
        + "A job can sit below it and be fine, so the verdict only turns red when the shortfall is worth a phone "
        + "call. Grey notes — a mattress without a cover, boxes without tape — are worth an eyebrow, not a verdict: "
        + "the fleet itself only covers about half its mattresses. A row opens the foreman’s file at that job "
        + "where he has one.</p>";
      if (!shown.length) return h + '<p class="pk-dim2">Nothing to show in this window.</p></div>';
      h += '<div class="rs-tablewrap pk-jwrap" style="max-height:64vh"><table class="rs-table"><thead><tr>'
        + "<th>Day</th><th>Job</th><th>Customer</th><th>Foreman</th>"
        + '<th class="num">Load</th><th class="num">Quoted</th><th class="num">Sold</th><th class="num">Expected</th>'
        + "<th>Verdict</th><th>What to check</th><th>Links</th></tr></thead><tbody>"
        + shown.slice(0, CAP).map(function (x) {
            var r = x.r, c = x.c, load = [];
            if (r["Real CF"] || r["Calendar CF"]) load.push(Math.round(r["Real CF"] || r["Calendar CF"]) + " CF");
            if (r["Inv Boxes"] != null) load.push(r["Inv Boxes"] + " bx");
            if (r["Inv Wrappable"]) load.push(r["Inv Wrappable"] + " wr");
            if (r["Inv Mattresses"]) load.push(r["Inv Mattresses"] + " mat");
            var pill = c.v === "ok" ? '<span class="rs-pill ok">in range</span>'
              : c.v === "nothing" ? '<span class="rs-pill bad">sold nothing</span>'
              : c.v === "short" ? '<span class="rs-pill warn">sold short</span>'
              : c.v === "paper" ? '<span class="rs-pill mute">not filed</span>'
              : '<span class="rs-pill mute">customer packed</span>';
            var clickable = r.Foreman && withProfile[r.Foreman];
            return "<tr" + (clickable ? ' class="click" data-f="' + esc(r.Foreman)
                + '" data-job="' + esc(r["Job Code"]) + '"' : "") + ">"
              + "<td>" + esc(dayLab(r.Day)) + "</td>"
              + "<td>" + esc(r["Job Code"] || "—") + "</td>"
              + "<td>" + esc(r.Customer || "—") + "</td>"
              + "<td>" + esc(r.Foreman || "—") + "</td>"
              + '<td class="num pk-load">' + (load.length ? load.join(" · ") : "—") + "</td>"
              + '<td class="num">' + usd(r["Quoted USD"]) + "</td>"
              + '<td class="num"><b>' + (r["Recorded"] ? usd(r["Sold USD"]) : "—") + "</b></td>"
              + '<td class="num">' + (c.exp == null ? "—" : usd(c.exp)) + "</td>"
              + "<td>" + pill + "</td>"
              + '<td class="pk-why">' + (c.why.length ? c.why.map(esc).join(" · ") : "") + "</td>"
              + '<td class="nowrap">' + jobLinks(r) + "</td></tr>";
          }).join("")
        + "</tbody></table></div>";
      if (shown.length > CAP) h += '<p class="pk-dim2" style="margin-top:10px">' + (shown.length - CAP)
        + " more — pick a month above to narrow the list.</p>";
      return h + "</div>";
    }

    /* ================================================================ the future
     * "How do I see the future?" -- here. Every booked job from today forward, soonest
     * first: what the calendar says is on the truck, the packing already on the quote, and
     * the two click-throughs (the event itself, and the digital contract where one exists).
     * A job checked BEFORE the truck leaves beats one chased a week after it came back --
     * which is also why the spot-check queue on the board only keeps the last 7 days.
     */
    function paintFuture(rows) {
      var fut = rows.filter(isUpcoming);
      if (S.q) {
        var q = S.q.toLowerCase();
        fut = fut.filter(function (r) {
          return String(r.Foreman || "").toLowerCase().indexOf(q) >= 0
            || String(r.Customer || "").toLowerCase().indexOf(q) >= 0;
        });
      }
      fut.sort(function (a, b) {
        return String(a.Day).localeCompare(String(b.Day))
          || String(a["Job Code"]).localeCompare(String(b["Job Code"]));
      });
      var noFore = 0;
      fut.forEach(function (r) { if (!r.Foreman) noFore++; });
      var h = '<div class="pk-sec"><h4>Every booked job from today forward '
        + '<span class="pk-dim">' + fut.length + "</span></h4>"
        + '<p class="pk-dim2">Soonest first. This is the pre-job check: the goods the calendar '
        + "lists, and the packing already on the quote. Open the event, look at the load, and "
        + "check what the crew sells against it — before the truck leaves, not a week after. "
        + "A job from the past week that never reached the office sheet stays listed here, "
        + "marked — those are the ones most worth chasing."
        + (noFore ? " <b>" + noFore + " job" + (noFore === 1 ? " has" : "s have")
            + " no foreman assigned yet.</b>" : "")
        + "</p>";
      if (!fut.length) {
        return h + '<p class="pk-dim2">Nothing upcoming in this window — clear the month '
          + "filter to see every future job.</p></div>";
      }
      h += '<div class="rs-tablewrap pk-jwrap"><table class="rs-table"><thead><tr><th>Day</th><th>Job</th>'
        + '<th>Customer</th><th>Foreman</th><th class="num">Calendar CF</th><th class="num">Boxes</th>'
        + '<th class="num">Wrappable</th><th class="num">Mattresses</th><th class="num">Quoted units</th>'
        + '<th class="num">Quoted $</th><th>Links</th></tr></thead><tbody>'
        + fut.map(function (r) {
            return "<tr><td>" + esc(dayLab(r.Day))
              + (r.Day < TODAY ? ' <span class="rs-pill bad">done — not on the sheet</span>' : "")
              + "</td>"
              + "<td>" + esc(r["Job Code"] || "—") + "</td>"
              + "<td>" + esc(r.Customer || "—") + "</td>"
              + "<td>" + (r.Foreman ? esc(r.Foreman)
                  : '<span class="rs-pill mute">not assigned yet</span>') + "</td>"
              + '<td class="num">' + (r["Calendar CF"] == null ? "—" : Math.round(r["Calendar CF"])) + "</td>"
              + '<td class="num">' + (r["Inv Boxes"] == null ? "—" : r["Inv Boxes"]) + "</td>"
              + '<td class="num">' + (r["Inv Wrappable"] == null ? "—" : r["Inv Wrappable"]) + "</td>"
              + '<td class="num">' + (r["Inv Mattresses"] == null ? "—" : r["Inv Mattresses"]) + "</td>"
              + '<td class="num">' + (r["Quoted Units"] == null ? "—" : r["Quoted Units"]) + "</td>"
              + '<td class="num">' + usd(r["Quoted USD"]) + "</td>"
              + '<td class="nowrap">' + jobLinks(r) + "</td></tr>";
          }).join("")
        + "</tbody></table></div></div>";
      return h;
    }

    // colour a KPI by which side of the fleet he sits, but only where the comparison exists
    function rel(p, k) {
      var v = p.med[k], f = p.fleet[k];
      if (v == null || f == null || !f) return "";
      return v < f * 0.9 ? "warn" : v > f * 1.05 ? "pos" : "";
    }
    function seg(k, lab) {
      return '<button data-sort="' + k + '" class="' + (S.sort === k ? "on" : "") + '">' + lab + "</button>";
    }
    function monLab(m) {
      var p = m.split("-");
      return ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"][+p[1] - 1] + " " + p[0];
    }

    /* What the certainty badge says out loud. STRONG can be reached on a single very low
     * test, so it must not claim "several"; and NORMAL must never imply a clean bill when four
     * of the five measures had too few comparable jobs to test at all -- the file's own rule at
     * mwu() is that "too small to say" may never render as "clean". */
    function confLab(p) {
      if (p.conf === "STRONG") return "LOW ON " + p.below + " SIGNALS";
      if (p.conf === "WEAK") return "ONE SIGNAL";
      if (p.conf === "THIN") return "NO TEST POSSIBLE";
      return "TESTED ON " + p.tested + " OF " + MEASURES.length;
    }

    /* one foreman, on the board */
    function card(p) {
      var v = VERDICT[p.verdict];
      var h = '<div class="pk-card ' + v.cls + (S.open === p.name ? " sel" : "") + '" data-f="' + esc(p.name) + '">'
        + '<div class="pk-head"><span class="pk-name">' + esc(p.name) + "</span>"
        + '<span class="pk-pill">' + v.lab + "</span>"
        + (p.score != null ? '<span class="pk-conf c-' + p.conf.toLowerCase() + '">' + confLab(p) + "</span>" : "")
        + '<span class="pk-sub">' + (p.score != null ? "score " + p.score + " · " : "")
        + p.n + " job" + (p.n === 1 ? "" : "s") + " · " + usd(p.sold) + "</span></div>"
        + '<div class="pk-bars">'
        + MEASURES.map(function (m) { return bar(m, p.med[m.k], p.fleet[m.k]); }).join("")
        + "</div></div>";
      return h;
    }

    /* THE COMPARISON, DRAWN. The fleet median is the centre line; the bar grows left (below
     * peers, red) or right (above, green) by the relative gap, capped at ±100%. A number on
     * its own says nothing without the peer value beside it — this puts them in one glance. */
    function bar(m, v, f) {
      if (v == null || f == null || !(f > 0)) {
        return '<div class="pk-b"><label>' + m.lab + "<b>—</b></label>"
          + '<div class="pk-track na"><i></i></div></div>';
      }
      var rel = Math.max(-1, Math.min(1, (v - f) / f));
      var w = Math.abs(rel) * 50;
      var style = rel < 0 ? "right:50%;width:" + w + "%" : "left:50%;width:" + w + "%";
      return '<div class="pk-b" title="' + esc(m.help) + " Fleet median " + esc(fmtM(m, f)) + '.">'
        + "<label>" + m.lab + "<b>" + fmtM(m, v) + "</b></label>"
        + '<div class="pk-track"><i></i><u class="' + (rel < 0 ? "lo" : "hi") + '" style="' + style + '"></u></div></div>';
    }

    /* the side rail: fleet reference, and the queue the office actually works from */
    function rail(rows, profiles, fleet) {
      var h = '<div>';
      h += '<div class="pk-rail"><h4>Fleet reference · this window</h4>'
        + MEASURES.map(function (m) {
            return '<div class="pk-row"><span>' + m.lab + "</span><b>" + fmtM(m, fleet[m.k]) + "</b></div>";
          }).join("")
        + '<div class="pk-row"><span>Jobs with nothing sold</span><b>'
        + rows.filter(function (r) { return r["Zero Pack"] && !r["Packed By Owner"]; }).length + "</b></div>"
        + '<div class="pk-row"><span>Customer packed their own</span><b>'
        + rows.filter(function (r) { return r["Packed By Owner"]; }).length + "</b></div>"
        + '<div class="pk-row"><span>No packing on the quote</span><b>'
        + rows.filter(function (r) { return r["No Quote"]; }).length + "</b></div>"
        + (function () {
            var nr = rows.filter(function (r) { return !r["Recorded"]; }).length;
            var ni = rows.filter(function (r) { return !r["Itemised"]; }).length;
            return '<div class="pk-row"><span>Packing not written up yet</span><b>' + nr + "</b></div>"
              + '<div class="pk-row"><span>No material breakdown filed</span><b>' + ni + "</b></div>";
          })()
        + "</div>";

      // spot-check queue -- LATEST FIRST, and only the last 7 days: a job checked a week
      // after the truck came back is already too late to check (Tornike, 2026-08-19).
      // Older flagged jobs still count in every foreman's numbers; they are just past the
      // point where a phone call can settle anything.
      var weekAgo = WEEK_AGO;
      var allFlagged = rows.filter(function (r) {
        return r.Flags && !r["Packed By Owner"] && r.Day && r.Day <= TODAY;
      });
      var q = allFlagged.filter(function (r) { return r.Day >= weekAgo; })
        .sort(function (a, b) {
          return String(b.Day).localeCompare(String(a.Day)) || (b["Quote Leak"] - a["Quote Leak"]);
        });
      var older = allFlagged.length - q.length;
      h += '<div class="pk-rail"><h4>Spot-check queue · last 7 days · ' + q.length + "</h4>";
      if (!q.length) h += '<div class="pk-row"><span>Nothing flagged in the last 7 days.</span></div>';
      else {
        h += q.slice(0, 12).map(function (r) {
          return '<div class="pk-q" role="button" data-job="' + esc(r["Job Code"]) + '" data-f="' + esc(r.Foreman || "") + '">'
            + "<b>" + esc(r.Customer || r["Job Code"]) + "</b> "
            + '<span>· ' + dayLab(r.Day) + " · " + esc(r.Foreman || "no foreman") + "</span>"
            + "<em>" + esc(r.Flags) + "</em>"
            + '<span style="display:block;margin-top:3px">' + jobLinks(r) + "</span></div>";
        }).join("");
        if (q.length > 12) h += '<div class="pk-row" style="color:var(--faint)"><span>'
          + (q.length - 12) + " more this week — open a foreman to see his own.</span></div>";
      }
      if (older > 0) h += '<div class="pk-row" style="color:var(--faint)"><span>'
        + older + " older flagged job" + (older === 1 ? "" : "s") + " not listed — past the point of "
        + "checking. They still count in the foremen's numbers above.</span></div>";
      h += "</div></div>";
      return h;
    }

    function wire(rows, profiles) {
      var byName = {};
      profiles.forEach(function (p) { byName[p.name] = p; });

      main.querySelectorAll(".pk-tabs button").forEach(function (b) {
        b.onclick = function () { S.view = b.dataset.v; close(); paint(); };
      });
      // #pkWho / #pkMonth / #pkCo are localSelect mounts now — wired where they are
      // mounted, in paint(), not here
      var tb = main.querySelector("#pkToBoard");
      if (tb) tb.onclick = function () { S.view = "board"; paint(); };

      var fo = main.querySelector("#pkFlag");
      if (fo) fo.onclick = function () { S.flagOnly = !S.flagOnly; paint(); };
      var ck = main.querySelector("#pkOnly");
      if (ck) ck.onclick = function () { S.chkOnly = !S.chkOnly; paint(); };
      main.querySelectorAll("tr.click").forEach(function (tr) {
        tr.onclick = function (e) {
          if (e.target && e.target.closest && e.target.closest("a")) return;
          var p = byName[tr.dataset.f];
          if (p) openF(p, tr.dataset.job);
        };
      });
      var qq = main.querySelector("#pkQ");
      if (qq) qq.oninput = function () {
        S.q = this.value;
        var at = this.selectionStart;
        paint();
        var n = main.querySelector("#pkQ");
        if (n) { n.focus(); n.setSelectionRange(at, at); }
      };
      main.querySelectorAll(".rs-seg button").forEach(function (b) {
        b.onclick = function () { S.sort = b.dataset.sort; paint(); };
      });
      main.querySelectorAll(".pk-card").forEach(function (c) {
        c.onclick = function () { openF(byName[c.dataset.f], null); };
      });
      main.querySelectorAll(".pk-q").forEach(function (b) {
        b.onclick = function (e) {
          // the event / contract links inside the row are their own click
          if (e.target && e.target.closest && e.target.closest("a")) return;
          openF(byName[b.dataset.f], b.dataset.job);
        };
      });
    }

    /* ================================================================ the file
     * One foreman, in full. The order of what follows is the order a fair reader should take
     * it in: what the numbers are, then how sure we are, then what could explain it — with
     * the legitimate explanation first — and finally what to physically go and check.
     */
    function openF(p, jobCode) {
      if (!p) return;
      S.open = p.name;
      var v = VERDICT[p.verdict];

      var typed = {};
      p.all.forEach(function (r) { if (r["Foreman Typed"]) typed[r["Foreman Typed"]] = 1; });
      typed = Object.keys(typed);

      var h = '<div class="pk-dh"><div><h3>' + esc(p.name) + "</h3>"
        + (typed.length ? '<p style="color:var(--muted)">also typed on the sheet as '
            + typed.map(function (t) { return "“" + esc(t) + "”"; }).join(", ")
            + " — counted as one man</p>" : "")
        + "<p>" + p.n + " comparable job" + (p.n === 1 ? "" : "s")
        + (p.selfPacked ? " · " + p.selfPacked + " excluded (customer packed their own)" : "")
        + " · " + usd(p.sold) + " sold</p></div>"
        + '<div class="pk-dhact"><button class="rs-btn" id="pkFull">Open his full file →</button>'
        + '<button class="pk-x" id="pkX">&times;</button></div></div><div class="pk-db">';

      h += '<div class="pk-read ' + v.cls + '"><h5>Reading</h5><p>' + verdictText(p) + "</p>";
      if (p.verdict === "review" || p.verdict === "look") {
        var nq = p.jobs.filter(function (r) { return r["Zero Pack"] && r["No Quote"]; }).length;
        var i = 0;
        h += '<div class="pk-cause"><b>' + (++i) + '</b><span><i>The customer packed their own things.</i> '
          + "Legitimate, common, and the first thing to rule out. It happens at random, so it does not "
          + "normally follow one foreman across months — which is what the certainty badge measures.</span></div>"
          + (nq ? '<div class="pk-cause"><b>' + (++i) + "</b><span><i>No packing was on the quote.</i> On " + nq
              + " of his " + p.n + " jobs the customer arrived with no packing on the quote and none was sold. "
              + "That is a job mix he did not choose, and it counts against him on the under-$" + DIAL.zeroUsd
              + " measure.</span></div>" : "")
          // The off-book reading is the one that accuses. It appears ONLY where the page's own
          // definition of "review" is met -- several measures falling together. Printing it
          // under "worth a look", whose text says the evidence is NOT consistent, would have the
          // page contradict itself in the direction that damages a person.
          + (p.verdict === "review" && p.below >= 2
              ? '<div class="pk-cause"><b>' + (++i) + '</b><span><i>Materials sold off the books.</i> Own '
                + "materials brought to the job, charged to the customer, never recorded. It is on this list "
                + "because " + p.below + " independent measures fell together; it is still the last reading to "
                + "reach for, not the first.</span></div>"
              : "")
          + '<div class="pk-cause"><b>' + (++i) + '</b><span><i>Simply not offering it.</i> Lost revenue rather '
          + "than lost cash — the likeliest explanation when the shortfall sits on the rate measures but the "
          + "coverage ones (covers, wrap, tape) look ordinary.</span></div>"
          + '<div class="pk-cause"><b>&#10003;</b><span><i>The physical check.</i> Take his next job: do the beds, '
          + "dressers and boxes on the truck match the covers, wrap and tape sold against it? That answers in "
          + "one morning what months of numbers can only suggest.</span></div>";
      }
      h += "</div>";

      // measure grid against peers
      h += '<div class="pk-rail"><h4>Against his peers</h4>'
        + MEASURES.map(function (m) {
            var val = p.med[m.k], f = p.fleet[m.k], pv = p.ps[m.k];
            var d = (val != null && f) ? Math.round((val - f) / f * 100) : null;
            return '<div class="pk-row"><span>' + m.lab + "</span><b>" + fmtM(m, val)
              + '<span style="color:var(--faint);font-weight:500"> vs ' + fmtM(m, f)
              + (d == null ? "" : " · " + (d > 0 ? "+" : "") + d + "%")
              + (pv == null ? " · untestable" : pv < 0.05 && d < 0 ? " · p=" + pv.toFixed(3) : "")
              + "</span></b></div>";
          }).join("")
        + '<div class="pk-row"><span>Jobs selling under $' + DIAL.zeroUsd + "</span><b>" + pct(p.zeroRate)
        + " of jobs</b></div>"
        + (function () {
            var z = p.jobs.filter(function (r) { return r["Zero Pack"]; }).length;
            var nq = p.jobs.filter(function (r) { return r["Zero Pack"] && r["No Quote"]; }).length;
            // the confound, stated on the same screen as the number it explains
            return z ? '<div class="pk-row"><span style="color:var(--faint)">  of which had no packing '
              + "on the quote</span><b>" + nq + " of " + z + "</b></div>" : "";
          })()

        + (p.opp > 0 && (p.verdict === "review" || p.verdict === "look")
            ? '<div class="pk-row"><span>If his jobs had sold at the median $/unit</span><b>+' + usd(p.opp)
              + "</b></div>" : "")
        + "</div>";

      // month trend — a shortfall that appears in one month is a different story from one that
      // has been there all year, and only a trend can tell them apart
      var byM = {};
      p.jobs.forEach(function (r) {
        var m = monthOf(r.Day);
        if (!m) return;
        (byM[m] || (byM[m] = [])).push(r);
      });
      var ms = Object.keys(byM).sort();
      if (ms.length > 1) {
        var f100 = p.fleet["USD per 100 CF"];
        h += '<div class="pk-rail"><h4>$ per 100 CF, month by month · fleet ' + usd(f100, 2) + "</h4>"
          + '<div class="pk-spark">'
          + ms.map(function (m) {
              var mv = median(byM[m].map(function (r) { return r["USD per 100 CF"]; }));
              var rel = (mv == null || !f100) ? null : mv / f100;
              var hgt = rel == null ? 4 : Math.max(4, Math.min(100, rel * 55));
              var cls = rel == null ? "" : rel < 0.6 ? "hot" : rel < 0.85 ? "mid" : "cool";
              return '<div class="' + cls + '" style="height:' + hgt + '%" title="' + monLab(m) + ": "
                + (mv == null ? "no comparable jobs" : usd(mv, 2) + " · " + byM[m].length + " jobs") + '"></div>';
            }).join("")
          + '</div><div class="pk-sparkx">'
          + ms.map(function (m) { return "<span>" + m.slice(5) + "</span>"; }).join("")
          + "</div></div>";
      }

      // every job, so any claim above can be checked against the rows it came from
      // EVERY job, including the ones excluded from the statistics -- shown faded and marked,
      // because a reader who cannot see what was left out cannot check the arithmetic.
      var js = p.all.slice().sort(function (a, b) { return (a.Day < b.Day) - (a.Day > b.Day); });
      h += '<div class="pk-rail"><h4>Every job · newest first · ' + p.all.length + "</h4>"
        + '<div style="overflow:auto;max-height:52vh"><table class="pk-tbl"><thead><tr>'
        + "<th>Job</th><th>Day</th><th>CF</th><th>Boxes</th><th>Wrappable</th><th>Sold</th>"
        + "<th>$/100CF</th><th>Tape</th><th>Covers</th><th>Links</th></tr></thead><tbody>"
        + js.map(function (r) {
            var cls = (r["Packed By Owner"] || !r["Recorded"]) ? "sp" : r.Flags ? "f" : "";
            return "<tr" + (cls ? ' class="' + cls + '"' : "")
              + (jobCode && r["Job Code"] === jobCode ? ' style="outline:2px solid var(--blue)"' : "") + ">"
              + "<td>" + esc(r.Customer || r["Job Code"])
              + (r["Packed By Owner"] ? '<br><span style="font-size:var(--t5);color:var(--faint)">'
                  + "customer packed their own — excluded</span>"
                  : !r["Recorded"] ? '<br><span style="font-size:var(--t5);color:var(--faint)">'
                    + (r.Day > TODAY ? "upcoming — nothing to count yet"
                       : "packing not written up yet — not counted either way") + "</span>"
                  : r.Flags ? "<br><em>" + esc(r.Flags) + "</em>" : "") + "</td>"
              + "<td>" + dayLab(r.Day) + "</td>"
              + "<td>" + (r["Real CF"] == null ? "—" : Math.round(r["Real CF"])) + "</td>"
              + "<td>" + (r["Inv Boxes"] == null ? "—" : r["Inv Boxes"]) + "</td>"
              + "<td>" + (r["Inv Wrappable"] == null ? "—" : r["Inv Wrappable"]) + "</td>"
              + "<td>" + usd(r["Sold USD"]) + "</td>"
              + "<td>" + usd(r["USD per 100 CF"], 2) + "</td>"
              + "<td>" + (r["Tape Sold"] || 0) + "</td>"
              + "<td>" + (r["Covers Sold"] || 0) + (r["Inv Mattresses"] ? "/" + r["Inv Mattresses"] : "") + "</td>"
              + "<td>" + jobLinks(r) + "</td></tr>";
          }).join("")
        + "</tbody></table></div></div></div>";

      draw.querySelector("#pkDrawIn").innerHTML = h;
      draw.classList.add("on");
      scrim.classList.add("on");
      draw.querySelector("#pkX").onclick = close;
      // the drawer is the quick read; the file is the sit-down. One click between them.
      draw.querySelector("#pkFull").onclick = function () {
        S.view = "profile"; S.fm = p.name; close(); paint();
        try { main.scrollIntoView({ block: "start" }); } catch (e) {}
      };
      if (jobCode) {
        var hit = draw.querySelector('tr[style*="outline"]');
        if (hit) hit.scrollIntoView({ block: "center" });
      }
      paintSel();
    }
    function close() {
      draw.classList.remove("on");
      scrim.classList.remove("on");
      S.open = null;
      paintSel();
    }
    function paintSel() {
      main.querySelectorAll(".pk-card").forEach(function (c) {
        c.classList.toggle("sel", c.dataset.f === S.open);
      });
    }
    scrim.onclick = close;
    // bound once for the life of the tab: render() runs again on every navigation back to
    // this page, and a listener added each time would pile up against detached nodes
    if (!window.__PK_ESC) {
      window.__PK_ESC = function (e) {
        var d = document.getElementById("pkDraw");
        if (e.key === "Escape" && d && d.classList.contains("on")) {
          d.classList.remove("on");
          var sc = document.getElementById("pkScrim");
          if (sc) sc.classList.remove("on");
          if (window.__PK) window.__PK.open = null;
          // the card keeps its selected border otherwise -- close() clears it, Esc must too
          document.querySelectorAll(".pk-card.sel").forEach(function (c) {
            c.classList.remove("sel");
          });
        }
      };
      document.addEventListener("keydown", window.__PK_ESC);
    }

    /* The sentence a person's name is attached to. Deliberately written once, here, so the
     * page cannot drift into language it should never use: no "fraud", no "lying", no
     * "stealing". The vocabulary is concern, review, off-book, worth checking. */
    function verdictText(p) {
      if (p.verdict === "thin") {
        // "too few jobs" must never read as a dead end: the statistics refuse to judge a
        // MAN on a thin window, but every one of his JOBS is still checkable, one by one
        var goCheck = " His jobs can still be checked one by one — the Job check tab.";
        if (p.peers < DIAL.minPeers) {
          return "Only " + p.peers + " foreman" + (p.peers === 1 ? "" : "en") + " worked in this window, so "
            + "there is no fleet to compare against. Widen the filter to score anyone." + goCheck;
        }
        if (p.n < DIAL.minJobs) {
          return "Only " + p.n + " job" + (p.n === 1 ? "" : "s") + " in this window — below the "
            + DIAL.minJobs + " needed to compare fairly. This is a profile, not a judgement." + goCheck;
        }
        return "None of the " + MEASURES.length + " measures had enough comparable jobs to score. This is a "
          + "profile, not a judgement." + goCheck;
      }
      if (p.verdict === "review") {
        // The two money measures are one takings figure over two denominators, so they are
        // one signal. Listing five names under a badge that reads four needs a word of
        // explanation, or the page looks like it cannot count.
        var rateBoth = p.lowKeys.indexOf("$ per 100 CF") >= 0
          && p.lowKeys.indexOf("$ per packing unit") >= 0;
        return "Sells less packing than his peers on " + p.below + " separate signal"
          + (p.below === 1 ? "" : "s") + " \u2014 " + p.lowKeys.join(", ")
          + (rateBoth ? " (the two money measures are the same takings over two different denominators, "
              + "so they count once between them)" : "")
          + " \u2014 each one surviving a false-discovery correction applied across every comparison on "
          + "this board, not just his own. That is what makes chance an unlikely explanation here, and it "
          + "is a reason to review rather than proof of anything. Work through the readings below in order.";
      }
      if (p.verdict === "look") {
        return "Below his peers on the numbers (score " + p.score + "), but nothing came through the "
          + "false-discovery correction applied across the whole board, so ordinary variation has not been "
          + "ruled out. Treat this as a question to answer, not a finding.";
      }
      if (p.verdict === "untested") {
        return "Too few comparable jobs on the measures that matter, so no peer test could run. "
          + "Silence here is not a clean bill — it is an absence of evidence either way.";
      }
      var untested = MEASURES.length - p.tested;
      return "In line with his peers on the " + p.tested + " measure" + (p.tested === 1 ? "" : "s")
        + " that could be tested"
        + (p.score ? " (score " + p.score + ", below the line of " + DIAL.flag + ")" : "")
        + (untested ? ". " + untested + " of the " + MEASURES.length + " had too few comparable jobs to test, "
            + "so this is a clean reading on what could be measured rather than on everything." : ".");
    }
  },
});
