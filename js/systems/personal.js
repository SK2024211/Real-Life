import { LUXURY } from "../core/catalog.js";
import { cash, post } from "../core/accounting.js";
import { random, normal, clamp, uid } from "../core/random.js";
import { news } from "../core/state.js";
export function trade(s, symbol, amount, sell = false) {
  let m = s.market.find((m) => m.symbol === symbol);
  if (!m || !Number.isFinite(amount) || amount <= 0)
    throw Error("Choose a valid security and positive trade value.");
  let fee = amount * (m.kind === "crypto" ? 0.004 : 0.0015),
    qty = sell ? amount / m.price : (amount - fee) / m.price;
  if (sell) {
    if ((s.wallet[symbol] || 0) + 1e-9 < qty)
      throw Error("Sell value exceeds your holdings.");
    let basis = ((s.basis[symbol] || 0) * qty) / s.wallet[symbol],
      gain = amount - fee - basis,
      tax = Math.max(0, gain) * 0.2;
    post(s.personal, s.turn, "Sell " + symbol, {
      cash: amount - fee - tax,
      investments: -basis,
      fees: fee,
      tax,
      investmentIncome: basis - amount,
    });
    s.wallet[symbol] = Math.max(0, s.wallet[symbol] - qty);
    s.basis[symbol] = Math.max(0, s.basis[symbol] - basis);
    if (s.wallet[symbol] < 1e-10) {
      s.wallet[symbol] = 0;
      s.basis[symbol] = 0;
    }
    s.stats.personalTax += tax;
    s.taxPaid += tax;
  } else {
    if (cash(s.personal) < amount)
      throw Error(
        "Insufficient personal cash; corporate treasury is legally separate.",
      );
    post(s.personal, s.turn, "Buy " + symbol, {
      cash: -amount,
      investments: amount - fee,
      fees: fee,
    });
    s.wallet[symbol] = (s.wallet[symbol] || 0) + qty;
    s.basis[symbol] = (s.basis[symbol] || 0) + amount - fee;
  }
  news(
    s,
    (sell ? "Sold " : "Bought ") + symbol + " from the personal portfolio.",
    "personal",
  );
}
export function buyAsset(s, index) {
  let a = LUXURY[index];
  if (!a || cash(s.personal) < a.cost)
    throw Error("Insufficient personal cash for that asset.");
  post(s.personal, s.turn, "Personal acquisition: " + a.name, {
    investments: a.cost,
    cash: -a.cost,
  });
  s.assets.push({
    id: uid(s),
    type: index,
    name: a.name,
    value: a.cost,
    basis: a.cost,
    acquired: s.turn,
  });
  news(s, a.name + " added to your private collection.", "personal");
}
export function sellAsset(s, id) {
  let a = s.assets.find((a) => a.id === Number(id));
  if (!a) throw Error("Asset not found");
  let proceeds = a.value * 0.9,
    tax = Math.max(0, proceeds - a.basis) * 0.2;
  post(s.personal, s.turn, "Personal disposal: " + a.name, {
    cash: proceeds - tax,
    investments: -a.basis,
    investmentIncome: a.basis - proceeds,
    tax,
  });
  s.assets = s.assets.filter((x) => x.id !== a.id);
  s.taxPaid += tax;
  s.stats.personalTax += tax;
  news(
    s,
    a.name +
      " sold, net of a 10% liquidity discount and applicable capital gains tax.",
    "personal",
  );
}
export function angelInvest(s) {
  let cost = 50000;
  if (cash(s.personal) < cost)
    throw Error("Angel rounds require $50K of personal cash.");
  let name = [
    "Orbit Robotics",
    "Helix Health",
    "Carbon Loop",
    "Atlas AI",
    "Lumen Materials",
  ][Math.floor(random(s) * 5)];
  post(s.personal, s.turn, "Angel investment: " + name, {
    investments: cost,
    cash: -cost,
  });
  s.angels.push({
    id: uid(s),
    name,
    value: cost,
    basis: cost,
    age: 0,
    duration: 24 + Math.floor(random(s) * 13),
    sector: random(s) > 0.5 ? "tech" : "science",
  });
  news(
    s,
    "Personal angel commitment to " + name + ". Capital is locked until exit.",
    "personal",
  );
}
export function coldStorage(s) {
  if (s.cold) throw Error("Cold custody is already enabled.");
  if (cash(s.personal) < 1500) throw Error("Cold custody setup costs $1,500.");
  post(s.personal, s.turn, "Cold custody setup", { fees: 1500, cash: -1500 });
  s.cold = true;
  news(
    s,
    "Cold custody activated: simulated crypto custodian-loss risk reduced. No real wallet or keys are created.",
    "personal",
  );
}
export function personalMonth(s) {
  let marketShock =
    normal(s) * 0.03 +
    (s.macro.growth - 0.02) * 0.12 -
    (s.macro.rate - 0.04) * 0.15;
  for (let m of s.market) {
    let old = m.price,
      rateSensitivity =
        m.kind === "bond"
          ? -(
              s.macro.history.at(-1)?.rate -
              (s.macro.history.at(-2)?.rate || s.macro.rate)
            ) * 7
          : m.symbol === "REIT"
            ? -(s.macro.rate - 0.04) * 0.2
            : 0;
    let shock = clamp(
      m.beta * marketShock + normal(s) * m.vol * 0.65 + 0.004 + rateSensitivity,
      -0.65,
      0.65,
    );
    m.price = Math.max(0.01, m.price * Math.exp(shock));
    m.change = (m.price / old - 1) * 100;
    m.history.push(m.price);
    m.history = m.history.slice(-120);
    let payout = ((s.wallet[m.symbol] || 0) * m.price * m.yield) / 12;
    if (payout) {
      let tax = payout * 0.2;
      post(s.personal, s.turn, m.symbol + " investment distribution", {
        cash: payout - tax,
        tax,
        dividendIncome: -payout,
      });
      s.taxPaid += tax;
      s.stats.personalTax += tax;
    }
  }
  if (random(s) < (s.cold ? 0.00025 : 0.004)) {
    for (let m of s.market.filter((m) => m.kind === "crypto")) {
      let basis = s.basis[m.symbol] || 0;
      if (basis) {
        post(s.personal, s.turn, "Crypto custody loss", {
          investments: -basis,
          fees: basis,
        });
        s.wallet[m.symbol] = 0;
        s.basis[m.symbol] = 0;
        news(
          s,
          "A simulated custody incident wrote off crypto holdings. Cold storage reduces this risk.",
          "alert",
        );
      }
    }
  }
  for (let a of s.assets) {
    let spec = LUXURY[a.type],
      upkeep = spec.upkeep * s.macro.priceIndex;
    post(s.personal, s.turn, "Personal upkeep: " + a.name, {
      opex: upkeep,
      cash: -upkeep,
    });
    a.value *=
      spec.kind === "property"
        ? Math.exp(
            s.macro.growth / 24 -
              (s.macro.rate - 0.04) / 12 +
              normal(s) * 0.007,
          )
        : 1 - spec.decay;
  }
  for (let a of s.angels) {
    a.age++;
    if (a.age >= a.duration) {
      let r = random(s),
        factor = r < 0.6 ? 0 : r < 0.84 ? 2 : r < 0.98 ? 10 : 100;
      factor *= s.macro.sectors[a.sector];
      let payout = a.basis * factor,
        tax = Math.max(0, payout - a.basis) * 0.2;
      post(s.personal, s.turn, "Angel exit: " + a.name, {
        cash: payout - tax,
        investments: -a.basis,
        investmentIncome: a.basis - payout,
        tax,
      });
      s.taxPaid += tax;
      s.stats.personalTax += tax;
      a.value = 0;
      news(
        s,
        a.name +
          " exited at " +
          factor.toFixed(1) +
          "×. Net proceeds " +
          Math.round(payout - tax).toLocaleString() +
          " dollars.",
        "personal",
      );
    }
  }
  s.angels = s.angels.filter((a) => a.age < a.duration);
  if (cash(s.personal) < 0)
    news(
      s,
      "Personal cash is overdrawn. Upkeep and income taxes continue; sell investments or cut expenses.",
      "alert",
    );
}
