import { cash, sheet, balance } from "./accounting.js";
import { INDUSTRIES } from "./catalog.js";
export const specOf = (u) => INDUSTRIES.find((i) => i.id === u.industry);
export const ownership = (u) => u.parentShares / u.shares;
export const debt = (s) => s.loans.reduce((a, l) => a + l.balance, 0);
export function unitValue(s, u) {
  const b = sheet(u.ledger),
    spec = specOf(u);
  if (u.status === "closed") return Math.max(0, b.equity);
  let ebitda =
      (u.results.slice(-12).reduce((a, r) => a + r.ebitda, 0) * 12) /
      Math.max(1, u.results.length),
    multiple = spec.sector === "tech" ? 9 : spec.sector === "property" ? 13 : 6;
  let discount = Math.max(0.5, 1 - (s.macro.rate - 0.04) * 6);
  let enterprise =
    u.results.length < 3
      ? b.ppe
      : Math.max(b.ppe * 0.6, ebitda * multiple * discount);
  return Math.max(
    0,
    enterprise + b.cash + b.receivables + b.inventory - b.liabilities,
  );
}
export function valuation(s) {
  return (
    sheet(s.parent).equity +
    s.units.reduce(
      (v, u) => v + unitValue(s, u) * ownership(u) - u.investmentCost,
      0,
    )
  );
}
export const portfolio = (s) =>
  s.market.reduce((v, m) => v + (s.wallet[m.symbol] || 0) * m.price, 0);
export const netWorth = (s) =>
  cash(s.personal) +
  portfolio(s) +
  s.assets.reduce((v, a) => v + a.value, 0) +
  s.angels.reduce((v, a) => v + a.value, 0) +
  valuation(s);
export function groupSheet(s) {
  let p = sheet(s.parent),
    r = { ...p, nci: 0 };
  for (const u of s.units) {
    let b = sheet(u.ledger);
    for (const k of [
      "assets",
      "liabilities",
      "cash",
      "receivables",
      "inventory",
      "ppe",
      "payables",
      "taxPayable",
      "debt",
    ])
      r[k] += b[k] || 0;
    r.assets -= u.investmentCost;
    r.nci += b.equity * (1 - ownership(u));
  }
  r.equity = r.assets - r.liabilities;
  r.attributable = r.equity - r.nci;
  r.error = r.assets - r.liabilities - r.equity;
  return r;
}
export function leverage(s) {
  return debt(s) / Math.max(1, debt(s) + valuation(s));
}
export function rating(s) {
  if (cash(s.parent) < 0) return "D";
  let l = leverage(s);
  if (l <= 0.7 && covenants(s).breached) return "BB";
  return l > 0.85
    ? "CCC"
    : l > 0.7
      ? "B"
      : l > 0.55
        ? "BB"
        : l > 0.4
          ? "BBB"
          : s.credit > 795
            ? "AAA"
            : s.credit > 740
              ? "AA"
              : "A";
}
export function annualRate(s, l) {
  return l.fixed ? l.rate : s.macro.rate + l.spread + (l.breached ? 0.025 : 0);
}
export function covenants(s) {
  let r = s.reports.slice(-3),
    ebitda = (r.reduce((a, b) => a + b.ebitda, 0) * 12) / Math.max(1, r.length),
    interest = s.loans.reduce((a, l) => a + l.balance * annualRate(s, l), 0),
    lev = leverage(s);
  return {
    leverage: lev,
    maxLeverage: 0.65,
    coverage: interest ? Math.max(0, ebitda) / interest : Infinity,
    minCoverage: 1.5,
    breached:
      lev > 0.65 || (interest > 0 && r.length >= 3 && ebitda / interest < 1.5),
  };
}
export function runway(u) {
  let burn =
    -u.results.slice(-3).reduce((a, r) => a + r.operatingCash, 0) /
    Math.max(1, Math.min(3, u.results.length));
  return burn > 1 ? Math.max(0, cash(u.ledger) / burn) : Infinity;
}
export const parentCosts = (s) =>
  s.salary + s.executives.reduce((a, e) => a + e.salary, 0) + 5000;
export const date = (s) =>
  new Date(2026, s.turn, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
export function integrity(s) {
  return [s.parent, s.personal, ...s.units.map((u) => u.ledger)].every(
    (l) =>
      Math.abs(Object.values(l.balances).reduce((a, b) => a + b, 0)) < 0.03,
  );
}

export function operatingBalances(s) {
  let out = { ...(s.archivedIncome || {}) };
  for (const l of [s.parent, ...s.units.map((u) => u.ledger)])
    for (const [a, n] of Object.entries(l.balances)) {
      if (
        [
          "revenue",
          "dividendIncome",
          "investmentIncome",
          "cogs",
          "opex",
          "payroll",
          "depreciation",
          "interest",
          "tax",
          "fees",
        ].includes(a)
      ) {
        if (l === s.parent && a === "dividendIncome") continue;
        out[a] = (out[a] || 0) + n;
      }
    }
  return out;
}
