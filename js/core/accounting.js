/** Signed trial balance: debit balances positive, credit balances negative. */
export const ACCOUNTS = {
  cash: ["Cash & bank", "asset"],
  receivables: ["Trade receivables", "asset"],
  inventory: ["Inventory", "asset"],
  ppe: ["Property, plant & equipment", "asset"],
  cip: ["Construction in progress", "asset"],
  accumulatedDepreciation: ["Accumulated depreciation", "contra"],
  investments: ["Investments at cost", "asset"],
  payables: ["Trade payables", "liability"],
  taxPayable: ["Income tax payable", "liability"],
  debt: ["Bank debt", "liability"],
  capital: ["Paid-in capital", "equity"],
  distributions: ["Shareholder distributions", "contraEquity"],
  revenue: ["Operating revenue", "income"],
  dividendIncome: ["Dividend income", "income"],
  investmentIncome: ["Investment gains / losses", "income"],
  cogs: ["Cost of sales", "expense"],
  opex: ["Operating expense", "expense"],
  payroll: ["Executive compensation", "expense"],
  depreciation: ["Depreciation & amortization", "expense"],
  interest: ["Interest expense", "expense"],
  tax: ["Income tax expense", "expense"],
  fees: ["Fees & exceptional charges", "expense"],
};
export function ledger(cash = 0) {
  let l = {
    balances: Object.fromEntries(Object.keys(ACCOUNTS).map((k) => [k, 0])),
    journal: [],
  };
  if (cash) post(l, 0, "Opening shareholder capital", { cash, capital: -cash });
  return l;
}
export function post(l, turn, memo, lines) {
  const entries = Object.entries(lines);
  if (entries.some(([a, n]) => !ACCOUNTS[a] || !Number.isFinite(n)))
    throw Error("Invalid accounting entry");
  let sum = entries.reduce((t, [, n]) => t + n, 0);
  if (Math.abs(sum) > 0.005)
    throw Error("Unbalanced journal: " + memo + " " + sum);
  for (const [a, n] of entries) l.balances[a] += n;
  l.journal.unshift({ turn, memo, lines: { ...lines } });
  if (l.journal.length > 300) l.journal.length = 300;
}
export const balance = (l, a) => l.balances[a] || 0;
export const cash = (l) => balance(l, "cash");
export function income(l) {
  return -Object.entries(l.balances)
    .filter(([a]) => ["income", "expense"].includes(ACCOUNTS[a][1]))
    .reduce((s, [, n]) => s + n, 0);
}
export function sheet(l) {
  let b = l.balances,
    assets =
      b.cash +
      b.receivables +
      b.inventory +
      b.ppe +
      b.cip +
      b.accumulatedDepreciation +
      b.investments,
    liabilities = -(b.payables + b.taxPayable + b.debt),
    equity = -b.capital - b.distributions + income(l);
  return {
    assets,
    liabilities,
    equity,
    cash: b.cash,
    receivables: b.receivables,
    inventory: b.inventory,
    ppe: b.ppe + b.cip + b.accumulatedDepreciation,
    payables: -b.payables,
    taxPayable: -b.taxPayable,
    debt: -b.debt,
    error: assets - liabilities - equity,
  };
}
export function reconcile(l) {
  return Math.abs(Object.values(l.balances).reduce((a, b) => a + b, 0)) < 0.02;
}
/** Period taxable profit from ledger movements, including decisions between closes. */
export function taxableProfit(l, opening = {}, exemptDividends = false) {
  return -Object.entries(l.balances)
    .filter(
      ([a]) =>
        ["income", "expense"].includes(ACCOUNTS[a][1]) &&
        a !== "tax" &&
        !(exemptDividends && a === "dividendIncome"),
    )
    .reduce((sum, [a, n]) => sum + n - (opening[a] || 0), 0);
}
