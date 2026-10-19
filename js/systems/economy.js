import { random, normal, clamp } from "../core/random.js";
import { news } from "../core/state.js";
const target = {
  expansion: 0.03,
  boom: 0.055,
  slowdown: 0.007,
  recession: -0.025,
  recovery: 0.018,
};
export function simulateEconomy(s) {
  let m = s.macro,
    oldRate = m.rate;
  m.regimeAge++;
  if (m.regimeAge >= 8 && random(s) < 0.13) {
    const path = {
      expansion: ["boom", "slowdown"],
      boom: ["slowdown", "expansion"],
      slowdown: ["recession", "recovery"],
      recession: ["recovery", "recession"],
      recovery: ["expansion", "slowdown"],
    };
    m.regime = path[m.regime][random(s) < 0.68 ? 0 : 1];
    m.regimeAge = 0;
    news(
      s,
      "Economic regime shifts to " +
        m.regime +
        ". Demand and credit conditions are adjusting.",
      "macro",
    );
  }
  m.growth = clamp(
    m.growth * 0.85 + target[m.regime] * 0.15 + normal(s) * 0.002,
    -0.08,
    0.09,
  );
  m.inflation = clamp(
    m.inflation * 0.965 +
      (0.022 + Math.max(0, m.growth) * 0.45) * 0.035 +
      normal(s) * 0.0012,
    0.002,
    0.14,
  );
  m.priceIndex *= 1 + m.inflation / 12;
  const rateTarget = clamp(
    0.02 + (m.inflation - 0.02) * 1.3 + m.growth * 0.3,
    0.005,
    0.14,
  );
  if (s.turn % 3 === 0) {
    m.rate = clamp(
      m.rate + clamp(rateTarget - m.rate, -0.0025, 0.0025),
      0.005,
      0.14,
    );
    if (Math.abs(m.rate - oldRate) > 0.0001)
      news(
        s,
        "Central bank " +
          (m.rate > oldRate ? "raises" : "cuts") +
          " policy rate to " +
          (m.rate * 100).toFixed(2) +
          "%. Floating facilities reprice.",
        "macro",
      );
  }
  m.unemployment = clamp(
    m.unemployment + (0.02 - m.growth) * 0.025 + normal(s) * 0.0008,
    0.025,
    0.16,
  );
  m.confidence = clamp(
    0.85 + m.growth * 5 - m.unemployment * 0.5 + normal(s) * 0.025,
    0.55,
    1.3,
  );
  for (const k of Object.keys(m.commodities))
    m.commodities[k] = clamp(
      m.commodities[k] + (1 - m.commodities[k]) * 0.06 + normal(s) * 0.035,
      0.5,
      2.5,
    );
  if (random(s) < 0.09) {
    let c = Object.keys(m.commodities)[Math.floor(random(s) * 4)],
      up = random(s) > 0.35;
    m.commodities[c] = clamp(m.commodities[c] * (up ? 1.2 : 0.84), 0.5, 2.5);
    news(
      s,
      (up ? "Supply disruption" : "Supply recovery") +
        " in " +
        c +
        ": input index " +
        m.commodities[c].toFixed(2) +
        "×.",
      "macro",
    );
  }
  for (const k of Object.keys(m.sectors)) {
    let sensitivity =
      k === "property"
        ? m.growth * 2 - (m.rate - 0.04) * 1.8
        : k === "tech"
          ? m.growth * 3 - (m.rate - 0.04) * 2
          : m.growth * 1.5;
    m.sectors[k] = clamp(
      m.sectors[k] * 0.85 + (1 + sensitivity) * 0.15 + normal(s) * 0.018,
      0.55,
      1.5,
    );
  }
  m.history.push({
    turn: s.turn,
    growth: m.growth,
    inflation: m.inflation,
    rate: m.rate,
    unemployment: m.unemployment,
    confidence: m.confidence,
  });
  m.history = m.history.slice(-120);
}
