import { INDUSTRIES } from "../core/catalog.js";
import {
  ledger,
  post,
  cash,
  sheet,
  balance,
  income,
  ACCOUNTS,
  taxableProfit,
} from "../core/accounting.js";
import { random, normal, clamp, uid } from "../core/random.js";
import { specOf, ownership, unitValue } from "../core/selectors.js";
import { news } from "../core/state.js";
export function createUnit(s, type, name, acquire = false) {
  const spec = INDUSTRIES.find((i) => i.id === type);
  if (s.units.length >= 50)
    throw Error("This simulation supports up to 50 operating companies.");
  if (!spec) throw Error("Unknown industry");
  const cost = spec.cost * (acquire ? 1.2 : 1);
  if (cash(s.parent) < cost)
    throw Error("The parent treasury cannot fund this investment.");
  const id = uid(s);
  post(s.parent, s.turn, "Equity investment: " + name, {
    investments: cost,
    cash: -cost,
  });
  let l = ledger();
  post(l, s.turn, "Subsidiary capitalization", {
    cash: cost * 0.25,
    [acquire ? "ppe" : "cip"]: cost * 0.7,
    inventory: cost * 0.05,
    capital: -cost,
  });
  let u = {
    id,
    name: name.trim().slice(0, 70) || spec.name,
    industry: type,
    level: 1,
    status: acquire ? "operating" : "construction",
    buildRemaining: acquire ? 0 : spec.build,
    buildTotal: spec.build,
    ledger: l,
    investmentCost: cost,
    shares: 1000000,
    parentShares: 1000000,
    public: false,
    round: 0,
    policy: {
      utilization: 0.8,
      price: 1,
      marketing: 1,
      maintenance: 1,
      wage: 1,
      research: 1,
      autonomy: true,
    },
    condition: 100,
    morale: 78,
    compliance: 92,
    quality: 65,
    customers: spec.churn
      ? acquire
        ? spec.capacity * 0.5
        : spec.capacity * 0.12
      : 0,
    occupancy: acquire ? 0.78 : 0.45,
    research: 0,
    results: [],
    lossCarry: 0,
    distress: 0,
    expansion: null,
  };
  s.units.push(u);
  news(
    s,
    (acquire ? "Acquired " : "Began construction of ") +
      u.name +
      ". " +
      Math.round(cost * 0.25).toLocaleString() +
      " dollars reserved inside the subsidiary for working capital.",
  );
  return u;
}
export function expandUnit(s, id) {
  let u = findUnit(s, id),
    spec = specOf(u),
    cost = spec.cost * 0.65;
  if (u.expansion || u.status !== "operating")
    throw Error("Expansion requires an operating unit with no active project.");
  if (cash(s.parent) < cost)
    throw Error("Insufficient parent treasury for the expansion.");
  post(s.parent, s.turn, "Expansion equity: " + u.name, {
    investments: cost,
    cash: -cost,
  });
  post(u.ledger, s.turn, "Expansion funding", {
    cash: cost * 0.2,
    cip: cost * 0.8,
    capital: -cost,
  });
  u.investmentCost += cost;
  u.expansion = {
    remaining: Math.max(2, Math.ceil(spec.build * 0.6)),
    total: Math.max(2, Math.ceil(spec.build * 0.6)),
    cost: cost * 0.8,
  };
  news(
    s,
    u.name +
      " expansion funded. Current operations continue during construction.",
  );
}
export function findUnit(s, id) {
  let u = s.units.find((u) => u.id === Number(id));
  if (!u) throw Error("Business not found.");
  return u;
}
export function injectCapital(s, id, amount) {
  let u = findUnit(s, id);
  if (!Number.isFinite(amount) || amount < 1000 || cash(s.parent) < amount)
    throw Error("Enter an affordable capital injection of at least $1,000.");
  let value = Math.max(1, unitValue(s, u)),
    newShares = (u.shares * amount) / value;
  post(s.parent, s.turn, "Rescue capital: " + u.name, {
    investments: amount,
    cash: -amount,
  });
  post(u.ledger, s.turn, "New parent equity", {
    cash: amount,
    capital: -amount,
  });
  u.parentShares += newShares;
  u.shares += newShares;
  u.investmentCost += amount;
  u.distress = 0;
  news(s, "Parent invested additional capital in " + u.name + ".");
}
export function remediate(s, id) {
  let u = findUnit(s, id),
    cost = 18000 * u.level;
  if (cash(u.ledger) < cost)
    throw Error(
      "Subsidiary needs " +
        cost.toLocaleString() +
        " dollars cash. Inject capital first.",
    );
  post(u.ledger, s.turn, "Compliance remediation", { opex: cost, cash: -cost });
  u.compliance = 100;
  news(s, u.name + " completed compliance remediation.");
}
export function setPolicy(s, id, policy) {
  let u = findUnit(s, id);
  const limits = {
    price: [0.6, 1.6],
    utilization: [0.3, 1],
    marketing: [0.2, 3],
    maintenance: [0.3, 2],
    wage: [0.7, 1.5],
    research: [0.3, 3],
  };
  for (const [k, v] of Object.entries(policy)) {
    if (k === "autonomy") {
      u.policy.autonomy = Boolean(v);
      continue;
    }
    if (
      !limits[k] ||
      !Number.isFinite(v) ||
      v < limits[k][0] ||
      v > limits[k][1]
    )
      throw Error("Invalid operating policy");
    u.policy[k] = v;
  }
}
export function equityRound(s, id, ipo = false) {
  let u = findUnit(s, id),
    spec = specOf(u);
  if (u.status !== "operating")
    throw Error("Operations must be open before a financing round.");
  if (
    ipo &&
    (u.public ||
      u.results.length < 12 ||
      u.results.slice(-3).some((r) => r.ebitda <= 0) ||
      unitValue(s, u) < 1000000)
  )
    throw Error(
      "IPO eligibility: 12 operating months, 3 profitable EBITDA months, and $1M valuation.",
    );
  if (!ipo && !u.public && !["tech", "science"].includes(spec.sector))
    throw Error("Private VC rounds target technology and biotech businesses.");
  if (u.round >= 5 && !u.public)
    throw Error(
      "Private funding exhausted. Pursue an IPO or internal funding.",
    );
  if (ownership(u) / 1.25 < 0.25)
    throw Error("Round would reduce the parent below its 25% minimum stake.");
  let value = Math.max(spec.cost * 0.5, unitValue(s, u)),
    raise = value * 0.25,
    fee = raise * (ipo ? 0.055 : 0.025);
  u.shares *= 1.25;
  u.round++;
  u.public ||= ipo;
  post(u.ledger, s.turn, ipo ? "IPO proceeds" : "Primary equity issuance", {
    cash: raise - fee,
    fees: fee,
    capital: -raise,
  });
  news(
    s,
    u.name +
      " raised " +
      Math.round(raise).toLocaleString() +
      " dollars " +
      (ipo ? "in an IPO" : "of new equity") +
      ". Proceeds stay in its operating bank; parent owns " +
      (ownership(u) * 100).toFixed(1) +
      "%.",
    "capital",
  );
}
export function sellUnit(s, id) {
  let u = findUnit(s, id);
  const price = unitValue(s, u) * ownership(u) * 0.88;
  if (price <= 0) throw Error("No buyer will assume this distressed equity.");
  post(s.parent, s.turn, "Dispose subsidiary: " + u.name, {
    cash: price,
    investments: -u.investmentCost,
    investmentIncome: u.investmentCost - price,
  });
  for (const [a, n] of Object.entries(u.ledger.balances))
    if (["income", "expense"].includes(ACCOUNTS[a][1]))
      s.archivedIncome[a] = (s.archivedIncome[a] || 0) + n;
  let base = s.period.unitBalances?.[u.id] || {},
    baseIncome = -Object.entries(base)
      .filter(([a]) => ["income", "expense"].includes(ACCOUNTS[a][1]))
      .reduce((v, [, n]) => v + n, 0);
  s.disposedNCI += (income(u.ledger) - baseIncome) * (1 - ownership(u));
  s.archivedIncome.investmentIncome =
    (s.archivedIncome.investmentIncome || 0) +
    sheet(u.ledger).equity * ownership(u) -
    u.investmentCost;
  s.units = s.units.filter((x) => x.id !== u.id);
  s.executives = s.executives.filter((e) => e.unitId !== u.id);
  news(
    s,
    u.name + " divested at a 12% private market liquidity discount.",
    "capital",
  );
}
export function operateUnit(s, u) {
  let spec = specOf(u),
    l = u.ledger,
    opening = cash(l),
    openingIncome = income(l),
    r = {
      turn: s.turn,
      revenue: 0,
      cogs: 0,
      opex: 0,
      ebitda: 0,
      depreciation: 0,
      interest: 0,
      tax: 0,
      profit: 0,
      operatingCash: 0,
      volume: 0,
      occupancy: u.occupancy,
      customers: u.customers,
      dividend: 0,
      capex: 0,
      synergy: 0,
    };
  if (u.status === "closed") {
    u.results.push(r);
    u.results = u.results.slice(-120);
    return r;
  }
  if (u.expansion && --u.expansion.remaining <= 0) {
    post(l, s.turn, "Commission completed expansion", {
      ppe: u.expansion.cost,
      cip: -u.expansion.cost,
    });
    u.level++;
    u.expansion = null;
    news(s, u.name + " expansion complete. Capacity increased.");
  }
  if (u.status === "construction") {
    let burn = spec.fixed * 0.12;
    post(l, s.turn, "Pre-opening engineering and payroll", {
      opex: burn,
      cash: -burn,
    });
    r.opex = burn;
    r.ebitda = -burn;
    r.profit = -burn;
    r.operatingCash = -burn;
    u.lossCarry += burn;
    u.buildRemaining--;
    if (u.buildRemaining <= 0) {
      u.status = "operating";
      let commissioned = balance(l, "cip");
      if (commissioned)
        post(l, s.turn, "Commission completed facility", {
          ppe: commissioned,
          cip: -commissioned,
        });
      news(s, u.name + " completed construction. Trading begins next month.");
    }
    u.results.push(r);
    return r;
  }
  let p = u.policy,
    md = s.executives.find((e) => e.unitId === u.id && e.role === "MD"),
    cfo = s.executives.find((e) => e.role === "CFO"),
    coo = s.executives.find((e) => e.role === "COO"),
    cmo = s.executives.find((e) => e.role === "CMO");
  if (md && p.autonomy && md.competence >= 80) {
    if (u.compliance < 65 && cash(l) > 25000 * u.level) {
      post(l, s.turn, "MD-led regulatory remediation", {
        opex: 12000 * u.level,
        cash: -12000 * u.level,
      });
      u.compliance = 88;
      r.opex += 12000 * u.level;
      news(
        s,
        md.name + " resolved a regulatory exception at " + u.name + ".",
        "people",
      );
    }
    p.utilization = clamp(
      p.utilization + (u.results.at(-1)?.profit > 0 ? 0.01 : -0.01),
      0.55,
      0.95,
    );
  }
  u.condition = clamp(
    u.condition - 1.5 * p.utilization + p.maintenance * 1.3,
    25,
    100,
  );
  u.morale = clamp(
    u.morale + (p.wage - 1) * 7 + (md ? md.competence / 100 : 0) - 0.4,
    15,
    100,
  );
  u.compliance = clamp(
    u.compliance -
      1.4 +
      (s.policies.audit ? 1 : 0) +
      (md?.competence || 0) / 220,
    0,
    100,
  );
  u.quality = clamp(
    u.quality + (p.research - 1) * 0.55 + (md?.competence || 0) / 400 - 0.1,
    25,
    100,
  );
  const inflation = s.macro.priceIndex,
    capacity = spec.capacity * u.level;
  const quality = 0.7 + u.quality / 220,
    morale = 0.7 + u.morale / 300,
    market = s.macro.sectors[spec.sector] * s.macro.confidence,
    demand = clamp(
      market * Math.pow(p.price, -spec.elasticity) * quality,
      0.15,
      1.3,
    );
  let volume = 0;
  if (spec.churn) {
    let churn = clamp(
        spec.churn * (1 + (p.price - 1) * 2) * (1.5 - u.quality / 100),
        0.004,
        0.2,
      ),
      marketing = spec.fixed * 0.2 * p.marketing * (cmo ? 1.1 : 1);
    u.customers = Math.min(
      capacity,
      u.customers * (1 - churn) +
        (marketing * Math.max(0.4, demand)) / (spec.cac * (1 + s.macro.rate)),
    );
    volume = u.customers * Math.min(1, u.condition / 95);
    r.churn = churn;
    r.cac = spec.cac;
    r.arr = volume * spec.price * p.price * 12;
  } else if (spec.sector === "property") {
    let target = clamp(
      0.82 * demand - 0.4 * Math.max(0, s.macro.rate - 0.04),
      0.25,
      0.98,
    );
    u.occupancy += (target - u.occupancy) * 0.14;
    volume = capacity * u.occupancy;
  } else {
    let season =
      spec.id === "solar"
        ? 0.76 + 0.24 * Math.sin((((s.turn % 12) - 2) * Math.PI) / 6)
        : 1;
    volume =
      Math.min(
        ((capacity * p.utilization * u.condition) / 100) * morale,
        capacity * 0.86 * demand,
      ) * season;
  }
  if (spec.sector === "science") {
    u.research = clamp(
      u.research + p.research * (0.6 + random(s) * 0.6),
      0,
      100,
    );
    volume *= 0.25 + u.research / 100;
    if (u.research >= 50 && !u.milestone) {
      u.milestone = true;
      u.quality += 10;
      news(
        s,
        u.name +
          " reached its clinical research milestone; contract demand can scale.",
        "operations",
      );
    }
  }
  const integrated = s.units.some(
    (v) =>
      v.id !== u.id &&
      v.status === "operating" &&
      ((v.industry === "steel" &&
        ["commercial", "residential", "warehouse"].includes(u.industry)) ||
        (v.industry === "solar" &&
          ["biofuel", "steel", "saas"].includes(u.industry)) ||
        (v.industry === "warehouse" && u.industry === "ecommerce")),
  );
  let input = spec.commodity ? s.macro.commodities[spec.commodity] : 1,
    variable =
      spec.variable *
      inflation *
      (0.55 + 0.45 * input) *
      (integrated ? 0.94 : 1) *
      (coo ? 1 - (coo.competence - 50) / 1000 : 1) *
      (s.procurementUntil >= s.turn ? 0.97 : 1);
  r.volume = volume;
  r.revenue =
    volume *
    spec.price *
    p.price *
    inflation *
    (spec.id === "solar"
      ? s.macro.commodities.energy
      : spec.id === "biofuel"
        ? 0.75 + 0.25 * s.macro.commodities.oil
        : 1);
  r.cogs = volume * variable;
  r.synergy = integrated ? volume * variable * 0.06 : 0;
  // Collections and supplier settlements use actual prior-period balances.
  let collections =
      Math.max(0, balance(l, "receivables")) * clamp(1 / spec.dso, 0.25, 1),
    payments = Math.max(0, -balance(l, "payables")) * 0.8;
  if (collections)
    post(l, s.turn, "Customer collections", {
      cash: collections,
      receivables: -collections,
    });
  if (payments)
    post(l, s.turn, "Settle supplier invoices", {
      payables: payments,
      cash: -payments,
    });
  if (r.revenue)
    post(l, s.turn, "Monthly sales on credit", {
      receivables: r.revenue,
      revenue: -r.revenue,
    });
  let purchase = Math.max(0, r.cogs * 1.3 - balance(l, "inventory"));
  if (purchase)
    post(l, s.turn, "Purchase operating inputs on account", {
      inventory: purchase,
      payables: -purchase,
    });
  if (r.cogs)
    post(l, s.turn, "Inputs consumed in production", {
      cogs: r.cogs,
      inventory: -r.cogs,
    });
  let fixed =
    spec.fixed *
    u.level *
    inflation *
    (0.65 + 0.35 * p.wage) *
    (1 +
      (p.maintenance - 1) * 0.17 +
      (p.marketing - 1) * 0.2 +
      (p.research - 1) * 0.16);
  if (s.policies.insurance) fixed += spec.cost * u.level * 0.00065;
  r.opex += fixed;
  post(l, s.turn, "Payroll, premises, maintenance and product costs", {
    opex: fixed,
    cash: -fixed,
  });
  if (u.compliance < 55) {
    let fine = spec.cost * 0.012;
    post(l, s.turn, "Regulatory fine", { fees: fine, cash: -fine });
    r.opex += fine;
    news(
      s,
      u.name + " fined for noncompliance. Remedy before further enforcement.",
      "alert",
    );
  }
  let incidentChance =
    0.012 + (100 - u.condition) * 0.0006 + (u.morale < 40 ? 0.08 : 0);
  if (random(s) < incidentChance) {
    let gross = spec.cost * (0.01 + random(s) * 0.025),
      loss = gross * (s.policies.insurance ? 0.2 : 1);
    post(l, s.turn, "Equipment or labor disruption, net of insurance", {
      fees: loss,
      cash: -loss,
    });
    r.opex += loss;
    news(
      s,
      u.name +
        " suffered an operating disruption. Net cash loss " +
        Math.round(loss).toLocaleString() +
        " dollars.",
      "alert",
    );
  }
  r.ebitda = r.revenue - r.cogs - r.opex;
  r.depreciation = Math.min(
    Math.max(0, balance(l, "ppe") + balance(l, "accumulatedDepreciation")),
    balance(l, "ppe") / spec.life,
  );
  if (r.depreciation)
    post(l, s.turn, "Monthly depreciation", {
      depreciation: r.depreciation,
      accumulatedDepreciation: -r.depreciation,
    });
  let pretax = taxableProfit(l, s.period.unitBalances?.[u.id] || {}),
    offset = Math.min(Math.max(0, pretax), u.lossCarry);
  u.lossCarry =
    Math.max(0, u.lossCarry - Math.max(0, pretax)) + Math.max(0, -pretax);
  r.tax = Math.max(0, pretax - offset) * 0.24;
  if (r.tax)
    post(l, s.turn, "Accrue corporate income tax", {
      tax: r.tax,
      taxPayable: -r.tax,
    });
  if (s.turn % 3 === 0) {
    let due = Math.max(0, -balance(l, "taxPayable"));
    if (due) {
      post(l, s.turn, "Quarterly corporate tax payment", {
        taxPayable: due,
        cash: -due,
      });
      s.taxPaid += due;
    }
  }
  r.profit = income(l) - openingIncome;
  r.operatingCash = cash(l) - opening;
  r.occupancy = u.occupancy;
  r.customers = u.customers;
  const available = Math.max(0, income(l) - balance(l, "distributions")),
    reserve = spec.fixed * u.level * 3 + r.cogs * 0.4;
  if (s.policies.autoSweep && cash(l) > reserve && available > 0) {
    let payout = Math.min(cash(l) - reserve, available);
    post(l, s.turn, "Distribution to all shareholders", {
      distributions: payout,
      cash: -payout,
    });
    let parentShare = payout * ownership(u);
    post(s.parent, s.turn, "Dividend received: " + u.name, {
      cash: parentShare,
      dividendIncome: -parentShare,
    });
    r.dividend = parentShare;
  }
  u.distress = cash(l) < 0 ? u.distress + 1 : 0;
  if (u.distress)
    news(
      s,
      u.name +
        " has an operating cash deficit. Parent recapitalization or divestment required.",
      "alert",
    );
  if (u.distress >= 6) {
    u.status = "closed";
    news(
      s,
      u.name +
        " entered administration after six months of unfunded cash deficits.",
      "alert",
    );
  }
  u.results.push(r);
  u.results = u.results.slice(-120);
  return r;
}
