import { createGame } from "./state.js";
import { ACCOUNTS, ledger, post, reconcile } from "./accounting.js";
import { INDUSTRIES, DIFFICULTIES, SECURITIES, LUXURY } from "./catalog.js";
import { operatingBalances, groupSheet } from "./selectors.js";
export const AUTO = "conglomerate-auto";
export function validateSave(s) {
  const fail = (message) => {
    throw Error("Invalid save: " + message);
  };
  const num = (v, min = -1e16, max = 1e16) => {
    if (!Number.isFinite(v) || v < min || v > max)
      fail("numeric field out of range");
  };
  const text = (v, max = 300) => {
    if (typeof v !== "string" || v.length > max) fail("invalid text field");
  };
  const arr = (v, max = 1000) => {
    if (!Array.isArray(v) || v.length > max) fail("invalid list");
  };
  function inspect(v, depth = 0) {
    if (depth > 15) fail("excessive nesting");
    if (typeof v === "number") num(v);
    if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (["__proto__", "prototype", "constructor"].includes(k))
          fail("reserved object key");
        inspect(v[k], depth + 1);
      }
    }
  }
  inspect(s);
  if (!s || s.version !== 2) fail("unsupported version");
  text(s.founder, 60);
  text(s.group, 80);
  text(s.seed, 100);
  if (!DIFFICULTIES[s.difficulty]) fail("unknown difficulty");
  num(s.turn, 0, 12000);
  if (!Number.isInteger(s.turn)) fail("noninteger turn");
  num(s.rng, 1, 4294967295);
  num(s.nextId, 1);
  num(s.salary, 0, 100000);
  num(s.credit, 300, 850);
  num(s.reputation, 0, 100);
  num(s.revision, 0);
  num(s.taxPaid, 0);
  num(s.disposedNCI);
  num(s.parentTaxLoss, 0);
  for (let k of ["avatar", "logo"]) {
    text(s[k], 3000000);
    if (
      s[k] &&
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s[k])
    )
      fail("invalid image");
  }
  function checkLedger(l) {
    if (!l?.balances || !Array.isArray(l.journal)) fail("missing ledger");
    if (Object.keys(l.balances).length !== Object.keys(ACCOUNTS).length)
      fail("unknown accounts");
    for (let a of Object.keys(ACCOUNTS)) num(l.balances[a]);
    if (!reconcile(l)) fail("unbalanced books");
    arr(l.journal, 300);
    for (let j of l.journal) {
      text(j.memo, 500);
      num(j.turn, 0);
      if (
        !j.lines ||
        Object.entries(j.lines).some(
          ([a, v]) => !ACCOUNTS[a] || !Number.isFinite(v),
        ) ||
        Math.abs(Object.values(j.lines).reduce((a, b) => a + b, 0)) > 0.02
      )
        fail("invalid journal");
    }
  }
  checkLedger(s.parent);
  checkLedger(s.personal);
  for (let k of [
    "units",
    "loans",
    "executives",
    "assets",
    "angels",
    "market",
    "reports",
    "history",
    "logs",
    "decisions",
    "goals",
  ])
    arr(
      s[k],
      k === "logs" ? 180 : k === "market" ? 7 : k === "units" ? 50 : 1000,
    );
  let ids = new Set();
  const unique = (o) => {
    num(o.id, 1);
    if (!Number.isInteger(o.id) || ids.has(o.id)) fail("duplicate identifier");
    ids.add(o.id);
    if (o.id >= s.nextId) fail("identifier sequence");
  };
  for (let u of s.units) {
    unique(u);
    text(u.name, 70);
    if (
      !INDUSTRIES.some((i) => i.id === u.industry) ||
      !["construction", "operating", "closed"].includes(u.status)
    )
      fail("invalid business");
    checkLedger(u.ledger);
    num(u.level, 1, 1000);
    num(u.shares, 1);
    num(u.parentShares, 1, u.shares);
    num(u.investmentCost, 0);
    num(u.buildRemaining, 0, 100);
    num(u.buildTotal, 1, 100);
    for (let k of ["condition", "morale", "compliance", "quality", "research"])
      num(u[k], 0, 110);
    num(u.customers, 0);
    num(u.occupancy, 0, 1);
    num(u.lossCarry, 0);
    num(u.distress, 0);
    num(u.round, 0);
    if (typeof u.public !== "boolean") fail("listing flag");
    for (let k of [
      "price",
      "utilization",
      "marketing",
      "maintenance",
      "wage",
      "research",
    ])
      num(u.policy?.[k], 0.1, 3);
    if (typeof u.policy.autonomy !== "boolean") fail("invalid autonomy flag");
    arr(u.results, 120);
    for (let r of u.results)
      for (let k of [
        "turn",
        "revenue",
        "cogs",
        "opex",
        "ebitda",
        "profit",
        "operatingCash",
        "depreciation",
        "tax",
        "volume",
      ])
        num(r[k]);
    if (u.expansion) {
      num(u.expansion.remaining, 0, 100);
      num(u.expansion.total, 1, 100);
      num(u.expansion.cost, 0);
    }
  }
  for (let l of s.loans) {
    unique(l);
    for (let k of ["balance", "original", "remaining", "rate", "spread"])
      num(l[k], 0);
    if (
      !["term", "revolver"].includes(l.kind) ||
      typeof l.fixed !== "boolean" ||
      typeof l.breached !== "boolean"
    )
      fail("invalid facility");
  }
  for (let e of s.executives) {
    unique(e);
    text(e.name, 80);
    text(e.specialty, 80);
    for (let k of ["competence", "integrity", "loyalty"]) num(e[k], 0, 100);
    num(e.salary, 0, 100000);
    num(e.candidate, 0, 7);
    num(e.tenure, 0);
    if (!["CEO", "CFO", "CMO", "COO", "MD"].includes(e.role))
      fail("invalid executive");
    if (e.role === "MD" && !s.units.some((u) => u.id === e.unitId))
      fail("orphaned MD");
  }
  for (let a of s.assets) {
    unique(a);
    if (!LUXURY[a.type]) fail("invalid personal asset");
    text(a.name, 80);
    num(a.value, 0);
    num(a.basis, 0);
    num(a.acquired, 0);
  }
  for (let a of s.angels) {
    unique(a);
    text(a.name, 80);
    num(a.value, 0);
    num(a.basis, 0);
    num(a.age, 0);
    num(a.duration, 1);
    if (!["tech", "science"].includes(a.sector)) fail("invalid angel sector");
  }
  if (!s.wallet || !s.basis) fail("missing portfolio");
  for (let obj of [s.wallet, s.basis])
    for (let [k, v] of Object.entries(obj)) {
      if (!SECURITIES.some((m) => m.symbol === k)) fail("unknown security");
      num(v, 0);
    }
  if (s.market.length !== SECURITIES.length) fail("incomplete market");
  for (let [i, m] of s.market.entries()) {
    if (m.symbol !== SECURITIES[i].symbol || m.kind !== SECURITIES[i].kind)
      fail("security identity");
    text(m.name, 80);
    for (let k of ["price", "vol", "beta", "yield", "change"]) num(m[k]);
    if (m.price <= 0) fail("invalid quote");
    arr(m.history, 120);
    if (!m.history.length) fail("missing prices");
    m.history.forEach((v) => num(v, 0));
  }
  let m = s.macro;
  if (!m) fail("missing macro");
  for (let k of [
    "priceIndex",
    "growth",
    "inflation",
    "rate",
    "unemployment",
    "confidence",
    "regimeAge",
  ])
    num(m[k]);
  num(m.priceIndex, 0.1, 1e9);
  if (
    !["expansion", "boom", "slowdown", "recession", "recovery"].includes(
      m.regime,
    )
  )
    fail("invalid regime");
  for (let k of ["corn", "steel", "oil", "energy"])
    num(m.commodities?.[k], 0.1, 10);
  for (let k of [
    "industry",
    "energy",
    "property",
    "logistics",
    "tech",
    "science",
  ])
    num(m.sectors?.[k], 0.1, 10);
  arr(m.history, 120);
  for (let r of m.history)
    for (let k of [
      "turn",
      "growth",
      "inflation",
      "rate",
      "unemployment",
      "confidence",
    ])
      num(r[k]);
  for (let l of s.logs) {
    unique(l);
    text(l.text, 1000);
    text(l.type, 40);
    num(l.turn, 0);
  }
  for (let d of s.decisions) {
    unique(d);
    text(d.title, 150);
    text(d.description, 1000);
    if (
      !["labor", "contract"].includes(d.type) ||
      typeof d.resolved !== "boolean"
    )
      fail("invalid decision");
    num(d.cost, 0);
    num(d.expires, 0);
    num(d.turn, 0);
  }
  for (let g of s.goals) {
    text(g.id, 30);
    text(g.title, 150);
    num(g.turn, 0);
  }
  for (let key of ["autoSweep", "audit", "insurance"])
    if (typeof s.policies?.[key] !== "boolean")
      fail("missing governance policy");
  for (let k of ["turnsProfitable", "peakWorth", "personalTax"])
    num(s.stats?.[k]);
  for (let k of [
    "revenue",
    "ebitda",
    "profit",
    "operatingCash",
    "tax",
    "interest",
    "capex",
    "distributions",
  ])
    num(s.last?.[k]);
  for (let r of s.reports) {
    for (let k of [
      "turn",
      "revenue",
      "cogs",
      "opex",
      "ebitda",
      "profit",
      "attributable",
      "tax",
      "depreciation",
      "interest",
      "cashChange",
      "operatingCash",
      "financingCash",
      "otherCash",
    ])
      num(r[k]);
    if (!r.balanceSheet) fail("report balance sheet");
    for (let k of [
      "assets",
      "liabilities",
      "equity",
      "nci",
      "cash",
      "ppe",
      "receivables",
      "inventory",
      "payables",
      "taxPayable",
      "debt",
      "attributable",
    ])
      num(r.balanceSheet[k]);
  }
  for (let n of s.history) num(n);
  if (!s.history.length) fail("missing equity history");
  if (!s.period || !s.period.balances || !s.archivedIncome)
    fail("missing closing balances");
  num(s.period.cash);
  if (!s.period.parentBalances) fail("missing parent closing balances");
  for (const [a, n] of Object.entries(s.period.parentBalances)) {
    if (!ACCOUNTS[a]) fail("invalid parent closing account");
    num(n);
  }
  if (!s.period.unitBalances) fail("missing subsidiary closing balances");
  for (let b of Object.values(s.period.unitBalances))
    for (let [a, n] of Object.entries(b)) {
      if (!ACCOUNTS[a]) fail("invalid subsidiary closing account");
      num(n);
    }
  if (
    Math.abs(
      -s.parent.balances.debt - s.loans.reduce((v, l) => v + l.balance, 0),
    ) > 0.03
  )
    fail("bank debt register does not reconcile");
  for (const o of [s.period.balances, s.archivedIncome])
    for (const [a, n] of Object.entries(o)) {
      if (!ACCOUNTS[a]) fail("invalid closing account");
      num(n);
    }
  return true;
}
export function migrateV1(old) {
  if (!old || old.version !== 1 || !DIFFICULTIES[old.difficulty])
    throw Error("Unsupported save format.");
  let s = createGame({
    founder: old.founder,
    group: old.group,
    difficulty: old.difficulty,
    seed: "LEGACY-" + old.turn,
    avatar: old.avatar || "",
    logo: old.logo || "",
  });
  for (const k of ["cash", "treasury", "credit", "turn"])
    if (!Number.isFinite(old[k])) throw Error("Invalid legacy save");
  s.turn = old.turn;
  s.credit = old.credit;
  s.salary = old.salary || 8000;
  s.cold = Boolean(old.cold);
  s.taxPaid = old.tax || 0;
  let costs = 0;
  for (let o of old.units || []) {
    let spec = INDUSTRIES[o.type];
    if (!spec) throw Error("Unknown legacy industry");
    let cost = spec.cost * o.level,
      l = ledger();
    post(l, s.turn, "Migrated opening assets", { ppe: cost, capital: -cost });
    costs += cost;
    s.units.push({
      id: s.nextId++,
      name: o.name,
      industry: spec.id,
      level: o.level,
      status: o.build ? "construction" : "operating",
      buildRemaining: o.build,
      buildTotal: spec.build,
      ledger: l,
      investmentCost: cost,
      shares: 1000000,
      parentShares: 1000000 * o.ownership,
      public: o.public,
      round: o.round,
      policy: {
        utilization: o.util,
        price: 1,
        marketing: 1,
        maintenance: 1,
        wage: 1,
        research: 1,
        autonomy: true,
      },
      condition: 100,
      morale: 78,
      compliance: o.compliance,
      quality: 65,
      customers: spec.churn ? spec.capacity * 0.25 : 0,
      occupancy: 0.75,
      research: 0,
      results: [],
      lossCarry: 0,
      distress: 0,
      expansion: null,
    });
  }
  s.parent = ledger(old.treasury + costs);
  if (costs)
    post(s.parent, s.turn, "Migrated subsidiary investments", {
      investments: costs,
      cash: -costs,
    });
  for (let o of old.loans || []) {
    let balance = o.balance;
    post(s.parent, s.turn, "Migrated debt opening", {
      capital: balance,
      debt: -balance,
    });
    s.loans.push({
      id: s.nextId++,
      kind: o.kind === "Term loan" ? "term" : "revolver",
      balance,
      original:
        o.kind === "Term loan"
          ? (balance * 60) / Math.max(1, o.remaining)
          : balance,
      fixed: o.fixed,
      spread: 0.035,
      rate: o.rate,
      remaining: o.remaining,
      breached: false,
    });
  }
  for (let e of old.executives || []) {
    let isMD = String(e.role).startsWith("MD:"),
      oldUnit = (old.units || []).findIndex(
        (u) => u.id === Number(String(e.role).slice(3)),
      ),
      unitId = isMD ? s.units[oldUnit]?.id : null;
    if (isMD && !unitId) continue;
    s.executives.push({
      id: s.nextId++,
      candidate: e.candidate ?? 0,
      name: e.name,
      competence: e.competence,
      integrity: e.integrity,
      loyalty: e.loyalty,
      salary: e.salary,
      specialty: "Legacy appointment",
      tenure: 0,
      role: isMD ? "MD" : e.role,
      unitId,
    });
  }
  s.personal = ledger(old.cash);
  for (let m of s.market) {
    let o = (old.market || []).find((o) => o.symbol === m.symbol);
    if (o) {
      m.price = o.price;
      m.history = o.history.slice(-120);
      m.change = o.change;
      let qty = old.wallet?.[m.symbol] || 0;
      s.wallet[m.symbol] = qty;
      s.basis[m.symbol] = qty * m.price;
    }
  }
  s.assets = (old.assets || []).map((a) => ({
    id: s.nextId++,
    type: a.type,
    name: a.name,
    value: a.value,
    basis: a.value,
    acquired: s.turn,
  }));
  s.angels = (old.angels || []).map((a) => ({
    id: s.nextId++,
    name: a.name,
    value: a.value,
    basis: a.value,
    age: a.age,
    duration: 18,
    sector: "tech",
  }));
  let inv =
    Object.values(s.basis).reduce((a, b) => a + b, 0) +
    s.assets.reduce((a, b) => a + b.value, 0) +
    s.angels.reduce((a, b) => a + b.value, 0);
  if (inv)
    post(s.personal, s.turn, "Migrated personal holdings", {
      investments: inv,
      capital: -inv,
    });
  s.logs = [
    {
      id: s.nextId++,
      turn: s.turn,
      type: "system",
      text: "Version 1 save migrated. Industry economics and valuations now use the new model. Inject working capital into legacy subsidiaries before continuing. Executive appointments and current asset holdings were retained. Historical purchase bases were reconstructed from available values.",
    },
  ];
  for (let l of (old.logs || []).slice(0, 80))
    if (typeof l.text === "string")
      s.logs.push({
        id: s.nextId++,
        turn: l.turn || 0,
        text: l.text,
        type: l.type || "legacy",
      });
  s.period = {
    balances: operatingBalances(s),
    cash: groupSheet(s).cash,
    parentBalances: { ...s.parent.balances },
    unitBalances: Object.fromEntries(
      s.units.map((u) => [u.id, { ...u.ledger.balances }]),
    ),
  };
  s.history = [groupSheet(s).attributable];
  validateSave(s);
  return s;
}
export function decode(text) {
  if (text.length > 8e6) throw Error("Save exceeds the 8 MB limit.");
  let s = JSON.parse(text);
  if (s?.version === 1) s = migrateV1(s);
  validateSave(s);
  return s;
}
export function persist(storage, s, key = AUTO) {
  validateSave(s);
  storage.setItem(key, JSON.stringify(s));
}
