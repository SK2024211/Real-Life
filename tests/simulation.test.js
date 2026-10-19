import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../js/core/state.js";
import {
  ledger,
  post,
  sheet,
  cash,
  balance,
  reconcile,
  income,
} from "../js/core/accounting.js";
import { advanceMonth } from "../js/core/engine.js";
import {
  createUnit,
  expandUnit,
  equityRound,
  injectCapital,
  sellUnit,
  setPolicy,
  operateUnit,
} from "../js/systems/businesses.js";
import {
  borrow,
  repay,
  redraw,
  distribute,
  founderCapital,
} from "../js/systems/finance.js";
import {
  hire,
  dismiss,
  bonus,
  resolveDecision,
} from "../js/systems/governance.js";
import {
  trade,
  buyAsset,
  sellAsset,
  angelInvest,
  coldStorage,
} from "../js/systems/personal.js";
import { INDUSTRIES } from "../js/core/catalog.js";
import {
  integrity,
  ownership,
  unitValue,
  valuation,
  groupSheet,
  annualRate,
  covenants,
} from "../js/core/selectors.js";
import {
  decode,
  validateSave,
  migrateV1,
  persist,
} from "../js/core/storage.js";
const close = (a, b, tol = 0.02) =>
  assert.ok(Math.abs(a - b) < tol, `${a} should equal ${b}`);
