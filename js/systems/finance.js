import {
  cash,
  post,
  balance,
  income,
  taxableProfit,
} from "../core/accounting.js";
import {
  debt,
  valuation,
  covenants,
  annualRate,
  rating,
} from "../core/selectors.js";
import { uid, clamp } from "../core/random.js";
import { news } from "../core/state.js";
export function borrow(s, { amount, kind = "term", fixed = false }) {
  if (
    !Number.isFinite(amount) ||
    amount < 50000 ||
    amount > 50000000 ||
    !["term", "revolver"].includes(kind)
  )
    throw Error("Facility must be $50K–$50M with a valid loan type.");
  const limit = Math.max(250000, Math.max(0, valuation(s)) * 0.65);
  if (debt(s) + amount > limit || rating(s) === "D" || covenants(s).breached)
    throw Error(
      "Underwriting declined: leverage, coverage, or liquidity is outside bank policy.",
    );
  let cfo = s.executives.find((e) => e.role === "CFO"),
    spread = 0.025 + (850 - s.credit) / 10000 - (cfo?.competence || 0) / 20000,
    fee = amount * 0.01;
  let l = {
    id: uid(s),
    kind,
    original: amount,
    balance: amount,
    fixed,
    spread,
    rate: s.macro.rate + spread,
    remaining: kind === "term" ? 60 : 12,
    breached: false,
  };
  s.loans.push(l);
  post(s.parent, s.turn, "Bank facility drawdown", {
    cash: amount - fee,
    fees: fee,
    debt: -amount,
  });
  news(
    s,
    (kind === "term"
      ? "Five-year term loan"
      : "Twelve-month revolving facility") +
      " funded. 1% origination fee; " +
      (fixed ? "fixed" : "floating") +
      " interest.",
    "capital",
  );
}
export function repay(s, id, amount) {
  let l = s.loans.find((l) => l.id === Number(id));
  if (!l) throw Error("Facility not found");
  let n = amount === undefined ? l.balance : Math.min(l.balance, amount);
  if (!Number.isFinite(n) || n <= 0 || cash(s.parent) < n)
    throw Error("Insufficient treasury to make this repayment.");
  post(s.parent, s.turn, "Principal repayment", { debt: n, cash: -n });
  l.balance -= n;
  s.loans = s.loans.filter((l) =>
    l.kind === "revolver" ? l.remaining > 0 : l.balance > 0.01,
  );
  news(
    s,
    "Bank principal repaid: " + Math.round(n).toLocaleString() + " dollars.",
    "capital",
  );
}
export function distribute(s, amount) {
  if (!Number.isFinite(amount) || amount <= 0)
    throw Error("Enter a positive dividend.");
  const earned = Math.max(
    0,
    income(s.parent) - balance(s.parent, "distributions"),
  );
  if (
    covenants(s).breached ||
    amount > cash(s.parent) * 0.25 ||
    amount > earned
  )
    throw Error(
      "Dividends require retained parent profits, covenant compliance, and a maximum payout of 25% of treasury.",
    );
  let tax = amount * 0.2;
  post(s.parent, s.turn, "Founder dividend", {
    distributions: amount,
    cash: -amount,
  });
  post(s.personal, s.turn, "Holding company dividend, 20% withholding", {
    cash: amount - tax,
    tax,
    dividendIncome: -amount,
  });
  s.stats.personalTax += tax;
  s.taxPaid += tax;
  news(
    s,
    "Founder dividend paid from realized parent profits. 20% tax withheld.",
  );
}
export function founderCapital(s, amount) {
  if (!Number.isFinite(amount) || amount < 1000 || amount > cash(s.personal))
    throw Error(
      "Founder equity contribution must be at least $1K and within personal cash.",
    );
  post(s.personal, s.turn, "Founder capital contribution", {
    investments: amount,
    cash: -amount,
  });
  post(s.parent, s.turn, "Founder equity injection", {
    cash: amount,
    capital: -amount,
  });
  news(
    s,
    "Founder transferred personal capital into the holding company as equity.",
    "capital",
  );
}
export function serviceDebt(s) {
  let interest = 0,
    principal = 0;
  for (let l of s.loans) {
    const payment = (l.balance * annualRate(s, l)) / 12;
    interest += payment;
    post(s.parent, s.turn, "Monthly bank interest", {
      interest: payment,
      cash: -payment,
    });
    l.remaining = Math.max(0, l.remaining - 1);
    let p =
      l.kind === "term"
        ? l.remaining === 0
          ? l.balance
          : Math.min(l.balance, l.original / 60)
        : l.remaining <= 0
          ? l.balance
          : 0;
    if (p) {
      post(s.parent, s.turn, "Scheduled principal payment", {
        debt: p,
        cash: -p,
      });
      l.balance -= p;
      principal += p;
    }
    if (l.kind === "revolver" && l.remaining <= 0)
      news(
        s,
        "Revolving facility matured. Full principal settled; treasury may need recapitalization.",
        "alert",
      );
  }
  s.loans = s.loans.filter((l) =>
    l.kind === "revolver" ? l.remaining > 0 : l.balance > 0.01,
  );
  let c = covenants(s);
  for (let l of s.loans) {
    if (c.breached && !l.breached)
      news(
        s,
        "Bank covenant breached: new draws suspended and floating spreads rise 250bps.",
        "alert",
      );
    l.breached = c.breached;
  }
  s.credit = clamp(
    s.credit + (cash(s.parent) < 0 ? -28 : c.breached ? -12 : 2),
    300,
    850,
  );
  return { interest, principal };
}

export function redraw(s, id, amount) {
  let l = s.loans.find((l) => l.id === Number(id));
  if (
    !l ||
    l.kind !== "revolver" ||
    l.remaining <= 0 ||
    l.breached ||
    covenants(s).breached
  )
    throw Error("Revolver is unavailable or in covenant breach.");
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > l.original - l.balance
  )
    throw Error("Draw exceeds the undrawn facility limit.");
  if (debt(s) + amount > Math.max(250000, valuation(s) * 0.65))
    throw Error("Redraw would breach the leverage limit.");
  l.balance += amount;
  post(s.parent, s.turn, "Revolver redraw", { cash: amount, debt: -amount });
  news(
    s,
    "Drew additional capital from the existing revolving facility.",
    "capital",
  );
}

/** Internal dividends are exempt; external gains and costs are taxed at the parent. */
export function settleParentTax(s) {
  const profit = taxableProfit(s.parent, s.period.parentBalances || {}, true);
  const offset = Math.min(Math.max(0, profit), s.parentTaxLoss);
  s.parentTaxLoss =
    Math.max(0, s.parentTaxLoss - Math.max(0, profit)) + Math.max(0, -profit);
  const tax = Math.max(0, profit - offset) * 0.24;
  if (tax)
    post(s.parent, s.turn, "Holding company income tax accrual", {
      tax,
      taxPayable: -tax,
    });
  const due =
    s.turn % 3 === 0 ? Math.max(0, -balance(s.parent, "taxPayable")) : 0;
  if (due) {
    post(s.parent, s.turn, "Holding company quarterly tax settlement", {
      taxPayable: due,
      cash: -due,
    });
    s.taxPaid += due;
  }
  return due;
}
