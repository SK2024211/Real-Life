import { simulateEconomy } from "../systems/economy.js";
import { operateUnit } from "../systems/businesses.js";
import { serviceDebt, settleParentTax } from "../systems/finance.js";
import { governanceMonth } from "../systems/governance.js";
import { personalMonth } from "../systems/personal.js";
import { cash } from "./accounting.js";
import {
  groupSheet,
  valuation,
  netWorth,
  integrity,
  ownership,
  operatingBalances,
  specOf,
} from "./selectors.js";
import { news } from "./state.js";
export function advanceMonth(s) {
  s.turn++;
  let opening = groupSheet(s).cash;
  simulateEconomy(s);
  let rows = s.units.map((u) => operateUnit(s, u));
  for (let i = 0; i < s.units.length; i++) {
    let u = s.units[i],
      r = rows[i],
      base = s.period.unitBalances?.[u.id] || {},
      delta = (a) => (u.ledger.balances[a] || 0) - (base[a] || 0);
    r.revenue = -delta("revenue");
    r.cogs = delta("cogs");
    r.opex = delta("opex") + delta("fees") + delta("payroll");
    r.depreciation = delta("depreciation");
    r.tax = delta("tax");
    r.ebitda = r.revenue - r.cogs - r.opex;
    r.profit =
      r.ebitda -
      r.depreciation -
      r.tax -
      delta("interest") -
      delta("investmentIncome");
    for (let [k, v] of Object.entries(r)) if (Object.is(v, -0)) r[k] = 0;
  }
  let debt = serviceDebt(s),
    governance = governanceMonth(s);
  const parentTaxPaid = settleParentTax(s);
  personalMonth(s);
  let report = {
    turn: s.turn,
    revenue: rows.reduce((a, r) => a + r.revenue, 0),
    cogs: rows.reduce((a, r) => a + r.cogs, 0),
    opex:
      rows.reduce((a, r) => a + r.opex, 0) +
      governance.cost +
      governance.payroll,
    ebitda: 0,
    depreciation: rows.reduce((a, r) => a + r.depreciation, 0),
    interest: debt.interest,
    tax: rows.reduce((a, r) => a + r.tax, 0),
    profit: 0,
    attributable: 0,
    operatingCash:
      rows.reduce((a, r) => a + r.operatingCash, 0) -
      governance.cost -
      governance.payroll -
      debt.interest -
      parentTaxPaid,
    financingCash: -debt.principal,
    capex: 0,
    cashChange: groupSheet(s).cash - opening,
    distributions: rows.reduce((a, r) => a + r.dividend, 0),
  };
  const closing = operatingBalances(s),
    delta = (a) => (closing[a] || 0) - (s.period.balances[a] || 0);
  report.revenue = -delta("revenue");
  report.cogs = delta("cogs");
  report.opex = delta("opex") + delta("payroll") + delta("fees");
  report.depreciation = delta("depreciation");
  report.interest = delta("interest");
  report.tax = delta("tax");
  report.otherIncome = -delta("investmentIncome");
  report.ebitda = report.revenue - report.cogs - report.opex;
  report.profit =
    report.ebitda -
    report.depreciation -
    report.interest -
    report.tax +
    report.otherIncome;
  report.attributable =
    report.profit -
    rows.reduce(
      (a, r, i) => a + r.profit * (1 - ownership(s.units[i])),
      s.disposedNCI || 0,
    );
  report.cashChange = groupSheet(s).cash - s.period.cash;
  report.otherCash =
    report.cashChange - report.operatingCash - report.financingCash;
  s.disposedNCI = 0;
  s.period = {
    balances: closing,
    cash: groupSheet(s).cash,
    parentBalances: { ...s.parent.balances },
    unitBalances: Object.fromEntries(
      s.units.map((u) => [u.id, { ...u.ledger.balances }]),
    ),
  };
  for (const [k, v] of Object.entries(report))
    if (Object.is(v, -0)) report[k] = 0;
  s.last = report;
  s.reports.push({
    ...report,
    balanceSheet: groupSheet(s),
    valuation: valuation(s),
  });
  s.reports = s.reports.slice(-120);
  s.history.push(valuation(s));
  s.history = s.history.slice(-120);
  s.revision++;
  if (report.attributable > 0) s.stats.turnsProfitable++;
  s.stats.peakWorth = Math.max(s.stats.peakWorth, netWorth(s));
  if (cash(s.parent) < 0)
    news(
      s,
      "Parent treasury is overdrawn. Raise founder capital, seek subsidiary distributions, or divest. New investments are blocked.",
      "alert",
    );
  for (const [id, title, done] of [
    [
      "first",
      "First operating company",
      s.units.some((u) => u.status === "operating"),
    ],
    [
      "diverse",
      "Three-sector holding company",
      new Set(s.units.map((u) => specOf(u).sector)).size >= 3,
    ],
    ["million", "First million in personal net worth", netWorth(s) >= 1e6],
    ["ipo", "Public-market debut", s.units.some((u) => u.public)],
    ["decade", "A decade of stewardship", s.turn >= 120],
    ["profitable", "Twelve profitable months", s.stats.turnsProfitable >= 12],
  ])
    if (done && !s.goals.some((g) => g.id === id)) {
      s.goals.push({ id, title, turn: s.turn });
      news(s, "Legacy milestone: " + title + ".", "milestone");
    }
  news(
    s,
    "Monthly close: revenue " +
      Math.round(report.revenue).toLocaleString() +
      " dollars; attributable profit " +
      Math.round(report.attributable).toLocaleString() +
      " dollars.",
    "results",
  );
  if (!integrity(s))
    throw Error(
      "Accounting reconciliation failed. Stop and export a diagnostic save.",
    );
  return report;
}
