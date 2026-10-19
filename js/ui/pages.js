import { INDUSTRIES, SECURITIES, LUXURY, PEOPLE } from "../core/catalog.js";
import { cash, sheet, balance, ACCOUNTS, income } from "../core/accounting.js";
import {
  valuation,
  netWorth,
  portfolio,
  groupSheet,
  specOf,
  ownership,
  unitValue,
  rating,
  covenants,
  annualRate,
  debt,
  runway,
  date,
  integrity,
} from "../core/selectors.js";
import {
  esc,
  money,
  pct,
  number,
  tone,
  button,
  tag,
  stat,
  empty,
  field,
  select,
  row,
  chart,
  heading,
  newsList,
} from "./components.js";
const form = (name, body, cls = "") =>
  `<form data-form="${name}" class="${cls}">${body}</form>`;
const submit = (text, cls = "primary") =>
  `<button type="submit" class="${cls}">${text}</button>`;
const notes = {
  hq: "Every balance sheet tells a story. Write the next chapter.",
  subs: "Each business has its own cash, working capital, and operating risks.",
  finance: "Fund growth without surrendering your resilience.",
  reports: "Follow the money. Understand what your companies actually earn.",
  exec: "Give capable people authority. Keep accountability.",
  macro:
    "The economy connects your businesses, your borrowing, and your portfolio.",
  market: "Personal capital. Global opportunities. Real consequences.",
  life: "Your company builds value. Decide what that value is for.",
};
export const pageNotes = notes;
export function dashboard(s) {
  let health = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          s.credit / 17 +
            (cash(s.parent) > 0 ? 25 : 0) +
            (s.last.profit > 0 ? 15 : 0) +
            s.reputation / 10,
        ),
      ),
    ),
    gs = groupSheet(s),
    pending = s.decisions.filter((d) => !d.resolved);
  return `<div class="grid-main"><div><div class="card">${heading("Empire performance", "Market value of your holding company equity", tag("MONTHLY CLOSES"))}<div class="chart-key"><span>● Holding company equity</span><span>Attributable profit <b class="${tone(s.last.attributable || 0)}">${money(s.last.attributable || 0)}</b></span></div>${chart(s.history)}<div class="chart-labels"><span>Last ${s.history.length} records</span><span>${date(s)}</span></div><div class="macro"><span>Policy rate<strong>${pct(s.macro.rate, 2)}</strong></span><span>GDP growth<strong class="${tone(s.macro.growth)}">${pct(s.macro.growth)}</strong></span><span>Business cycle<strong>${esc(s.macro.regime)}</strong></span><span>Credit rating<strong>${rating(s)} / ${s.credit}</strong></span></div></div><div class="card section-space">${heading("Operating companies", "A portfolio of real obligations", button("Explore industries →", "navigate", "subs", "text-link"))}${unitTable(s, true)}</div><div class="two-col section-space"><div class="card">${heading("Where your cash lives", "Profit does not equal available treasury.")} ${row("Parent treasury", money(cash(s.parent)))}${row("Subsidiary cash", money(gs.cash - cash(s.parent)))}${row("Receivables awaiting collection", money(gs.receivables))}${row("Taxes accrued", money(gs.taxPayable))}${row("Last upstream distributions", money(s.last.distributions))}</div><div class="card">${heading("This month’s economics", "Consolidated operating results")}${row("External revenue", money(s.last.revenue))}${row("EBITDA", money(s.last.ebitda), tone(s.last.ebitda))}${row("Operating cash flow", money(s.last.operatingCash), tone(s.last.operatingCash))}${row("Interest expense", money(s.last.interest))}${row("Book equity attributable to group", money(gs.attributable))}</div></div></div><div><div class="card dark">${heading("Empire health", "A diagnostic, not a guarantee.")}<div class="health-ring">${health}<small>/100</small></div><p class="health-caption">${health >= 75 ? "Well positioned for the long game" : health >= 50 ? "Protect your runway" : "Liquidity needs your attention"}</p>${[
    ["Credit strength", s.credit / 8.5],
    ["Group reputation", s.reputation],
    [
      "Regulatory compliance",
      s.units.length
        ? s.units.reduce((n, u) => n + u.compliance, 0) / s.units.length
        : 100,
    ],
  ]
    .map(
      ([label, v]) =>
        `<div class="health-row"><span>${label}</span><span>${number(v)}%</span></div><div class="bar"><i style="width:${v}%"></i></div>`,
    )
    .join(
      "",
    )}</div><div class="card section-space">${heading("Chairman’s briefing", "Important developments, in order of arrival")}${newsList(s.logs.slice(0, 5))}${button("Open full newswire", "news", "", "text-link section-space")}</div>${pending.length ? `<div class="card section-space">${heading("Board resolutions", pending.length + " decisions await your vote")}${pending.map((d) => `<div class="news-item"><div><strong>${esc(d.title)}</strong><p>${esc(d.description)}</p><small>Expires turn ${d.expires}</small><div class="action-row">${button("Approve · " + money(d.cost), "decision", d.id, "mini primary", 'data-accept="true"')}${button("Decline", "decision", d.id, "mini", 'data-accept="false"')}</div></div></div>`).join("")}</div>` : ""}</div></div><div class="banner"><div><strong>✧ Build a business that can survive a cycle.</strong><p class="subtitle">Cash conversion, sensible debt, and patient capital matter more than headline revenue.</p></div>${button("Capital dashboard →", "navigate", "finance", "mini")}</div>`;
}
export function unitTable(s, compact = false) {
  if (!s.units.length)
    return empty(
      "An empire begins with one operating company.",
      button("Explore your first business →", "catalog", "", "primary"),
    );
  return `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Status</th><th>Revenue / month</th><th>Operating cash</th>${compact ? "" : "<th>Cash runway</th><th>Ownership</th>"}<th></th></tr></thead><tbody>${s.units
    .map((u) => {
      let spec = specOf(u),
        last = u.results.at(-1),
        run = runway(u);
      return `<tr><td><div class="unit-name"><span class="unit-icon">${spec.icon}</span><div><strong>${esc(u.name)}</strong><div class="muted tiny">${spec.name} · L${u.level}</div></div></div></td><td>${tag(u.status === "construction" ? u.buildRemaining + " months to opening" : u.status, u.status === "closed" ? "bad" : "")}</td><td>${money(last?.revenue || 0)}</td><td class="${tone(last?.operatingCash || 0)}">${money(last?.operatingCash || 0)}</td>${compact ? "" : `<td>${Number.isFinite(run) ? number(run, 1) + " mo" : "Self-funding"}<div class="muted tiny">${money(cash(u.ledger))} cash</div></td><td>${pct(ownership(u))}<div class="muted tiny">${u.public ? "Listed" : "Private"}</div></td>`}<td>${button("Manage →", "unit", u.id, "text-link")}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
export function subsidiaries(s) {
  return `<div class="card">${heading("Your operating portfolio", s.units.length + " subsidiaries · separate operating accounts", button("Add a business +", "catalog", "", "primary"))}${unitTable(s)}</div><div class="card section-space">${heading("The connected group", "Vertical integration reduces external input costs, without booking synthetic internal revenue.")}<div class="synergies">${[
    ["steel", "commercial", "Steel → property & warehousing"],
    ["solar", "saas", "Solar → industrial & computing power"],
    ["warehouse", "ecommerce", "Logistics → e-commerce fulfillment"],
  ]
    .map(
      ([a, b, label]) =>
        `<div class="synergy"><span class="unit-icon">⇄</span><div><strong>${label}</strong><p class="muted">${s.units.some((u) => u.industry === a && u.status === "operating") && s.units.some((u) => u.industry === b && u.status === "operating") ? "Active · external input cost reduction" : "Build both businesses to activate"}</p></div></div>`,
    )
    .join("")}</div></div>${catalog(s)}`;
}
export function catalog(s) {
  return `<div class="card-header section-space"><div><h2>Opportunity universe</h2><p class="subtitle">Investment includes 70% fixed assets, 25% operating cash, and 5% input inventory.</p></div></div><div class="catalog">${INDUSTRIES.map((i) => `<article class="card industry-card"><div class="industry-top"><span class="unit-icon">${i.icon}</span>${tag(i.sector.toUpperCase())}</div><h2>${i.name}</h2><p>${i.description}</p><div class="catalog-facts">${row("Investment required", money(i.cost))}${row("Construction period", i.build + " months")}${row("Monthly capacity", number(i.capacity) + " " + i.unit)}${row("Base selling price", money(i.price))}${row("Fixed costs / month", money(i.fixed))}</div><div class="action-row">${button("Build · " + money(i.cost), "build", i.id, "primary")}${button("Acquire · " + money(i.cost * 1.2), "acquire", i.id)}</div></article>`).join("")}</div>`;
}
export function unitDetail(s, u) {
  let spec = specOf(u),
    r = u.results.at(-1),
    b = sheet(u.ledger),
    run = runway(u),
    p = u.policy;
  return `<div class="eyebrow">${spec.sector} / ${u.public ? "PUBLIC" : "PRIVATE"} COMPANY</div><h1>${esc(u.name)}</h1><p class="subtitle">${spec.name} · ${pct(ownership(u))} owned · ${u.status}</p><div class="detail-metrics section-space">${stat("Operating bank", money(b.cash), "Subsidiary funds")}${stat("Indicative equity value", money(unitValue(s, u)), "Not cash available to spend")}${stat("Cash runway", Number.isFinite(run) ? number(run, 1) + " mo" : "Self-funding", "Trailing three-month cash burn")}</div>${u.status === "construction" ? `<div class="banner">Construction: ${u.buildRemaining} of ${u.buildTotal} months remaining. Pre-opening expenses are paid from subsidiary cash.</div>` : ""}${u.status === "closed" ? '<div class="banner danger">This company is in administration. It does not trade. Divest if a buyer is available.</div>' : ""}<div class="two-col section-space"><div class="card">${heading("Operating results", "Latest monthly close")}${row("External sales", money(r?.revenue || 0))}${row("Output / customers", number(r?.volume || 0, 1) + " " + spec.unit)}${row("EBITDA", money(r?.ebitda || 0))}${row("Net profit", money(r?.profit || 0))}${row("Cash from operations", money(r?.operatingCash || 0))}${spec.churn ? row("Annual recurring revenue", money(r?.arr || 0)) + row("Monthly churn", pct(r?.churn || spec.churn)) : ""}${spec.sector === "property" ? row("Occupancy", pct(u.occupancy)) : ""}${spec.sector === "science" ? row("Research progress", pct(u.research / 100)) : ""}</div><div class="card">${heading("Operating resilience", "Maintenance and wage policy change future risk.")}${row("Plant / product condition", pct(u.condition / 100))}${row("Employee morale", pct(u.morale / 100))}${row("Regulatory compliance", pct(u.compliance / 100))}${row("Product quality", pct(u.quality / 100))}${row("Receivables", money(b.receivables))}${row("Supplier invoices outstanding", money(b.payables))}${row("Tax loss carryforward", money(u.lossCarry))}</div></div><div class="card section-space">${heading("Chairman’s operating mandate", "Ratios are relative to the industry baseline. Policies take effect next month.")}${form("unit-policy", `<input type="hidden" name="id" value="${u.id}"><div class="three-col">${field("Selling price multiplier", "price", "number", p.price, 'min="0.6" max="1.6" step="0.05" required')}${field("Target capacity utilization", "utilization", "number", p.utilization.toFixed(2), 'min="0.3" max="1" step="0.05" required')}${field("Marketing budget multiplier", "marketing", "number", p.marketing, 'min="0.2" max="3" step="0.1" required')}${field("Maintenance multiplier", "maintenance", "number", p.maintenance, 'min="0.3" max="2" step="0.1" required')}${field("Wage multiplier", "wage", "number", p.wage, 'min="0.7" max="1.5" step="0.05" required')}${field("R&D / quality investment", "research", "number", p.research, 'min="0.3" max="3" step="0.1" required')}</div><label class="check"><input type="checkbox" name="autonomy" ${p.autonomy ? "checked" : ""}> Let an appointed MD adjust operations and fix critical compliance alerts</label><div class="action-row">${submit("Save operating mandate")}</div>`)}</div><div class="two-col section-space"><div class="card">${heading("Capital allocation", "Equity goes to this business, not the founder.")} ${form("inject", `<input type="hidden" name="id" value="${u.id}">${field("Parent capital injection ($)", "amount", "number", 100000, 'min="1000" required')}${submit("Inject parent equity")}`)}<div class="action-row">${button("Expand · " + money(spec.cost * 0.65), "expand", u.id)}${button("Remediate · " + money(18000 * u.level), "remediate", u.id)}</div>${u.expansion ? `<p class="subtitle">Expansion opens in ${u.expansion.remaining} months.</p>` : ""}</div><div class="card">${heading("Ownership & exit", "Primary rounds issue new shares; all owners dilute.")} ${row("Parent ownership", pct(ownership(u)))}${row("Funding rounds", u.round)}${row("Primary raise estimate", money(Math.max(spec.cost * 0.5, unitValue(s, u)) * 0.25))}<div class="action-row">${button(u.public ? "Secondary offering" : "Private equity round", "round", u.id)}${button("Pursue IPO", "ipo", u.id)}</div><div class="action-row">${button("Review divestment", "sell-unit-confirm", u.id, "danger-button")}</div><p class="subtitle">IPO: 12 operating months, 3 positive EBITDA months, and $1M equity value. Minimum retained stake: 25%.</p></div></div><div class="card section-space">${heading("Operating history", "Revenue and profitability respond to your decisions.")}${chart(u.results.map((r) => r.revenue))}</div>`;
}
export function finance(s) {
  let c = covenants(s),
    retained = Math.max(
      0,
      income(s.parent) - balance(s.parent, "distributions"),
    );
  return `<div class="three-col">${stat("Bank debt", money(debt(s)), s.loans.length + " active facilities")}${stat("Debt / market capitalization", pct(c.leverage), "Covenant ceiling: 65%")}${stat("Interest coverage", Number.isFinite(c.coverage) ? number(c.coverage, 2) + "×" : "No interest due", "Minimum: 1.5× after three reporting months")}</div>${c.breached ? '<div class="banner danger">Covenant breach: new borrowing and founder dividends are suspended. Floating facilities carry a 250bp penalty.</div>' : ""}<div class="two-col section-space"><div class="card">${heading("Commercial banking", "Underwritten against equity value and interest coverage", tag(rating(s) + " / " + s.credit))}${form(
    "borrow",
    `${field("Facility amount ($)", "amount", "number", 250000, 'min="50000" max="50000000" required')}${select(
      "Facility",
      "kind",
      [
        ["term", "Term loan · 60 months · straight-line principal"],
        ["revolver", "Revolving facility · 12 months · bullet maturity"],
      ],
      "term",
    )}${select(
      "Interest structure",
      "fixed",
      [
        ["false", "Floating · policy rate + credit spread"],
        ["true", "Fixed at origination"],
      ],
      "false",
    )}<p class="muted">1% origination fee. Early repayment is permitted. No rollover is guaranteed.</p><div class="action-row">${submit("Apply for facility")}</div>`,
  )}</div><div class="card">${heading("Founder & holding company", "Compensation is taxable and must be funded.")}${form("salary", `${field("Gross chairman salary per month ($)", "amount", "number", s.salary, 'min="0" max="100000" required')}${submit("Set salary")}`)}<hr>${form("dividend", `${field("Founder dividend ($)", "amount", "number", 10000, 'min="1" required')}<p class="muted">Realized retained parent profits: ${money(retained)}. Maximum payout: 25% of treasury. Tax withholding: 20%.</p><div class="action-row">${submit("Declare dividend")}</div>`)}</div></div><div class="card section-space">${heading("Debt register", "Floating rates reprice monthly; covenants are checked at each close.")}${s.loans.length ? `<div class="table-wrap"><table><thead><tr><th>Facility</th><th>Principal</th><th>Rate</th><th>Maturity</th><th>Monthly interest</th><th>Actions</th></tr></thead><tbody>${s.loans.map((l) => `<tr><td>${l.kind === "term" ? "Term loan" : "Revolver"} ${tag(l.fixed ? "Fixed" : "Floating")}</td><td>${money(l.balance)}</td><td>${pct(annualRate(s, l), 2)}</td><td>${l.remaining} months</td><td>${money((l.balance * annualRate(s, l)) / 12)}</td><td>${button("Repay in full", "repay", l.id, "mini", l.balance > 0 ? "" : "disabled")}${l.kind === "revolver" ? button("Redraw", "redraw-dialog", l.id, "mini") : ""}</td></tr>`).join("")}</tbody></table></div>` : empty("No bank debt. Preserve that optionality.")}</div><div class="card section-space">${heading("Founder capital injection", "A legal personal-to-corporate equity transfer. This cannot be reversed as a tax-free withdrawal.")}${form("founder-capital", `${field("Personal capital to contribute ($)", "amount", "number", 50000, 'min="1000" required')}${submit("Contribute founder capital")}`)}</div>`;
}
export function reports(s, entity = "group", journal = false) {
  let u = s.units.find((u) => String(u.id) === String(entity)),
    l = entity === "personal" ? s.personal : u ? u.ledger : s.parent,
    b = entity === "group" ? groupSheet(s) : sheet(l),
    last = u ? u.results.at(-1) : s.last;
  let pnl = last || {};
  return `<div class="card">${heading("Financial reporting", "Accrual accounting · USD · monthly periods", tag(integrity(s) ? "BOOKS RECONCILED" : "RECONCILIATION ERROR"))}<label class="report-selector">Reporting entity <select id="report-entity"><option value="group" ${entity === "group" ? "selected" : ""}>Consolidated group</option><option value="parent" ${entity === "parent" ? "selected" : ""}>Parent holding company</option><option value="personal" ${entity === "personal" ? "selected" : ""}>Founder personal accounts</option>${s.units.map((u) => `<option value="${u.id}" ${String(entity) === String(u.id) ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label><p class="subtitle">Consolidated statements include 100% of subsidiaries and separately identify noncontrolling equity. Parent investment carrying values and internal dividends are eliminated.</p></div><div class="two-col section-space"><div class="card">${heading("Balance sheet", "At " + date(s))}${row("ASSETS", "", "statement-label")}${row("Cash and bank", money(b.cash))}${row("Trade receivables", money(b.receivables))}${row("Input inventory", money(b.inventory))}${row("Net property, plant & equipment", money(b.ppe))}${entity === "group" ? "" : row("Investments at cost", money(balance(l, "investments")))}${row("Total assets", money(b.assets), "total")}${row("LIABILITIES", "", "statement-label")}${row("Trade payables", money(b.payables))}${row("Accrued corporate taxes", money(b.taxPayable))}${row("Bank borrowings", money(b.debt))}${row("Total liabilities", money(b.liabilities), "total")}${row("Total book equity", money(b.equity), "total")}${entity === "group" ? row("Noncontrolling equity", money(b.nci)) + row("Attributable book equity", money(b.attributable)) : ""}${row("Balance sheet difference", money(b.error), Math.abs(b.error) < 0.02 ? "positive" : "negative")}</div><div class="card">${
    entity === "group" || u
      ? `${heading("Income statement", u ? "Latest operating month" : "Latest monthly close")}${row("External revenue", money(pnl.revenue || 0))}${row("Cost of sales", money(pnl.cogs || 0))}${row("Operating costs & payroll", money(pnl.opex || 0))}${row("EBITDA", money(pnl.ebitda || 0), "total")}${row("Depreciation", money(pnl.depreciation || 0))}${row("Interest expense", money(pnl.interest || 0))}${row("Corporate tax accrued", money(pnl.tax || 0))}${row("Other investment income", money(pnl.otherIncome || 0))}${row("Net income", money(pnl.profit || 0), "total")}${entity === "group" ? row("Attributable to parent", money(pnl.attributable || 0)) : ""}<hr>${heading("Cash flow bridge", "Monthly operating changes; other transactions separately reconciled.")}${row("Operating cash flow", money(pnl.operatingCash || 0))}${u ? row("Upstream distribution", money(pnl.dividend || 0)) : row("Scheduled debt principal", money(pnl.financingCash || 0)) + row("Investing / between-close / NCI flows", money(pnl.otherCash || 0)) + row("Total group cash change", money(pnl.cashChange || 0), "total")}`
      : `${heading("Cumulative ledger results", "Since incorporation; investments are carried at cost.")} ${Object.entries(
          ACCOUNTS,
        )
          .filter(
            ([a, [, type]]) =>
              ["income", "expense"].includes(type) && balance(l, a) !== 0,
          )
          .map(([a, [name, type]]) =>
            row(esc(name), money((type === "income" ? -1 : 1) * balance(l, a))),
          )
          .join("")}${row("Cumulative net income", money(income(l)), "total")}`
  }</div></div><div class="card section-space">${heading("Journal explorer", entity === "group" ? "Parent journal shown. Select a subsidiary to inspect its entries." : "Latest 60 entries · oldest entries retained in balances, not the journal.")}${journalTable(l)}</div>${
    entity === "group"
      ? `<div class="card section-space">${heading("Historical monthly closes", "Up to 120 months of reporting history")}${
          s.reports.length
            ? `<div class="table-wrap"><table><thead><tr><th>Turn</th><th>Revenue</th><th>EBITDA</th><th>Attributable profit</th><th>Cash flow</th><th>Book equity</th></tr></thead><tbody>${s.reports
                .slice(-24)
                .reverse()
                .map(
                  (r) =>
                    `<tr><td>${r.turn}</td><td>${money(r.revenue)}</td><td class="${tone(r.ebitda)}">${money(r.ebitda)}</td><td class="${tone(r.attributable)}">${money(r.attributable)}</td><td>${money(r.operatingCash)}</td><td>${money(r.balanceSheet.attributable)}</td></tr>`,
                )
                .join("")}</tbody></table></div>`
            : empty("Advance a month to produce the first financial close.")
        }</div>`
      : ""
  }`;
}
function journalTable(l) {
  return `<div class="table-wrap"><table><thead><tr><th>Turn</th><th>Transaction</th><th>Debits</th><th>Credits</th></tr></thead><tbody>${l.journal
    .slice(0, 60)
    .map(
      (j) =>
        `<tr><td>${j.turn}</td><td>${esc(j.memo)}</td><td>${Object.entries(
          j.lines,
        )
          .filter(([, n]) => n > 0)
          .map(([a, n]) => `${ACCOUNTS[a][0]} ${money(n)}`)
          .join("<br>")}</td><td>${Object.entries(j.lines)
          .filter(([, n]) => n < 0)
          .map(([a, n]) => `${ACCOUNTS[a][0]} ${money(-n)}`)
          .join("<br>")}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}
export function executives(s) {
  const perks = {
    CEO: "Supports morale across the executive team.",
    CFO: "Reduces the bank credit spread and improves capital access.",
    COO: "Reduces variable operating costs in every subsidiary.",
    CMO: "Improves customer acquisition efficiency.",
    MD: "Competent autonomous MDs adjust utilization and remediate critical compliance.",
  };
  return `<div class="card">${heading("Executive committee", "Group payroll " + money(s.executives.reduce((a, e) => a + e.salary, 0)) + "/month. Signing bonus: 1 month. Severance: 2 months.")}${
    s.executives.length
      ? s.executives
          .map(
            (e) =>
              `<div class="executive-row"><div class="avatar">${esc(
                e.name
                  .split(" ")
                  .map((n) => n[0])
                  .join(""),
              )}</div><div class="grow"><strong>${esc(e.name)}</strong><p class="muted">${e.role}${e.unitId ? " · " + esc(s.units.find((u) => u.id === e.unitId)?.name) : ""} · ${money(e.salary)}/month · Loyalty ${number(e.loyalty)}%</p><p class="muted">${perks[e.role]}</p></div><div class="action-row">${button("Bonus", "bonus", e.id, "mini")}${button("Dismiss", "dismiss-confirm", e.id, "mini")}</div></div>`,
          )
          .join("")
      : empty(
          "A chairman can make every decision. A great team makes better ones.",
        )
  }</div><div class="card section-space">${heading("Governance policies", "Controls cost money. Failures usually cost more.")}${form(
    "governance",
    `<div class="policy-grid">${[
      [
        "autoSweep",
        "Automatic subsidiary distributions",
        "Profitable subsidiaries distribute cash above their working-capital reserve.",
      ],
      [
        "audit",
        "Independent internal audit",
        "Costs $3,500 monthly; improves compliance and reduces misconduct risk.",
      ],
      [
        "insurance",
        "Group operating insurance",
        "Costs 0.065% of unit capex monthly; covers 80% of eligible disruption losses.",
      ],
    ]
      .map(
        ([key, label, desc]) =>
          `<label class="policy"><input type="checkbox" name="${key}" ${s.policies[key] ? "checked" : ""}><span><strong>${label}</strong><small>${desc}</small></span></label>`,
      )
      .join("")}</div>${submit("Update governance mandate")}`,
  )}</div><div class="card-header section-space"><h2>Executive search</h2><span class="muted">Integrity and loyalty affect misconduct and resignation risk.</span></div><div class="catalog">${PEOPLE.map(
    (c, i) =>
      `<div class="card"><div class="industry-top"><div class="avatar">${c.name
        .split(" ")
        .map((x) => x[0])
        .join(
          "",
        )}</div>${tag(c.specialty)}</div><h2>${c.name}</h2><div class="catalog-facts">${row("Competence", c.competence + "/100")}${row("Integrity", c.integrity + "/100")}${row("Loyalty", c.loyalty + "/100")}${row("Monthly expectation", money(c.salary))}</div>${s.executives.some((e) => e.candidate === i) ? tag("ON YOUR TEAM") : form("hire", `<input name="candidate" type="hidden" value="${i}">${select("Appointment", "appointment", [...["CEO", "CFO", "COO", "CMO"].map((r) => [r, r]), ...s.units.map((u) => ["MD:" + u.id, "MD · " + u.name])], "CEO")}${submit("Appoint executive")}`)}</div>`,
  ).join("")}</div>`;
}
export function macro(s) {
  let m = s.macro;
  return `<div class="four-col">${stat("Real GDP growth", pct(m.growth), "Annualized economic growth")}${stat("Consumer inflation", pct(m.inflation), "Flows into wages and operating inputs")}${stat("Policy interest rate", pct(m.rate, 2), "Annual rate; reviewed quarterly")}${stat("Unemployment", pct(m.unemployment), "Labor market pressure")}</div><div class="two-col section-space"><div class="card">${heading("The business cycle", esc(m.regime) + " · " + m.regimeAge + " months in current regime")}${chart(
    m.history.map((r) => r.growth * 100),
    { currency: false, label: "GDP growth percent" },
  )}<p class="muted">The economy moves between expansion, boom, slowdown, recession, and recovery. Policy responds gradually to inflation and output. Business demand and financial assets share these shocks.</p></div><div class="card">${heading("Commodity input monitor", "Index relative to the starting economy; 1.00 = baseline.")}${Object.entries(
    m.commodities,
  )
    .map(([k, v]) =>
      row(
        esc(k[0].toUpperCase() + k.slice(1)),
        number(v, 2) + "×",
        v > 1.15 ? "negative" : "",
      ),
    )
    .join(
      "",
    )}<div class="banner">Corn affects refining inputs. Metal prices affect fabrication. Oil moves logistics costs. Energy prices influence solar output revenue.</div></div></div><div class="card section-space">${heading("Sector demand radar", "Combines cycle exposure, interest-rate sensitivity, and sector-specific noise.")}<div class="sector-radar">${Object.entries(
    m.sectors,
  )
    .map(
      ([k, v]) =>
        `<div><div class="health-row"><span>${esc(k)}</span><strong>${number(v, 2)}×</strong></div><div class="demand-bar"><i style="width:${Math.min(100, (v / 1.5) * 100)}%"></i></div></div>`,
    )
    .join(
      "",
    )}</div></div><div class="card section-space">${heading("Economic dispatches", "Latest macroeconomic news")}${newsList(s.logs.filter((l) => l.type === "macro").slice(0, 12))}</div>`;
}
export function markets(s) {
  return `<div class="banner" style="margin-top:0"><div><strong>Personal portfolio · ${money(portfolio(s))}</strong><p class="subtitle">Equity dealing fee 0.15% · Crypto 0.40% · Realized gains taxed at 20% · No leverage</p></div>${button(s.cold ? "Cold custody enabled" : "Set up cold custody · $1.5K", "cold", "", "mini", s.cold ? "disabled" : "")}</div><div class="catalog section-space">${s.market
    .map((m) => {
      let qty = s.wallet[m.symbol] || 0,
        basis = s.basis[m.symbol] || 0,
        gain = qty * m.price - basis;
      return `<div class="card market-card">${heading(m.symbol, esc(m.name), `<span class="${tone(m.change)}">${m.change >= 0 ? "+" : ""}${number(m.change, 2)}%</span>`)}<div class="metric-value">${money(m.price)}</div>${chart(m.history, { height: 130, color: m.change >= 0 ? "#739b64" : "#bf7258" })}<div class="catalog-facts">${row("Units held", number(qty, 5))}${row("Market value", money(qty * m.price))}${row("Unrealized gain", money(gain), tone(gain))}${row("Distribution yield", pct(m.yield))}</div>${form("trade", `<input name="symbol" value="${m.symbol}" type="hidden">${field("Trade value ($)", "amount", "number", 1000, 'min="1" step="0.01" required')}<div class="action-row"><button class="primary" type="submit" name="side" value="buy">Buy</button><button type="submit" name="side" value="sell">Sell</button>${button("Sell all", "sell-all", m.symbol, "mini", qty ? "" : "disabled")}</div>`)}</div>`;
    })
    .join(
      "",
    )}</div><div class="card section-space">${heading("Angel syndicate", "Illiquid, binary outcomes over 24–36 months.", button("Back a venture · $50K", "angel", "", "primary"))}<p class="muted">Base exit probabilities: 60% failure, 24% 2×, 14% 10×, 2% 100×. Realized multiples also reflect sector conditions. Capital cannot be withdrawn early.</p>${s.angels.length ? s.angels.map((a) => `<div class="news-item"><span class="unit-icon">✧</span><div><strong>${esc(a.name)}</strong><p>${money(a.basis)} committed · ${a.duration - a.age} months to outcome · ${esc(a.sector)}</p></div></div>`).join("") : empty("Patient capital accepts the possibility of a total loss.")}</div>`;
}
export function lifestyle(s) {
  let upkeep = s.assets.reduce((a, b) => a + LUXURY[b.type].upkeep, 0);
  return `<div class="two-col"><div class="card">${heading("Your private collection", "Maintenance is paid from personal cash, regardless of corporate performance.")}${s.assets.length ? s.assets.map((a) => `<div class="news-item"><span class="unit-icon">${LUXURY[a.type].icon}</span><div class="grow"><strong>${esc(a.name)}</strong><p>${money(a.value)} market value · ${money(LUXURY[a.type].upkeep)}/month baseline upkeep</p></div>${button("Review sale", "sell-asset-confirm", a.id, "mini")}</div>`).join("") : empty("A life well earned starts with a balance sheet that can support it.")}${row("Baseline monthly upkeep", money(upkeep), "total")}</div><div class="card">${heading("The legacy ledger", "Milestones earned through your decisions")}${s.goals.length ? s.goals.map((g) => `<div class="news-item"><span class="unit-icon">✧</span><div><strong>${esc(g.title)}</strong><p>Achieved at turn ${g.turn}</p></div></div>`).join("") : empty("Your legacy is still unwritten.")}${row("Peak personal net worth", money(s.stats.peakWorth))}${row("Profitable months", s.stats.turnsProfitable)}${row("Personal taxes paid", money(s.stats.personalTax))}</div></div><div class="card-header section-space"><h2>A life beyond the boardroom</h2><span class="muted">Property responds to macro conditions; vehicles depreciate monthly.</span></div><div class="catalog">${LUXURY.map((a, i) => `<div class="card luxury-card"><div class="luxury-art">${a.icon}<span>${a.kind.toUpperCase()}</span></div><div class="eyebrow">PRIVATE COLLECTION</div><h2>${a.name}</h2><div class="catalog-facts">${row("Purchase price", money(a.cost))}${row("Baseline upkeep / month", money(a.upkeep))}${row("Exit discount", "10%")}</div>${button("Acquire personally", "buy-asset", i, "primary")}</div>`).join("")}</div>`;
}
export const PAGES = {
  hq: dashboard,
  subs: subsidiaries,
  finance,
  reports,
  exec: executives,
  macro,
  market: markets,
  life: lifestyle,
};
