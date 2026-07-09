/* FINANCIAL page: Branch Owner — results for people who take a cut when listed as a
   Sales Person but are NOT real salespeople (currently Giorgi Kolbaia, a foreman-turned-
   branch-owner). Reads fct_closing's `Branch Owner` / `Branch Owner Cut` columns, which
   are populated ONLY where he's in an SP slot (never from his foreman work). Read-only.
   Respects the global date/company filter. */
registerPage({
  id: "branch-owner",
  group: "financial",
  title: "Branch Owner",
  async render(host) {
    const closingAll = await RS.load("closing");
    const num = RS.num, money = RS.money, moneyC = RS.moneyC || RS.money, fmtN = RS.fmtN;
    const pctS = v => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";

    // his SP-cut jobs, within the global filter scope (trips carry no SP -> excluded)
    const scoped = RS.filtered("closing", closingAll).filter(r =>
      r["Record Source"] === "closing" &&
      r["Branch Owner"] != null && String(r["Branch Owner"]).trim() !== "");

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Branch Owner</h1>
        <p>Results for a branch owner — someone who takes a cut when listed as a
           <b>Sales Person</b>, not a real salesperson (currently <b>Giorgi Kolbaia</b>).
           Counts <b>only his SP-slot cut</b>, never his foreman jobs.
           <span class="freshness">· read-only · respects the date/company filter</span></p>
      </div>
      <div class="rs-kpis" id="boKpis"></div>
      <div id="boTrend"></div>
      <div id="boDetail"></div>`;

    if (!scoped.length) {
      document.getElementById("boKpis").innerHTML =
        `<div class="rs-loading">No branch-owner jobs in the current filter range.</div>`;
      return;
    }

    const totalBill = scoped.reduce((a, r) => a + num(r["Total Bill"]), 0);
    const totalCut  = scoped.reduce((a, r) => a + num(r["Branch Owner Cut"]), 0);
    const owners = [...new Set(scoped.map(r => r["Branch Owner"]))];
    const avgPct = totalBill ? totalCut / totalBill : 0;

    RSC.kpis(document.getElementById("boKpis"), [
      { label: "Jobs (as branch owner)", value: fmtN(scoped.length), sub: owners.join(", ") },
      { label: "Total Bill of those jobs", value: moneyC(totalBill), sub: money(totalBill) },
      { label: "His Cut", value: moneyC(totalCut), sub: money(totalCut) },
      { label: "Avg Cut %", value: pctS(avgPct), sub: "of total bill" },
    ]);

    // ---- monthly trend: his cut + the bill it came from ----
    const byMonth = {};
    scoped.forEach(r => {
      const mk = (r._y || "") + "-" + String(r._m || 0).padStart(2, "0");
      (byMonth[mk] = byMonth[mk] || { jobs: 0, bill: 0, cut: 0 });
      byMonth[mk].jobs++; byMonth[mk].bill += num(r["Total Bill"]); byMonth[mk].cut += num(r["Branch Owner Cut"]);
    });
    const months = Object.keys(byMonth).sort();
    const mrows = months.map(mk => ({
      k: mk, jobs: byMonth[mk].jobs, bill: byMonth[mk].bill, cut: byMonth[mk].cut,
      pctv: byMonth[mk].bill ? byMonth[mk].cut / byMonth[mk].bill : 0,
    }));

    RSC.chartCard(document.getElementById("boTrend"), {
      title: "Branch owner cut by month",
      key: "branch-owner-trend",
      buildChart(canvas) {
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: months,
            datasets: [
              { label: "His Cut", data: months.map(mk => byMonth[mk].cut),
                backgroundColor: "rgba(132,204,22,.78)", yAxisID: "y", order: 2 },
              { type: "line", label: "Total Bill", data: months.map(mk => byMonth[mk].bill),
                borderColor: "#64748b", backgroundColor: "#64748b", tension: .3, yAxisID: "y1", order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: {
              y:  { position: "left",  beginAtZero: true, title: { display: true, text: "His Cut ($)" } },
              y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false },
                    title: { display: true, text: "Total Bill ($)" } },
            },
          },
        });
      },
      buildTable() {
        return RSC.table(
          [{ key: "k", label: "Month" },
           { key: "jobs", label: "Jobs", align: "r", fmt: fmtN },
           { key: "bill", label: "Total Bill", align: "r", fmt: money },
           { key: "cut", label: "His Cut", align: "r", fmt: money },
           { key: "pctv", label: "Cut %", align: "r", fmt: pctS }],
          mrows,
          { k: "Total", jobs: scoped.length, bill: totalBill, cut: totalCut, pctv: avgPct });
      },
    });

    // ---- every branch-owner job (auditable detail) ----
    const detail = scoped.slice()
      .sort((a, b) => String(b["Date"] || "").localeCompare(String(a["Date"] || "")))
      .map(r => ({
        dt: r["Date"], cust: r["Customer"], co: r["Company"], req: r["Request #"],
        bill: num(r["Total Bill"]), cut: num(r["Branch Owner Cut"]),
        pctv: num(r["Total Bill"]) ? num(r["Branch Owner Cut"]) / num(r["Total Bill"]) : 0,
      }));
    const detailTable = RSC.table(
      [{ key: "dt", label: "Move Date" }, { key: "req", label: "Request #" },
       { key: "cust", label: "Customer" }, { key: "co", label: "Company" },
       { key: "bill", label: "Total Bill", align: "r", fmt: money },
       { key: "pctv", label: "Cut %", align: "r", fmt: pctS },
       { key: "cut", label: "His Cut", align: "r", fmt: money }],
      detail,
      { dt: "Total", bill: totalBill, cut: totalCut, pctv: avgPct });
    document.getElementById("boDetail").innerHTML = `
      <div class="panel" style="margin-top:14px">
        <div class="panel-head"><span class="panel-title">Every branch-owner job (${fmtN(detail.length)})</span></div>
        <div style="padding:0 4px 8px"><div class="tabwrap">${detailTable}</div></div>
      </div>`;
  },
});
