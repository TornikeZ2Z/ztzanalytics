/* STORAGE CONTROL — whose goods we are holding, where exactly, and whether the money is right.
 *
 * The office already keeps the answer: the All Storage Items sheet, one row per customer's
 * goods, with the vault numbers of our own warehouse in its Location column. This page is
 * that register made visible — the physical vault board on top, the rented locations beside
 * it, the full ledger underneath. Nothing here is hand-drawn: a teammate's offline app kept
 * the same board with customer names hardcoded into HTML, and this replaces that with the
 * sheet the office maintains anyway.
 *
 * Days-in and the "owing" state are computed at render time against today, not baked
 * nightly — a register that says "212 days" a day late is how boards stop being trusted.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    // PAYLOAD CONTRACTS: a column missing from these lists never arrives.
    if (!RS.DATASETS.fct_storage_register) {
      RS.DATASETS.fct_storage_register = {
        table: "fct_storage_register",
        cols: ["Job Code", "Customer", "Company", "Foreman Email",
               "Chargeable CF", "Real CF", "Entered", "Left", "Active",
               "Billing Start", "Fee per CF", "Fee per CF Initial", "Price Changed",
               "Monthly I", "Monthly II", "Accruals I", "Accruals II", "Next Payment",
               "Total Bill", "Total Paid", "Balance", "Payment Status", "Inventory Status",
               "Location Kind", "Location", "Location Label", "Unit",
               "Vaults", "Vault Count", "Facility", "Matched Facility", "Notes"],
      };
    }
    if (!RS.DATASETS.fct_storage_vault) {
      RS.DATASETS.fct_storage_vault = {
        table: "fct_storage_vault",
        cols: ["Vault", "Job Code", "Customer", "Company", "Entered", "Left", "Active",
               "Chargeable CF", "Balance", "Payment Status"],
      };
    }
    if (!RS.DATASETS.fct_storage_facility) {
      RS.DATASETS.fct_storage_facility = {
        table: "fct_storage_facility",
        cols: ["Facility", "Address", "State", "Brand", "Stores", "Units", "Unit Count",
               "Capacity CF", "Seed Monthly", "Status", "Closed At",
               "First Charge", "Last Charge", "Last Amount", "Monthly Run Rate",
               "Paid 12mo", "Paid Total", "Charges", "USD per CF",
               "Active Items", "Occupied CF"],
      };
    }
    if (!RS.DATASETS.fct_storage_rent) {
      RS.DATASETS.fct_storage_rent = {
        table: "fct_storage_rent",
        cols: ["Date", "Brand", "Store", "Amount", "Company", "Facility"],
      };
    }
    if (!RS.DATASETS.st_custody) {
      RS.DATASETS.st_custody = {
        table: "fct_ld_custody",
        cols: ["TS", "Posted", "Customer", "Custody", "Carrier", "Rate", "CF",
               "Facility", "Units", "Flags", "Photo Count", "Photos", "Permalink",
               "Delivered", "Delivered On", "Job Code", "Request No"],
      };
    }
    if (!RS.DATASETS.st_payments) {
      RS.DATASETS.st_payments = {
        table: "fct_storage",
        cols: ["Job Code", "Customer", "Payment Date", "Amount", "Payment Type", "Notes"],
      };
    }
    if (!RS.DATASETS.st_crew) {
      RS.DATASETS.st_crew = { table: "dim_crew", cols: ["Full Name", "Email", "Status"] };
    }
  }
})();

registerPage({
  id: "storage-control",
  title: "Storage Control",
  subtitle: "Every customer's goods in storage — vault by vault, unit by unit, with the billing beside them.",
  datasets: [],

  render: function (host) {
    var RSC = window.RS_COMPONENTS || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__STC || (window.__STC = {
      reg: null, vaults: null, pays: null, crew: null, fac: null, rent: null, custody: null,
      q: "", show: "active", kind: "", owing: false, open: null,
    });

    var usd = function (v, d) {
      return v == null || isNaN(v) ? "—"
        : "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d });
    };
    var num = function (v) { return v == null || v === "" ? null : +v; };
    function dayLab(d) {
      if (!d) return "—";
      var p = String(d).slice(0, 10).split("-");
      return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1]
        + " " + (+p[2]) + ", " + p[0];
    }
    var TODAY = new Date(); TODAY.setHours(0, 0, 0, 0);
    function daysIn(r) {
      if (!r.Entered) return null;
      var a = new Date(r.Entered + "T00:00:00");
      var b = r.Left ? new Date(r.Left + "T00:00:00") : TODAY;
      if (isNaN(a) || isNaN(b)) return null;
      return Math.max(0, Math.round((b - a) / 86400000));
    }
    // owing = a positive balance on goods still with us
    function owes(r) { return r.Active === 1 && (num(r.Balance) || 0) > 0.5; }

    /* ================================================================ style
     * The board is the hero: the physical warehouse as tiles, money as colour only where
     * money is wrong. House tokens throughout; occupied vaults carry the ink, empty ones
     * are ghosts, and a red left-edge means the goods inside owe us money.
     */
    host.innerHTML = '<style id="stcCss">'
      + ".stc{--t1:27px;--t2:15px;--t3:13.5px;--t4:12px;--t5:11px;--t6:9.5px;max-width:none;font-variant-numeric:tabular-nums}"
      + ".stc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}"
      + ".stc-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".stc-kpi b{display:block;font-size:var(--t1);letter-spacing:-.6px;line-height:1.1}"
      + ".stc-kpi span{display:block;font-size:var(--t6);font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".stc-kpi small{display:block;font-size:var(--t5);color:var(--muted);margin-top:3px}"
      + ".stc-kpi.neg b{color:var(--neg)} .stc-kpi.pos b{color:var(--pos)}"
      + ".stc-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:16px 0 14px}"
      + ".stc-bar input{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:7px 10px;font-size:var(--t4);font-family:inherit;min-width:210px}"
      + ".stc-seg{display:inline-flex;background:var(--panel);border:1px solid var(--line);border-radius:9px;overflow:hidden}"
      + ".stc-seg button{background:none;border:0;color:var(--muted);font:inherit;font-size:var(--t4);padding:7px 13px;cursor:pointer}"
      + ".stc-seg button.on{background:var(--line);color:var(--ink);font-weight:700}"
      + ".stc-tog{display:inline-flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:7px 11px;font-size:var(--t4);color:var(--muted);cursor:pointer;user-select:none}"
      + ".stc-tog.on{border-color:var(--neg);color:var(--ink)}"
      + ".stc-tog i{width:9px;height:9px;border-radius:3px;background:var(--line-2);display:block}"
      + ".stc-tog.on i{background:var(--neg)}"
      + ".stc-h2{font-size:var(--t6);font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:20px 0 10px}"
      + ".stc-h2 b{color:var(--muted)}"
      // the vault board
      + ".stc-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:8px}"
      + ".stc-v{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:7px 9px;min-height:58px;position:relative;overflow:hidden;cursor:pointer;transition:transform .08s,border-color .12s}"
      + ".stc-v:hover{transform:translateY(-2px);border-color:var(--line-2)}"
      + ".stc-v .n{font-size:var(--t5);font-weight:800;letter-spacing:.04em;color:var(--faint)}"
      + ".stc-v.full .n{color:var(--ink)}"
      + ".stc-v .who{font-size:var(--t5);font-weight:650;line-height:1.25;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}"
      + ".stc-v .d{font-size:var(--t6);color:var(--faint);margin-top:2px}"
      + ".stc-v.empty{background:transparent;border-style:dashed;cursor:default}"
      + ".stc-v.empty .who{color:var(--faint);font-weight:500}"
      + ".stc-v.full{border-left:3px solid var(--pos)}"
      + ".stc-v.full.owe{border-left-color:var(--neg)}"
      + ".stc-v.multi::after{content:'+';position:absolute;top:5px;right:8px;color:var(--faint);font-weight:800}"
      + ".stc-flag{font-size:var(--t5);line-height:1.5;border-radius:8px;padding:7px 10px;margin-top:8px}"
      + ".stc-flag.bad{background:var(--neg-bg);color:var(--neg);font-weight:600}"
      + ".stc-flag.warn{background:var(--warn-bg);color:var(--warn);font-weight:600}"
      + ".stc-fac{cursor:pointer}"
      // rented cards
      + ".stc-rent{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}"
      + ".stc-r{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}"
      + ".stc-r .nm{font-size:var(--t3);font-weight:700;line-height:1.3}"
      + ".stc-r .meta{font-size:var(--t5);color:var(--faint);margin-top:2px}"
      + ".stc-r .in{margin-top:8px;border-top:1px solid var(--line)}"
      + ".stc-r .jrow{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line);font-size:var(--t4);cursor:pointer}"
      + ".stc-r .jrow:last-child{border-bottom:0}"
      + ".stc-r .jrow:hover{color:var(--blue)}"
      + ".stc-r .jrow .u{color:var(--faint);font-size:var(--t5)}"
      + ".stc-r .jrow .cf{margin-left:auto;color:var(--muted);font-size:var(--t5);white-space:nowrap}"
      + ".stc-r .jrow .owe{color:var(--neg);font-weight:700;font-size:var(--t5)}"
      // register table
      + ".stc-tblwrap{overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:12px}"
      + ".stc-tbl{width:100%;border-collapse:collapse;font-size:var(--t4)}"
      + ".stc-tbl th{text-align:right;font-size:var(--t6);letter-spacing:.05em;text-transform:uppercase;color:var(--faint);font-weight:800;padding:9px 10px;border-bottom:1px solid var(--line-2);position:sticky;top:0;background:var(--panel);white-space:nowrap}"
      + ".stc-tbl th:nth-child(-n+3),.stc-tbl td:nth-child(-n+3){text-align:left}"
      + ".stc-tbl td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}"
      + ".stc-tbl tr{cursor:pointer}"
      + ".stc-tbl tr:hover td{background:var(--panel-2)}"
      + ".stc-tbl tr.left td{opacity:.5}"
      + ".stc-tbl td.who{font-weight:650}"
      + ".stc-pill{display:inline-block;font-size:var(--t6);font-weight:800;letter-spacing:.04em;padding:2px 8px;border-radius:999px}"
      + ".stc-pill.ok{background:var(--pos-bg);color:var(--pos)}"
      + ".stc-pill.owe{background:var(--neg-bg);color:var(--neg)}"
      + ".stc-pill.off{background:var(--line);color:var(--muted)}"
      // drawer
      + ".stc-scrim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:60;opacity:0;pointer-events:none;transition:opacity .18s}"
      + ".stc-scrim.on{opacity:1;pointer-events:auto}"
      + ".stc-draw{position:fixed;top:0;right:0;bottom:0;width:min(680px,46vw);background:var(--bg);border-left:1px solid var(--line-2);z-index:61;transform:translateX(100%);transition:transform .22s ease;display:flex;flex-direction:column}"
      + "@media(max-width:900px){.stc-draw{width:100vw}}"
      + ".stc-draw.on{transform:none}"
      + ".stc-dh{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;gap:12px}"
      + ".stc-dh h3{margin:0;font-size:20px;letter-spacing:-.3px}"
      + ".stc-dh p{margin:3px 0 0;font-size:var(--t5);color:var(--faint)}"
      + ".stc-x{margin-left:auto;background:none;border:1px solid var(--line);color:var(--muted);border-radius:9px;width:30px;height:30px;font-size:16px;cursor:pointer;line-height:1;flex:none}"
      + ".stc-db{padding:16px 20px 40px;overflow:auto;flex:1}"
      + ".stc-sec{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px 16px;margin-bottom:13px}"
      + ".stc-sec h5{margin:0 0 8px;font-size:var(--t6);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}"
      + ".stc-row{display:flex;justify-content:space-between;gap:10px;font-size:var(--t4);padding:5px 0;border-bottom:1px solid var(--line)}"
      + ".stc-row:last-child{border-bottom:0}"
      + ".stc-row b{font-weight:700}"
      + ".stc-row .sub{color:var(--faint);font-weight:400}"
      + ".stc-note{font-size:var(--t4);color:var(--muted);line-height:1.55;white-space:pre-wrap}"
      + ".stc-empty{padding:30px;text-align:center;color:var(--faint);font-size:var(--t3);background:var(--panel);border:1px solid var(--line);border-radius:14px}"
      + "</style>"
      + '<div class="stc"><div id="stcMain"></div></div>'
      + '<div class="stc-scrim" id="stcScrim"></div>'
      + '<div class="stc-draw" id="stcDraw"><div id="stcDrawIn" style="display:flex;flex-direction:column;height:100%"></div></div>';

    var main = host.querySelector("#stcMain");
    var scrim = host.querySelector("#stcScrim");
    var draw = host.querySelector("#stcDraw");

    /* ================================================================ data */
    main.innerHTML = '<div class="stc-empty">Loading the storage register…</div>';
    Promise.all([
      RS.load("fct_storage_register"),
      RS.load("fct_storage_vault"),
      RS.load("st_payments").catch(function () { return []; }),
      RS.load("st_crew").catch(function () { return []; }),
      RS.load("fct_storage_facility").catch(function () { return []; }),
      RS.load("fct_storage_rent").catch(function () { return []; }),
      RS.load("st_custody").catch(function () { return []; }),
    ]).then(function (rs) {
      S.reg = (rs[0] || []).map(function (r) {
        ["Chargeable CF", "Real CF", "Fee per CF", "Fee per CF Initial", "Monthly I", "Monthly II",
         "Total Bill", "Total Paid", "Balance"].forEach(function (k) { r[k] = num(r[k]); });
        ["Active", "Vault Count", "Accruals I", "Accruals II"].forEach(function (k) { r[k] = num(r[k]); });
        ["Entered", "Left", "Billing Start", "Price Changed", "Next Payment"].forEach(function (k) {
          r[k] = r[k] ? String(r[k]).slice(0, 10) : null;
        });
        return r;
      });
      S.vaults = (rs[1] || []).map(function (v) {
        v.Active = num(v.Active); v.Balance = num(v.Balance);
        v["Chargeable CF"] = num(v["Chargeable CF"]);
        return v;
      });
      S.pays = rs[2] || [];
      S.fac = (rs[4] || []).map(function (f) {
        ["Capacity CF", "Seed Monthly", "Last Amount", "Monthly Run Rate", "Paid 12mo",
         "Paid Total", "Charges", "USD per CF", "Active Items", "Occupied CF",
         "Unit Count"].forEach(function (k) { f[k] = num(f[k]); });
        ["First Charge", "Last Charge"].forEach(function (k) { f[k] = f[k] ? String(f[k]).slice(0, 10) : null; });
        return f;
      });
      S.rent = (rs[5] || []).map(function (r) {
        r.Amount = num(r.Amount);
        r.Date = r.Date ? String(r.Date).slice(0, 10) : null;
        return r;
      });
      S.custody = (rs[6] || []).map(function (c) {
        c.Posted = c.Posted ? String(c.Posted).slice(0, 10) : null;
        c["Photo Count"] = num(c["Photo Count"]);
        return c;
      });
      S.crew = {};
      (rs[3] || []).forEach(function (c) {
        var e = String(c.Email || "").toLowerCase().trim();
        if (e && (!S.crew[e] || String(c.Status || "").toLowerCase() === "active")) S.crew[e] = c["Full Name"];
      });
      paint();
    }).catch(function (e) {
      main.innerHTML = '<div class="stc-empty">Could not load the register — ' + esc(e && e.message || e) + "</div>";
    });

    function matches(r, q) {
      return [r.Customer, r["Job Code"], r.Location, r["Location Label"], r.Unit, r.Vaults, r.Notes]
        .join(" ").toLowerCase().indexOf(q) >= 0;
    }
    function view() {
      var q = S.q.toLowerCase();
      return S.reg.filter(function (r) {
        if (S.show === "active" && r.Active !== 1) return false;
        if (S.kind && r["Location Kind"] !== S.kind) return false;
        if (S.owing && !owes(r)) return false;
        if (q && !matches(r, q)) return false;
        return true;
      });
    }

    /* ================================================================ paint */
    function paint() {
      var rows = view();
      var act = S.reg.filter(function (r) { return r.Active === 1; });
      var cf = act.reduce(function (a, r) { return a + (r["Chargeable CF"] || 0); }, 0);
      var owed = act.reduce(function (a, r) { return a + (owes(r) ? r.Balance : 0); }, 0);
      var occ = {};
      S.vaults.forEach(function (v) { if (v.Active === 1) (occ[v.Vault] = occ[v.Vault] || []).push(v); });
      var rentedActive = act.filter(function (r) { return r["Location Kind"] === "rented"; });
      var rentedLocs = {};
      rentedActive.forEach(function (r) {
        (rentedLocs[r.Facility || "(unnamed location)"] = rentedLocs[r.Facility || "(unnamed location)"] || []).push(r);
      });

      var html = '<div class="stc-kpis">'
        + kpi(String(act.length), "Goods in storage", S.reg.length + " items ever recorded", "")
        + kpi(Math.round(cf).toLocaleString(), "Cubic feet held", "chargeable, on active items", "")
        + kpi(String(Object.keys(occ).length), "Vaults occupied", "our warehouse", "")
        + (function () {
            var act = (S.fac || []).filter(function (f) { return f.Status === "active"; });
            var rate = act.reduce(function (a, f) { return a + (f["Monthly Run Rate"] || 0); }, 0);
            return kpi(usd(rate) + "/mo", "Rent we are paying",
              act.length + " facilities on the card feed", "");
          })()
        + kpi(usd(owed), "Balance outstanding", owed > 0 ? "on goods still with us" : "everyone is current",
              owed > 0 ? "neg" : "pos")
        + "</div>";

      html += '<div class="stc-bar">'
        + '<input id="stcQ" placeholder="Find a customer, job code, vault, unit…" value="' + esc(S.q) + '">'
        + '<div class="stc-seg">'
        + seg("show", "active", "In storage now") + seg("show", "all", "Everything")
        + "</div>"
        + '<div class="stc-seg">'
        + seg("kind", "", "All places") + seg("kind", "our", "Our warehouse") + seg("kind", "rented", "Rented")
        + "</div>"
        + '<div class="stc-tog' + (S.owing ? " on" : "") + '" id="stcOwe"><i></i>Owing only</div>'
        + "</div>";

      // ---- the vault board -------------------------------------------------------------
      if (S.kind !== "rented") {
        var seen = {};
        S.vaults.forEach(function (v) { seen[v.Vault] = 1; });
        var nums = Object.keys(seen).sort(function (a, b) {
          var na = parseInt(a, 10), nb = parseInt(b, 10);
          if (isNaN(na) && isNaN(nb)) return a.localeCompare(b);
          if (isNaN(na)) return 1;
          if (isNaN(nb)) return -1;
          return na - nb || a.localeCompare(b);
        });
        var q = S.q.toLowerCase();
        html += '<div class="stc-h2">Our warehouse · vault board · <b>'
          + Object.keys(occ).length + " of " + nums.length + " vaults in use</b>"
          + ' <span style="text-transform:none;letter-spacing:0;font-weight:500">— vaults the register has ever named; red edge = balance owing</span></div>';
        html += '<div class="stc-board">'
          + nums.map(function (n) {
              var items = occ[n] || [];
              if (!items.length) {
                return '<div class="stc-v empty"><div class="n">' + esc(n) + '</div><div class="who">empty</div></div>';
              }
              var first = items[0];
              var owe = items.some(function (v) { return (v.Balance || 0) > 0.5; });
              var hit = !q || items.some(function (v) { return (v.Customer + " " + (v["Job Code"] || "")).toLowerCase().indexOf(q) >= 0; });
              var d = daysIn(first);
              return '<div class="stc-v full' + (owe ? " owe" : "") + (items.length > 1 ? " multi" : "")
                + '" style="' + (hit ? "" : "opacity:.25") + '" data-job="' + esc(first["Job Code"] || "") + '" data-cust="' + esc(first.Customer) + '">'
                + '<div class="n">' + esc(n) + "</div>"
                + '<div class="who">' + items.map(function (v) { return esc(v.Customer); }).join(" · ") + "</div>"
                + '<div class="d">' + (d == null ? "" : d + " days in") + "</div></div>";
            }).join("")
          + "</div>";
      }

      // ---- rented facilities: seed geography + card-feed money + register occupancy ----
      if (S.kind !== "our") {
        var facs = (S.fac || []).slice();
        if (S.show === "active") facs = facs.filter(function (f) { return f.Status !== "closed"; });
        var itemsByFac = {};
        rentedActive.forEach(function (r) {
          var k = r["Matched Facility"] || "";
          if (k) (itemsByFac[k] = itemsByFac[k] || []).push(r);
        });
        var unplaced = rentedActive.filter(function (r) { return !r["Matched Facility"]; });
        // problems first: goods inside but the card feed went quiet; then paying-but-empty;
        // then by what each one costs us
        var RANK = { dormant: 1, active: 2, "no charges seen": 3, closed: 4 };
        facs.sort(function (a, b) {
          var pa = (a.Status === "dormant" && a["Active Items"] ? 0 : RANK[a.Status] || 9);
          var pb = (b.Status === "dormant" && b["Active Items"] ? 0 : RANK[b.Status] || 9);
          return pa - pb || (b["Monthly Run Rate"] || 0) - (a["Monthly Run Rate"] || 0);
        });
        html += '<div class="stc-h2">Rented storage \u00b7 <b>' + facs.length + " facilities</b>"
          + ' <span style="text-transform:none;letter-spacing:0;font-weight:500">\u2014 geography from the register, money from the card feed'
          + (unplaced.length ? ". " + unplaced.length + " item" + (unplaced.length === 1 ? "" : "s")
              + " below are not yet placed on a facility, so “nothing recorded inside” can simply mean the register names no unit we recognise"
              : "") + "</span></div>";
        html += facs.length
          ? '<div class="stc-rent">' + facs.map(function (f) {
              var items = itemsByFac[f.Facility] || [];
              var flag = "";
              if (f.Status === "dormant" && (f["Active Items"] || items.length)) {
                flag = '<div class="stc-flag bad">Goods inside, but no card charge since '
                  + (f["Last Charge"] ? dayLab(f["Last Charge"]) : "\u2014")
                  + " \u2014 if this unit lapses, the goods are at risk. Check the account.</div>";
              } else if (f.Status === "active" && !(f["Active Items"] || items.length)) {
                flag = '<div class="stc-flag warn">Paying ' + usd(f["Monthly Run Rate"] || f["Last Amount"])
                  + "/mo with nothing recorded inside \u2014 either goods went unregistered, or this unit can be closed.</div>";
              }
              return '<div class="stc-r stc-fac" data-fac="' + esc(f.Facility) + '">'
                + '<div class="nm">' + esc(f.Facility.split(",")[0]) + " "
                + '<span class="stc-pill ' + (f.Status === "active" ? "ok" : f.Status === "closed" ? "off" : "owe") + '">'
                + esc(f.Status) + "</span></div>"
                + '<div class="meta">' + esc(f.State || "") + " \u00b7 " + (f["Unit Count"] || 0) + " unit"
                + ((f["Unit Count"] || 0) === 1 ? "" : "s")
                + (f["Capacity CF"] ? " \u00b7 " + f["Capacity CF"].toLocaleString() + " CF" : "")
                + (f["Monthly Run Rate"] ? " \u00b7 <b>" + usd(f["Monthly Run Rate"]) + "/mo</b>" : (f["Seed Monthly"] ? " \u00b7 ~" + usd(f["Seed Monthly"]) + "/mo" : ""))
                + (f["USD per CF"] ? " \u00b7 " + usd(f["USD per CF"], 2) + "/CF" : "")
                + (f["Last Charge"] ? " \u00b7 paid " + dayLab(f["Last Charge"]) : "") + "</div>"
                + flag
                + (items.length ? '<div class="in">' + items.map(function (r) {
                    return '<div class="jrow" data-job="' + esc(r["Job Code"] || "") + '" data-cust="' + esc(r.Customer) + '">'
                      + "<span>" + esc(r.Customer) + "</span>"
                      + (r.Unit ? '<span class="u">unit ' + esc(r.Unit) + "</span>" : "")
                      + (owes(r) ? '<span class="owe">' + usd(r.Balance) + " due</span>" : "")
                      + '<span class="cf">' + (r["Chargeable CF"] ? Math.round(r["Chargeable CF"]) + " CF" : "") + "</span></div>";
                  }).join("") + "</div>" : "")
                + "</div>";
            }).join("") + "</div>"
          : '<div class="stc-empty">No rented facilities on file.</div>';
        if (unplaced.length) {
          html += '<div class="stc-h2" style="margin-top:14px">Rented items not yet placed on a facility \u00b7 <b>'
            + unplaced.length + "</b>"
            + ' <span style="text-transform:none;letter-spacing:0;font-weight:500">\u2014 the sheet names no unit the register recognises; worth fixing at the source</span></div>'
            + '<div class="stc-rent"><div class="stc-r"><div class="in" style="border-top:0;margin-top:0">'
            + unplaced.map(function (r) {
                return '<div class="jrow" data-job="' + esc(r["Job Code"] || "") + '" data-cust="' + esc(r.Customer) + '">'
                  + "<span>" + esc(r.Customer) + "</span>"
                  + '<span class="u">' + esc(r.Facility || "?") + (r.Unit ? " \u00b7 " + esc(r.Unit) : "") + "</span>"
                  + '<span class="cf">' + (r["Chargeable CF"] ? Math.round(r["Chargeable CF"]) + " CF" : "") + "</span></div>";
              }).join("")
            + "</div></div></div>";
        }
      }

      // ---- the register ----------------------------------------------------------------
      rows.sort(function (a, b) { return String(b.Entered || "").localeCompare(String(a.Entered || "")); });
      html += '<div class="stc-h2">Register · <b>' + rows.length + " item" + (rows.length === 1 ? "" : "s") + "</b></div>";
      html += rows.length
        ? '<div class="stc-tblwrap" style="max-height:60vh"><table class="stc-tbl"><thead><tr>'
          + "<th>Customer</th><th>Job</th><th>Where</th><th>CF</th><th>Entered</th><th>Days</th>"
          + "<th>$/CF</th><th>Monthly</th><th>Billed</th><th>Paid</th><th>Balance</th><th>Status</th>"
          + "</tr></thead><tbody>"
          + rows.map(function (r, i) {
              var d = daysIn(r);
              var where = r["Location Kind"] === "our"
                ? (r.Vaults ? "Vaults " + r.Vaults : "Our warehouse")
                : r["Location Kind"] === "truck" ? "In our truck"
                : ((r.Facility || r["Location Label"] || r.Location || "—") + (r.Unit ? " · " + r.Unit : ""));
              return '<tr class="' + (r.Active === 1 ? "" : "left") + '" data-i="' + i + '">'
                + '<td class="who">' + esc(r.Customer) + "</td>"
                + "<td>" + esc(r["Job Code"] || "—") + "</td>"
                + "<td>" + esc(where.slice(0, 44)) + "</td>"
                + "<td>" + (r["Chargeable CF"] ? Math.round(r["Chargeable CF"]).toLocaleString() : "—") + "</td>"
                + "<td>" + dayLab(r.Entered) + "</td>"
                + "<td>" + (d == null ? "—" : d) + "</td>"
                + "<td>" + (r["Fee per CF"] != null ? usd(r["Fee per CF"], 2) : "—") + "</td>"
                + "<td>" + usd(r["Monthly I"] != null || r["Monthly II"] != null
                    ? (r["Monthly I"] || 0) + (r["Monthly II"] || 0) : null) + "</td>"
                + "<td>" + usd(r["Total Bill"]) + "</td>"
                + "<td>" + usd(r["Total Paid"]) + "</td>"
                + "<td>" + (owes(r) ? '<b style="color:var(--neg)">' + usd(r.Balance) + "</b>" : usd(r.Balance)) + "</td>"
                + "<td>" + pill(r) + "</td></tr>";
            }).join("")
          + "</tbody></table></div>"
        : '<div class="stc-empty">Nothing matches this filter.</div>';

      main.innerHTML = html;
      wire(rows);
    }

    function kpi(v, lab, sub, cls) {
      return '<div class="stc-kpi ' + cls + '"><b>' + esc(v) + "</b><span>" + esc(lab) + "</span><small>" + esc(sub) + "</small></div>";
    }
    function seg(key, val, lab) {
      return '<button data-k="' + key + '" data-v="' + val + '"'
        + (S[key] === val ? ' class="on"' : "") + ">" + lab + "</button>";
    }
    function pill(r) {
      if (r.Active !== 1) return '<span class="stc-pill off">left' + (r.Left ? " " + esc(String(r.Left).slice(5)) : "") + "</span>";
      if (owes(r)) return '<span class="stc-pill owe">' + esc(r["Payment Status"] || "owing") + "</span>";
      return '<span class="stc-pill ok">' + esc(r["Payment Status"] || "current") + "</span>";
    }

    function wire(rows) {
      var q = main.querySelector("#stcQ");
      q.oninput = function () {
        S.q = this.value;
        var at = this.selectionStart;
        paint();
        var n = main.querySelector("#stcQ");
        if (n) { n.focus(); n.setSelectionRange(at, at); }
      };
      main.querySelectorAll(".stc-seg button").forEach(function (b) {
        b.onclick = function () { S[b.dataset.k] = b.dataset.v; paint(); };
      });
      var ow = main.querySelector("#stcOwe");
      if (ow) ow.onclick = function () { S.owing = !S.owing; paint(); };
      main.querySelectorAll("[data-job],[data-cust]").forEach(function (el) {
        if (el.classList.contains("empty")) return;
        el.onclick = function (e) {
          e.stopPropagation();
          var r = findItem(el.dataset.job, el.dataset.cust);
          if (r) openItem(r);
        };
      });
      main.querySelectorAll(".stc-fac").forEach(function (el) {
        el.onclick = function () {
          var f = (S.fac || []).filter(function (x) { return x.Facility === el.dataset.fac; })[0];
          if (f) openFacility(f);
        };
      });
      main.querySelectorAll(".stc-tbl tr[data-i]").forEach(function (tr) {
        tr.onclick = function () { openItem(rows[+tr.dataset.i]); };
      });
    }
    function findItem(job, cust) {
      var hit = null;
      S.reg.forEach(function (r) {
        if (hit) return;
        if (job && r["Job Code"] === job) hit = r;
        else if (!job && cust && r.Customer === cust && r.Active === 1) hit = r;
      });
      return hit;
    }

    /* ================================================================ the item file */
    function openItem(r) {
      S.open = r;
      var d = daysIn(r);
      var fore = r["Foreman Email"] ? (S.crew[r["Foreman Email"]] || r["Foreman Email"]) : null;
      var pays = S.pays.filter(function (p) {
        return r["Job Code"] && String(p["Job Code"]).trim().toUpperCase() === String(r["Job Code"]).trim().toUpperCase();
      }).sort(function (a, b) { return String(b["Payment Date"] || "").localeCompare(String(a["Payment Date"] || "")); });

      var h = '<div class="stc-dh"><div><h3>' + esc(r.Customer) + "</h3>"
        + "<p>" + esc(r["Job Code"] || "no job code")
        + (r.Company ? " · " + esc(r.Company) : "")
        + (fore ? " · foreman " + esc(fore) : "") + "</p></div>"
        + '<button class="stc-x" id="stcX">&times;</button></div><div class="stc-db">';

      h += '<div class="stc-sec"><h5>Where & since when</h5>'
        + row("Place", r["Location Kind"] === "our"
            ? "Our warehouse" + (r.Vaults ? " — vault" + (r["Vault Count"] > 1 ? "s" : "") + " " + r.Vaults : "")
            : r["Location Kind"] === "truck" ? "In our truck"
            : (r.Facility || r["Location Label"] || r.Location || "—") + (r.Unit ? " · unit " + r.Unit : ""))
        + row("Entered", dayLab(r.Entered) + (d != null ? " · " + d + " days" + (r.Active === 1 ? " and counting" : "") : ""))
        + (r.Left ? row("Left", dayLab(r.Left)) : "")
        + row("Cubic feet", (r["Chargeable CF"] ? Math.round(r["Chargeable CF"]).toLocaleString() + " chargeable" : "—")
            + (r["Real CF"] && r["Real CF"] !== r["Chargeable CF"] ? " · " + Math.round(r["Real CF"]).toLocaleString() + " real" : ""))
        + (r["Inventory Status"] ? row("Sheet status", r["Inventory Status"]) : "")
        + "</div>";

      h += '<div class="stc-sec"><h5>Billing</h5>'
        + row("Rate", (r["Fee per CF"] != null ? usd(r["Fee per CF"], 2) + " per CF / month" : "—")
            + (r["Price Changed"] && r["Fee per CF Initial"] != null && r["Fee per CF Initial"] !== r["Fee per CF"]
                ? ' <span class="sub">was ' + usd(r["Fee per CF Initial"], 2) + " until " + dayLab(r["Price Changed"]) + "</span>" : ""))
        + ((r["Monthly I"] != null || r["Monthly II"] != null)
            ? row("Monthly", usd((r["Monthly I"] || 0) + (r["Monthly II"] || 0))
                + (r["Monthly II"] ? ' <span class="sub">' + usd(r["Monthly I"]) + " + " + usd(r["Monthly II"])
                  + " across the price change</span>" : "")
                + ((r["Accruals I"] || r["Accruals II"])
                  ? ' <span class="sub">· ' + ((r["Accruals I"] || 0) + (r["Accruals II"] || 0)) + " months accrued</span>" : ""))
            : "")
        + (r["Billing Start"] ? row("Billing since", dayLab(r["Billing Start"])) : "")
        + (r["Next Payment"] && r.Active === 1 ? row("Next payment", dayLab(r["Next Payment"])) : "")
        + "</div>";

      h += '<div class="stc-sec"><h5>Money</h5>'
        + row("Billed", usd(r["Total Bill"]))
        + row("Paid", usd(r["Total Paid"]))
        + '<div class="stc-row"><span>Balance</span><b style="color:' + (owes(r) ? "var(--neg)" : "var(--pos)") + '">'
        + usd(r.Balance) + (r["Payment Status"] ? ' <span class="sub">· ' + esc(r["Payment Status"]) + "</span>" : "") + "</b></div>"
        + "</div>";

      if (pays.length) {
        h += '<div class="stc-sec"><h5>Payments recorded · ' + pays.length + "</h5>"
          + pays.map(function (p) {
              return '<div class="stc-row"><span>' + dayLab(String(p["Payment Date"] || "").slice(0, 10))
                + (p["Payment Type"] ? ' <span class="sub">' + esc(p["Payment Type"]) + "</span>" : "") + "</span>"
                + "<b>" + usd(num(p.Amount)) + "</b></div>";
            }).join("")
          + "</div>";
      }

      h += custodyBlock(r.Customer);
      if (r.Notes) h += '<div class="stc-sec"><h5>Notes</h5><div class="stc-note">' + esc(r.Notes) + "</div></div>";
      h += "</div>";

      draw.querySelector("#stcDrawIn").innerHTML = h;
      draw.classList.add("on");
      scrim.classList.add("on");
      draw.querySelector("#stcX").onclick = close;
    }
    /* the facility file: what it costs, what is inside, every charge on the card feed */
    function openFacility(f) {
      var items = (S.reg || []).filter(function (r) {
        return r.Active === 1 && r["Matched Facility"] === f.Facility;
      });
      var charges = (S.rent || []).filter(function (c) { return c.Facility === f.Facility; })
        .sort(function (a, b) { return String(b.Date || "").localeCompare(String(a.Date || "")); });

      var h = '<div class="stc-dh"><div><h3>' + esc(f.Facility.split(",")[0]) + "</h3>"
        + "<p>" + esc(f.Address || "") + (f.Stores ? " \u00b7 store " + esc(f.Stores) : "") + "</p></div>"
        + '<button class="stc-x" id="stcX">&times;</button></div><div class="stc-db">';

      h += '<div class="stc-sec"><h5>The unit' + ((f["Unit Count"] || 0) === 1 ? "" : "s") + "</h5>"
        + row("Units", esc(f.Units || "\u2014"))
        + (f["Capacity CF"] ? row("Capacity", f["Capacity CF"].toLocaleString() + " CF") : "")
        + row("Status", esc(f.Status) + (f["Closed At"] ? " \u00b7 " + esc(f["Closed At"]) : ""))
        + "</div>";

      h += '<div class="stc-sec"><h5>What it costs us</h5>'
        + (f["Monthly Run Rate"] ? row("Run rate", usd(f["Monthly Run Rate"]) + "/mo"
            + (f["USD per CF"] ? ' <span class="sub">\u00b7 ' + usd(f["USD per CF"], 2) + " per CF</span>" : "")) : "")
        + (f["Seed Monthly"] && !f["Monthly Run Rate"] ? row("Listed rent", "~" + usd(f["Seed Monthly"]) + "/mo") : "")
        + (f["Last Charge"] ? row("Last charged", dayLab(f["Last Charge"]) + " \u00b7 " + usd(f["Last Amount"])) : "")
        + (f["Paid 12mo"] ? row("Paid, last 12 months", usd(f["Paid 12mo"])) : "")
        + (f["Paid Total"] ? row("Paid, all time", usd(f["Paid Total"])
            + ' <span class="sub">\u00b7 ' + (f.Charges || 0) + " charges</span>") : "")
        + (!f.Charges ? row("Card feed", "no charges matched \u2014 the store number for this address is not mapped yet") : "")
        + "</div>";

      h += '<div class="stc-sec"><h5>Inside \u00b7 ' + items.length + "</h5>"
        + (items.length ? items.map(function (r) {
            return '<div class="stc-row"><span>' + esc(r.Customer)
              + (r.Unit ? ' <span class="sub">unit ' + esc(r.Unit) + "</span>" : "") + "</span>"
              + "<b>" + (r["Chargeable CF"] ? Math.round(r["Chargeable CF"]) + " CF" : "")
              + (owes(r) ? ' <span style="color:var(--neg)">' + usd(r.Balance) + " due</span>" : "") + "</b></div>";
          }).join("") : '<div class="stc-row"><span>Nothing registered inside.</span></div>')
        + "</div>";

      if (charges.length) {
        h += '<div class="stc-sec"><h5>Card charges \u00b7 newest ' + Math.min(24, charges.length)
          + " of " + charges.length + "</h5>"
          + charges.slice(0, 24).map(function (c) {
              return '<div class="stc-row"><span>' + dayLab(c.Date)
                + (c.Company ? ' <span class="sub">' + esc(c.Company) + "</span>" : "") + "</span>"
                + "<b>" + usd(c.Amount) + "</b></div>";
            }).join("")
          + "</div>";
      }
      h += "</div>";

      draw.querySelector("#stcDrawIn").innerHTML = h;
      draw.classList.add("on");
      scrim.classList.add("on");
      draw.querySelector("#stcX").onclick = close;
    }

    /* The Slack trail: what the ops channel says about this customer's goods — the photos
     * they uploaded by hand, as links into Slack itself (the team is signed in there; the
     * portal never copies customer photos out). */
    var CUSTODY_LAB = { rented_storage: "in rented storage", our_warehouse: "in our warehouse",
      carrier: "with a carrier", delivered: "delivered", truck: "in a truck" };
    function slugName(x) { return String(x || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
    function custodyBlock(customer) {
      var k = slugName(customer);
      if (!k) return "";
      var trail = (S.custody || []).filter(function (c) { return slugName(c.Customer) === k; })
        .sort(function (a, b) { return String(b.TS || "").localeCompare(String(a.TS || "")); });
      if (!trail.length) return "";
      var h = '<div class="stc-sec"><h5>Slack custody trail \u00b7 ' + trail.length
        + " post" + (trail.length === 1 ? "" : "s") + "</h5>";
      trail.slice(0, 4).forEach(function (c) {
        var what = CUSTODY_LAB[c.Custody] || c.Custody || "";
        var detail = [
          c.Facility ? esc(c.Facility) : "",
          c.Units ? "unit " + esc(c.Units) : "",
          c.Carrier ? "carrier " + esc(c.Carrier) + (c.Rate ? " @ $" + esc(c.Rate) : "") : "",
          c.Delivered ? "delivered" + (c["Delivered On"] ? " " + esc(c["Delivered On"]) : "") : "",
          c.Flags ? esc(c.Flags) : "",
        ].filter(Boolean).join(" \u00b7 ");
        var photos = [];
        try { photos = JSON.parse(c.Photos || "[]"); } catch (e) {}
        h += '<div class="stc-row" style="align-items:flex-start"><span>' + dayLab(c.Posted)
          + ' <span class="sub">' + esc(what) + "</span>"
          + (detail ? '<br><span class="sub">' + detail + "</span>" : "") + "</span>"
          + "<b>" + photos.slice(0, 4).map(function (ph, i) {
              return '<a href="' + esc(ph.link) + '" target="_blank" rel="noopener" '
                + 'style="color:var(--blue);text-decoration:none;margin-left:8px">\ud83d\udcf7 ' + (i + 1) + "</a>";
            }).join("")
          + '<a href="' + esc(c.Permalink) + '" target="_blank" rel="noopener" '
          + 'style="color:var(--faint);text-decoration:none;margin-left:8px">↗</a>' + "</b></div>";
      });
      return h + "</div>";
    }

    function row(k, v) {
      return '<div class="stc-row"><span>' + esc(k) + "</span><b>" + v + "</b></div>";
    }
    function close() {
      draw.classList.remove("on");
      scrim.classList.remove("on");
      S.open = null;
    }
    scrim.onclick = close;
    if (!window.__STC_ESC) {
      window.__STC_ESC = function (e) {
        var d = document.getElementById("stcDraw");
        if (e.key === "Escape" && d && d.classList.contains("on")) {
          d.classList.remove("on");
          var sc = document.getElementById("stcScrim");
          if (sc) sc.classList.remove("on");
          if (window.__STC) window.__STC.open = null;
        }
      };
      document.addEventListener("keydown", window.__STC_ESC);
    }
  },
});
