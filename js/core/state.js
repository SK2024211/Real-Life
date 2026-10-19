import { DIFFICULTIES, SCENARIOS, SECURITIES } from "./catalog.js";
import { ledger } from "./accounting.js";
import { hashSeed } from "./random.js";
export const VERSION = 2;
export function createGame({
  founder = "Alex Morgan",
  group = "Meridian Holdings",
  difficulty = "operator",
  scenario = "balanced",
  seed = "MERIDIAN-2026",
  avatar = "",
  logo = "",
} = {}) {
  const d = DIFFICULTIES[difficulty];
  if (!d || !SCENARIOS[scenario]) throw Error("Invalid starting scenario");
  const macro = SCENARIOS[scenario];
  return {
    version: VERSION,
    founder,
    group,
    difficulty,
    scenario,
    seed,
    avatar,
    logo,
    rng: hashSeed(seed),
    nextId: 1,
    turn: 0,
    parent: ledger(d.capital),
    personal: ledger(d.cash),
    credit: d.credit,
    reputation: 60,
    salary: 8000,
    units: [],
    loans: [],
    executives: [],
    assets: [],
    angels: [],
    wallet: {},
    basis: {},
    cold: false,
    taxPaid: 0,
    macro: {
      priceIndex: 1,
      growth: macro.growth,
      inflation: macro.inflation,
      rate: macro.rate,
      unemployment: 0.045,
      confidence: 1,
      regime:
        scenario === "recession"
          ? "recession"
          : scenario === "boom"
            ? "boom"
            : "expansion",
      regimeAge: 0,
      commodities: { corn: 1, steel: 1, oil: 1, energy: 1 },
      sectors: {
        industry: 1,
        energy: 1,
        property: 1,
        logistics: 1,
        tech: 1,
        science: 1,
      },
      history: [],
    },
    market: SECURITIES.map((m) => ({ ...m, change: 0, history: [m.price] })),
    reports: [],
    history: [d.capital],
    logs: [],
    decisions: [],
    goals: [],
    policies: {
      autoSweep: true,
      insurance: true,
      audit: true,
      dividendPayout: 0,
    },
    last: {
      revenue: 0,
      ebitda: 0,
      profit: 0,
      operatingCash: 0,
      tax: 0,
      interest: 0,
      capex: 0,
      distributions: 0,
    },
    stats: {
      turnsProfitable: 0,
      peakWorth: d.capital + d.cash,
      personalTax: 0,
    },
    revision: 0,
    archivedIncome: {},
    period: {
      balances: {},
      cash: d.capital,
      unitBalances: {},
      parentBalances: {},
    },
    disposedNCI: 0,
    parentTaxLoss: 0,
  };
}
export function news(s, text, type = "corporate") {
  s.logs.unshift({ id: s.nextId++, turn: s.turn, text, type });
  s.logs = s.logs.slice(0, 180);
}
