import { PEOPLE } from "../core/catalog.js";
import { cash, post } from "../core/accounting.js";
import { random, uid, clamp } from "../core/random.js";
import { findUnit } from "./businesses.js";
import { news } from "../core/state.js";
export function hire(s, candidate, role, unitId = null) {
  const c = PEOPLE[candidate];
  if (!c || !["CEO", "CFO", "COO", "CMO", "MD"].includes(role))
    throw Error("Invalid executive appointment.");
  if (s.executives.some((e) => e.candidate === candidate))
    throw Error("This executive already works for the group.");
  if (role === "MD") findUnit(s, unitId);
  if (
    s.executives.some(
      (e) => e.role === role && (role !== "MD" || e.unitId === Number(unitId)),
    )
  )
    throw Error("This role already has an incumbent.");
  if (cash(s.parent) < c.salary)
    throw Error("Insufficient treasury for the signing payment.");
  post(s.parent, s.turn, "Executive signing bonus", {
    payroll: c.salary,
    cash: -c.salary,
  });
  s.executives.push({
    ...c,
    candidate,
    id: uid(s),
    role,
    unitId: role === "MD" ? Number(unitId) : null,
    tenure: 0,
  });
  news(
    s,
    c.name + " appointed " + role + ". Role effects scale with competence.",
    "people",
  );
}
export function dismiss(s, id) {
  let e = s.executives.find((e) => e.id === Number(id));
  if (!e) throw Error("Executive not found");
  let severance = e.salary * 2;
  if (cash(s.parent) < severance)
    throw Error("Two months of severance must be funded.");
  post(s.parent, s.turn, "Executive severance", {
    payroll: severance,
    cash: -severance,
  });
  s.executives = s.executives.filter((x) => x.id !== e.id);
  news(s, e.name + " dismissed with two months of severance.", "people");
}
export function bonus(s, id) {
  let e = s.executives.find((e) => e.id === Number(id));
  if (!e || cash(s.parent) < e.salary)
    throw Error("Cannot fund that performance bonus.");
  post(s.parent, s.turn, "Performance award", {
    payroll: e.salary,
    cash: -e.salary,
  });
  e.loyalty = clamp(e.loyalty + 12, 0, 100);
  news(s, e.name + " received a bonus; loyalty improved.", "people");
}
export function governanceMonth(s) {
  let cost = 5000 + (s.policies.audit ? 3500 : 0),
    payroll = s.executives.reduce((a, e) => a + e.salary, 0) + s.salary;
  post(s.parent, s.turn, "Holding company administration", {
    opex: cost,
    cash: -cost,
  });
  if (payroll)
    post(s.parent, s.turn, "Chairman and executive payroll", {
      payroll,
      cash: -payroll,
    });
  if (s.salary) {
    let tax = s.salary * 0.3;
    post(s.personal, s.turn, "Chairman salary and withholding", {
      cash: s.salary - tax,
      tax,
      payroll: 0,
      revenue: -s.salary,
    });
    s.stats.personalTax += tax;
    s.taxPaid += tax;
  }
  let ceo = s.executives.find((e) => e.role === "CEO");
  for (let e of s.executives) {
    e.tenure++;
    e.loyalty = clamp(
      e.loyalty +
        (s.last.profit > 0 ? 0.15 : -0.25) +
        (ceo?.competence || 0) / 1000,
      0,
      100,
    );
    if (e.loyalty < 40 && random(s) < 0.08) {
      s.executives = s.executives.filter((x) => x.id !== e.id);
      news(
        s,
        e.name + " resigned after sustained morale deterioration.",
        "people",
      );
    }
    if (
      e.integrity < 85 &&
      random(s) < (85 - e.integrity) * 0.0005 * (s.policies.audit ? 0.2 : 1)
    ) {
      let fraud = e.salary * (2 + random(s) * 5);
      post(s.parent, s.turn, "Misconduct loss", { fees: fraud, cash: -fraud });
      s.reputation = Math.max(0, s.reputation - 7);
      news(
        s,
        "Internal controls uncovered misconduct involving " +
          e.name +
          ". External audit recommended.",
        "alert",
      );
    }
  }
  if (s.turn % 6 === 0 && s.decisions.filter((d) => !d.resolved).length < 3) {
    let type = random(s) < 0.5 ? "labor" : "contract";
    s.decisions.push({
      id: uid(s),
      type,
      turn: s.turn,
      resolved: false,
      title:
        type === "labor"
          ? "A group-wide labor accord"
          : "A strategic procurement contract",
      description:
        type === "labor"
          ? "Staff representatives ask for a one-time training and retention investment."
          : "A supplier offers a six-month group procurement discount in exchange for an upfront payment.",
      cost: type === "labor" ? 35000 : 60000,
      expires: s.turn + 3,
    });
    news(
      s,
      "Board resolution awaiting your decision: " +
        s.decisions.at(-1).title +
        ".",
      "board",
    );
  }
  for (let d of s.decisions)
    if (!d.resolved && s.turn > d.expires) {
      d.resolved = true;
      d.choice = "expired";
      news(s, "Board opportunity expired: " + d.title + ".", "board");
    }
  return { cost, payroll };
}
export function resolveDecision(s, id, accept) {
  let d = s.decisions.find((d) => d.id === Number(id));
  if (!d || d.resolved) throw Error("Resolution is no longer available.");
  if (accept) {
    if (cash(s.parent) < d.cost)
      throw Error("Treasury cannot fund this board decision.");
    post(s.parent, s.turn, d.title, { opex: d.cost, cash: -d.cost });
    if (d.type === "labor") {
      s.units.forEach((u) => (u.morale = clamp(u.morale + 15, 0, 100)));
      s.reputation = clamp(s.reputation + 3, 0, 100);
    } else s.procurementUntil = s.turn + 6;
  }
  d.resolved = true;
  d.choice = accept ? "accepted" : "declined";
  news(s, "Board " + d.choice + ": " + d.title + ".", "board");
}