const world = () => createGame({ difficulty: "heir", seed: "ACCOUNTING-2026" });
const step = (s, n = 1) => {
  for (let i = 0; i < n; i++) advanceMonth(s);
};
test("journal rejects unbalanced entries without changing any balances", () => {
  let l = ledger(1000),
    old = structuredClone(l);
  assert.throws(
    () => post(l, 1, "Bad", { cash: 100, capital: -90 }),
    /Unbalanced/,
  );
  assert.deepEqual(l, old);
  post(l, 1, "Buy asset", { cash: -400, ppe: 400 });
  assert.ok(reconcile(l));
  close(sheet(l).assets, sheet(l).equity);
});
test("new construction conserves group capital and keeps personal cash separate", () => {
  let s = world(),
    before = groupSheet(s).equity,
    personal = cash(s.personal);
  let u = createUnit(s, "steel", "Steel One");
  close(cash(u.ledger), 1800000 * 0.25);
  close(balance(u.ledger, "cip"), 1800000 * 0.7);
  close(groupSheet(s).equity, before);
  close(cash(s.personal), personal);
  assert.ok(integrity(s));
});
test("construction has real burn, no sales, and no premature depreciation", () => {
  let s = world(),
    u = createUnit(s, "saas", "New SaaS");
  step(s, 2);
  assert.equal(u.status, "construction");
  close(balance(u.ledger, "depreciation"), 0);
  assert.equal(u.results.at(-1).revenue, 0);
  assert.ok(u.lossCarry > 0);
  step(s);
  assert.equal(u.status, "operating");
  close(balance(u.ledger, "cip"), 0);
  assert.ok(balance(u.ledger, "ppe") > 0);
  step(s);
  assert.ok(u.results.at(-1).revenue > 0);
  assert.ok(balance(u.ledger, "depreciation") > 0);
});
test("customer sales initially create receivables rather than spendable bank cash", () => {
  let s = world(),
    u = createUnit(s, "saas", "Acquired SaaS", true),
    start = cash(u.ledger);
  s.policies.autoSweep = false;
  step(s);
  assert.ok(balance(u.ledger, "receivables") > 0);
  assert.ok(cash(u.ledger) < start);
  step(s);
  assert.ok(-balance(u.ledger, "payables") > 0);
  assert.ok(u.results.at(-1).operatingCash > u.results[0].operatingCash);
  assert.ok(integrity(s));
});
test("equity rounds dilute all owners and fund the subsidiary, not the parent", () => {
  let s = world(),
    u = createUnit(s, "saas", "Capital SaaS", true),
    parent = cash(s.parent),
    unitCash = cash(u.ledger);
  equityRound(s, u.id);
  close(ownership(u), 0.8);
  close(cash(s.parent), parent);
  assert.ok(cash(u.ledger) > unitCash);
  assert.ok(groupSheet(s).nci > 0);
  assert.ok(integrity(s));
});
test("IPO requires operating history and becomes available to a profitable mature unit", () => {
  let s = world(),
    u = createUnit(s, "saas", "Public SaaS", true);
  assert.throws(() => equityRound(s, u.id, true), /IPO eligibility/);
  step(s, 12);
  assert.ok(u.results.slice(-3).every((r) => r.ebitda > 0));
  assert.ok(unitValue(s, u) > 1e6);
  equityRound(s, u.id, true);
  assert.equal(u.public, true);
  assert.equal(u.round, 1);
  validateSave(s);
});
test("expansions retain current output and commission capacity only on completion", () => {
  let s = world(),
    u = createUnit(s, "steel", "Steel", true);
  expandUnit(s, u.id);
  assert.equal(u.level, 1);
  assert.ok(balance(u.ledger, "cip") > 0);
  step(s, u.expansion.remaining - 1);
  assert.equal(u.level, 1);
  assert.ok(u.results.at(-1).revenue > 0);
  step(s);
  assert.equal(u.level, 2);
  assert.equal(u.expansion, null);
  close(balance(u.ledger, "cip"), 0);
});
test("primary rescue capital is balanced and can increase the parent ownership stake", () => {
  let s = world(),
    u = createUnit(s, "saas", "Rescue", true);
  equityRound(s, u.id);
  let own = ownership(u),
    before = cash(s.parent);
  injectCapital(s, u.id, 100000);
  assert.ok(ownership(u) > own);
  close(cash(s.parent), before - 100000);
  assert.ok(integrity(s));
});
test("term principal amortizes independently of profit and matches the liability account", () => {
  let s = world();
  borrow(s, { amount: 600000, kind: "term", fixed: true });
  close(cash(s.parent), 50000000 + 594000);
  step(s);
  close(s.loans[0].balance, 590000);
  close(-balance(s.parent, "debt"), 590000);
  assert.equal(s.loans[0].remaining, 59);
  assert.ok(s.last.interest > 0);
  assert.ok(integrity(s));
});
test("revolver can be repaid and redrawn but never above its committed limit", () => {
  let s = world();
  borrow(s, { amount: 300000, kind: "revolver" });
  let id = s.loans[0].id;
  repay(s, id, 100000);
  assert.equal(s.loans.length, 1);
  redraw(s, id, 50000);
  close(s.loans[0].balance, 250000);
  assert.throws(() => redraw(s, id, 60000), /undrawn/);
  repay(s, id);
  assert.equal(s.loans[0].balance, 0);
  redraw(s, id, 300000);
  step(s, 12);
  assert.equal(s.loans.length, 0);
  close(balance(s.parent, "debt"), 0);
});
test("fixed rates remain locked while floating loans reprice with central bank changes", () => {
  let s = world();
  borrow(s, { amount: 100000, kind: "term", fixed: true });
  borrow(s, { amount: 100000, kind: "term", fixed: false });
  let [a, b] = s.loans,
    oldA = annualRate(s, a),
    oldB = annualRate(s, b);
  s.macro.rate += 0.02;
  close(annualRate(s, a), oldA);
  close(annualRate(s, b), oldB + 0.02);
});
test("CFO competence reduces borrowing spreads", () => {
  let a = world(),
    b = world();
  hire(b, 2, "CFO");
  borrow(a, { amount: 100000 });
  borrow(b, { amount: 100000 });
  assert.ok(b.loans[0].spread < a.loans[0].spread);
});
test("dividends cannot launder seed capital into personal funds", () => {
  let s = world();
  assert.throws(() => distribute(s, 10000), /retained/);
  createUnit(s, "steel", "Dividend Steel", true);
  step(s, 12);
  assert.ok(income(s.parent) > 10000);
  let before = cash(s.personal),
    corp = cash(s.parent);
  distribute(s, 10000);
  close(cash(s.personal), before + 8000);
  close(cash(s.parent), corp - 10000);
  assert.ok(integrity(s));
});
test("founder equity transfer preserves combined book wealth and keeps transfers explicit", () => {
  let s = world(),
    p = cash(s.personal),
    c = cash(s.parent);
  founderCapital(s, 100000);
  close(cash(s.personal), p - 100000);
  close(cash(s.parent), c + 100000);
  assert.ok(integrity(s));
});
test("personal trading fees and gain taxes reconcile without touching corporate cash", () => {
  let s = world(),
    corp = cash(s.parent),
    personal = cash(s.personal);
  trade(s, "SPX", 10000);
  let q = s.wallet.SPX;
  close(s.basis.SPX, 9985);
  s.market[0].price *= 2;
  trade(s, "SPX", q * s.market[0].price, true);
  close(s.wallet.SPX, 0);
  close(s.basis.SPX, 0);
  assert.ok(cash(s.personal) > personal);
  assert.ok(s.stats.personalTax > 0);
  close(cash(s.parent), corp);
  assert.ok(integrity(s));
});
test("personal asset upkeep and disposal are funded from the founder account", () => {
  let s = world(),
    corp = cash(s.parent);
  s.salary = 0;
  buyAsset(s, 0);
  let personal = cash(s.personal);
  step(s);
  assert.ok(cash(s.personal) < personal);
  assert.ok(s.assets[0].value < 180000);
  sellAsset(s, s.assets[0].id);
  assert.equal(s.assets.length, 0);
  assert.ok(integrity(s));
});
test("executive dismissal preserves other executives and charges contractual severance", () => {
  let s = world();
  hire(s, 0, "COO");
  hire(s, 1, "CEO");
  let id = s.executives[0].id,
    start = cash(s.parent),
    salary = s.executives[0].salary;
  dismiss(s, id);
  assert.equal(s.executives.length, 1);
  assert.equal(s.executives[0].candidate, 1);
  close(cash(s.parent), start - salary * 2);
});
test("a funded competent MD autonomously remediates compliance", () => {
  let s = world(),
    u = createUnit(s, "steel", "Managed Steel", true);
  hire(s, 0, "MD", u.id);
  u.compliance = 50;
  step(s);
  assert.ok(u.compliance > 80);
  assert.ok(s.logs.some((l) => l.text.includes("resolved a regulatory")));
});
test("board decisions charge treasury once and implement their selected policy", () => {
  let s = world();
  step(s, 6);
  let d = s.decisions.find((d) => !d.resolved),
    c = cash(s.parent);
  assert.ok(d);
  resolveDecision(s, d.id, true);
  close(cash(s.parent), c - d.cost);
  assert.equal(d.resolved, true);
  assert.throws(() => resolveDecision(s, d.id, true), /no longer/);
});
test("disposal recognizes the consolidated gain, not already-earned subsidiary profits twice", () => {
  let s = world(),
    u = createUnit(s, "steel", "Sale Steel", true);
  step(s, 12);
  let book = sheet(u.ledger).equity * ownership(u),
    price = unitValue(s, u) * ownership(u) * 0.88,
    before = groupSheet(s).attributable;
  sellUnit(s, u.id);
  close(groupSheet(s).attributable - before, price - book);
  step(s);
  close(s.last.otherIncome, price - book);
  assert.ok(integrity(s));
});
test("the same seed and decisions reproduce all economic and financial outcomes", () => {
  let a = world(),
    b = world();
  for (let s of [a, b]) {
    createUnit(s, "saas", "Deterministic SaaS", true);
    createUnit(s, "steel", "Deterministic Steel");
    borrow(s, { amount: 300000 });
    trade(s, "NOVA", 10000);
    angelInvest(s);
    step(s, 60);
  }
  assert.deepEqual(a, b);
});
test("all sectors complete a 120-month stress run with balanced books and valid saves", () => {
  for (let scenario of ["balanced", "recession", "boom"]) {
    let s = createGame({
      difficulty: "heir",
      scenario,
      seed: "STRESS-" + scenario,
    });
    for (let i of INDUSTRIES) createUnit(s, i.id, i.name, true);
    for (let month = 0; month < 120; month++) {
      advanceMonth(s);
      assert.ok(integrity(s));
      validateSave(s);
      for (let u of s.units) assert.ok(Number.isFinite(cash(u.ledger)));
    }
    assert.equal(s.reports.length, 120);
    assert.ok(s.macro.rate >= 0.005 && s.macro.rate <= 0.14);
    assert.ok(s.market.every((m) => m.price > 0));
  }
});
test("the save schema round-trips complete worlds and rejects unbalanced or unsafe imports", () => {
  let s = world();
  createUnit(s, "saas", "Saved SaaS", true);
  step(s, 5);
  assert.deepEqual(decode(JSON.stringify(s)), s);
  for (let mutate of [
    (x) => x.parent.balances.cash++,
    (x) => (x.units[0].industry = "fake"),
    (x) => (x.avatar = "javascript:alert(1)"),
    (x) => (x.market[0].price = -1),
    (x) => x.units.push(x.units[0]),
    (x) => x.executives.push({ id: 999999 }),
  ]) {
    let bad = structuredClone(s);
    mutate(bad);
    assert.throws(() => decode(JSON.stringify(bad)));
  }
  assert.throws(() => decode('{"__proto__":{},"version":2}'), /reserved/);
  assert.throws(() => decode("x".repeat(8000001)), /8 MB/);
});
test("manual persistence reports storage errors rather than claiming success", () => {
  let s = world(),
    written;
  persist({ setItem: (k, v) => (written = { k, v }) }, s);
  assert.equal(written.k, "conglomerate-auto");
  assert.deepEqual(decode(written.v), s);
  assert.throws(
    () =>
      persist(
        {
          setItem: () => {
            throw Error("QuotaExceeded");
          },
        },
        s,
      ),
    /QuotaExceeded/,
  );
});
test("version 1 saves migrate cash, securities, assets and debt into balanced books", () => {
  let old = {
    version: 1,
    founder: "Legacy Founder",
    group: "Legacy Holdings",
    difficulty: "operator",
    cash: 200000,
    treasury: 1000000,
    credit: 740,
    turn: 4,
    salary: 8000,
    cold: false,
    tax: 0,
    avatar: "",
    logo: "",
    units: [
      {
        name: "Legacy SaaS",
        type: 6,
        level: 1,
        build: 0,
        ownership: 0.8,
        public: false,
        round: 1,
        util: 0.75,
        compliance: 90,
      },
    ],
    loans: [
      {
        kind: "Term loan",
        balance: 100000,
        fixed: true,
        rate: 0.08,
        remaining: 30,
      },
    ],
    assets: [{ type: 0, name: "Porsche 911", value: 170000 }],
    angels: [],
    market: [{ symbol: "SPX", price: 525, history: [520, 525], change: 1 }],
    wallet: { SPX: 10 },
  };
  let s = migrateV1(old);
  close(cash(s.personal), 200000);
  close(cash(s.parent), 1000000);
  close(s.wallet.SPX, 10);
  close(s.loans[0].balance, 100000);
  assert.equal(s.units[0].name, "Legacy SaaS");
  assert.ok(integrity(s));
  validateSave(s);
});
test("saving and resuming preserves future random outcomes and complete accounting state", () => {
  let a = world();
  createUnit(a, "saas", "Resumable SaaS", true);
  borrow(a, { amount: 250000, kind: "revolver" });
  repay(a, a.loans[0].id);
  step(a, 8);
  let b = decode(JSON.stringify(a));
  for (let s of [a, b]) step(s, 12);
  assert.deepEqual(
    JSON.parse(JSON.stringify(a)),
    JSON.parse(JSON.stringify(b)),
  );
});
test("between-close subsidiary expenses appear in that company’s next monthly statement", () => {
  let s = world(),
    u = createUnit(s, "saas", "Accrual SaaS", true);
  step(s, 2);
  let before = balance(u.ledger, "opex");
  post(u.ledger, s.turn, "Manual compliance project", {
    opex: 18000,
    cash: -18000,
  });
  step(s);
  let delta = balance(u.ledger, "opex") - before;
  close(u.results.at(-1).opex, delta);
  assert.ok(u.results.at(-1).opex > 40000);
});
test("migrated debt fully amortizes at its original remaining maturity", () => {
  let old = {
    version: 1,
    founder: "Legacy",
    group: "Legacy Group",
    difficulty: "operator",
    cash: 100000,
    treasury: 1000000,
    credit: 740,
    turn: 4,
    salary: 0,
    cold: false,
    tax: 0,
    units: [],
    loans: [
      {
        kind: "Term loan",
        balance: 90000,
        fixed: true,
        rate: 0.08,
        remaining: 9,
      },
    ],
    assets: [],
    angels: [],
    market: [],
    wallet: {},
  };
  let s = migrateV1(old);
  step(s, 9);
  assert.equal(s.loans.length, 0);
  close(balance(s.parent, "debt"), 0);
  validateSave(s);
});
test("subsidiary income tax includes deductible costs approved between monthly closes", () => {
  let s = world(),
    u = createUnit(s, "saas", "Tax SaaS", true);
  step(s);
  post(u.ledger, s.turn, "Regulatory remediation", {
    opex: 18000,
    cash: -18000,
  });
  let loss = u.lossCarry;
  step(s);
  let r = u.results.at(-1),
    pretax = r.ebitda - r.depreciation;
  close(r.tax, Math.max(0, pretax - loss) * 0.24);
});
test("parent external gains are taxed, while intercompany dividends are exempt", () => {
  let s = world();
  s.salary = 0;
  post(s.parent, 0, "External realized gain", {
    cash: 50000,
    investmentIncome: -50000,
  });
  post(s.parent, 0, "Received exempt subsidiary dividend", {
    cash: 10000,
    dividendIncome: -10000,
  });
  step(s);
  close(-balance(s.parent, "taxPayable"), (50000 - 8500) * 0.24);
  assert.ok(integrity(s));
});
