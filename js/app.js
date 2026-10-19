import { createGame, news } from "./core/state.js";
import { advanceMonth } from "./core/engine.js";
import { INDUSTRIES, DIFFICULTIES, SCENARIOS, NAV } from "./core/catalog.js";
import { cash } from "./core/accounting.js";
import {
  valuation,
  netWorth,
  portfolio,
  rating,
  date,
  unitValue,
  ownership,
} from "./core/selectors.js";
import { AUTO, persist, decode, validateSave } from "./core/storage.js";
import {
  createUnit,
  expandUnit,
  injectCapital,
  remediate,
  setPolicy,
  equityRound,
  sellUnit,
  findUnit,
} from "./systems/businesses.js";
import {
  borrow,
  repay,
  redraw,
  distribute,
  founderCapital,
} from "./systems/finance.js";
import { hire, dismiss, bonus, resolveDecision } from "./systems/governance.js";
import {
  trade,
  buyAsset,
  sellAsset,
  angelInvest,
  coldStorage,
} from "./systems/personal.js";
import {
  esc,
  money,
  pct,
  button,
  stat,
  field,
  select,
  newsList,
} from "./ui/components.js";
import { PAGES, pageNotes, unitDetail, catalog } from "./ui/pages.js";
const $ = (s) => document.querySelector(s);
let state = null,
  tab = location.hash.slice(1) || "hq",
  timer = null,
  speed = 5000,
  toastTimer,
  modal = null,
  reportEntity = "group",
  conflict = false,
  lastFocus = null;
const identity = { avatar: "", logo: "" };
function notify(text) {
  $("#toast").className = "toast";
  $("#toast").textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").className = "";
    $("#toast").textContent = "";
  }, 5000);
}
function autosave() {
  try {
    persist(localStorage, state);
    return true;
  } catch (e) {
    notify("Autosave unavailable: " + e.message + ". Export a JSON backup.");
    return false;
  }
}
/** Commands are atomic: validation or accounting failure restores the prior world. */
function transact(fn, message) {
  if (conflict) {
    notify(
      "Another tab changed this save. Reload before making further decisions.",
    );
    return;
  }
  let before = structuredClone(state);
  try {
    fn();
    state.revision++;
    validateSave(state);
    autosave();
    render();
    refreshModal();
    if (message) notify(message);
    return true;
  } catch (e) {
    state = before;
    stop();
    render();
    refreshModal();
    notify(e.message);
    return false;
  }
}
function stop() {
  clearInterval(timer);
  timer = null;
}
function setPlaying() {
  if (timer) stop();
  else {
    if (modal) return;
    timer = setInterval(() => transact(() => advanceMonth(state)), speed);
  }
  render();
}
function navigate(t) {
  if (!PAGES[t]) return;
  tab = t;
  reportEntity = "group";
  closeModal();
  location.hash = t;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function render() {
  if (!state) {
    setup();
    return;
  }
  if (!PAGES[tab]) tab = "hq";
  const page = NAV.find((n) => n[0] === tab),
    pending = state.decisions.filter((d) => !d.resolved).length;
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-icon">${state.logo ? `<img src="${esc(state.logo)}" alt="Company logo">` : "▥"}</span><span class="brand-title">conglomerate<span style="color:#b9d38c">.</span></span></div><div class="edition">FOUNDER & CHAIRMAN SIMULATOR</div><div class="nav-label">THE HOLDING COMPANY</div><nav aria-label="Main navigation">${NAV.map(([id, icon, label]) => `<button type="button" class="nav-btn ${tab === id ? "active" : ""}" data-action="navigate" data-id="${id}" ${tab === id ? 'aria-current="page"' : ""}><span class="nav-icon">${icon}</span>${label}${id === "hq" && pending ? " · " + pending : ""}</button>`).join("")}</nav><div class="nav-label">THE LONG GAME</div>${button('<span class="nav-icon">▣</span> Saves & settings', "saves", "", "nav-btn")}${button('<span class="nav-icon">?</span> Field manual', "manual", "", "nav-btn")}<div class="sidebar-bottom"><div class="profile">${
      state.avatar
        ? `<img class="avatar" src="${esc(state.avatar)}" alt="Founder portrait">`
        : `<div class="avatar">${esc(
            state.founder
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2),
          )}</div>`
    }<div><div class="header-name">${esc(state.founder)}</div><p class="muted tiny">Founder & Chairman</p></div></div><p class="muted tiny" style="margin-top:14px;color:#8da590">World seed: ${esc(state.seed)}</p></div></aside><main class="main"><header class="topbar"><div class="breadcrumb"><span class="header-name">${esc(state.group)}</span> &nbsp;/&nbsp; <span>${page[2]}</span></div><div class="top-actions"><span class="date">◷ &nbsp; ${date(state)} <span class="muted">· ${state.turn}</span></span>${button(timer ? "Ⅱ Pause" : "▷ Play", "play", "", "mini")}${button("Quarter +3", "quarter", "", "mini quarter-btn")}${button("Next month &nbsp; →", "advance", "", "primary")}</div></header><div class="content"><div class="heading"><div><div class="eyebrow">${esc(state.group)} / ${tab === "hq" ? "THE CHAIRMAN’S OFFICE" : "DECISION CENTER"}</div><h1>${tab === "hq" ? "Build something that outlasts you." : page[2]}</h1><p class="subtitle">${pageNotes[tab]}</p></div><span class="tag status-pill ${cash(state.parent) < 0 ? "bad" : ""}">● &nbsp; ${cash(state.parent) < 0 ? "PARENT LIQUIDITY DEFICIT" : state.macro.regime.toUpperCase() + " · " + rating(state)}</span></div><div class="metrics">${stat("Personal net worth", money(netWorth(state)), "Your cash, assets & holding equity", "◇")}${stat("Personal cash", money(cash(state.personal)), "Available for personal decisions", "▱")}${stat("Holding company value", money(valuation(state)), "Market value · not book equity", "▦")}${stat("Parent treasury", money(cash(state.parent)), "Subsidiary banks remain separate", "▤")}</div><div id="page-content">${PAGES[tab](state, reportEntity)}</div><div class="ticker"><span class="live">● LIVE WIRE</span><span>${esc(state.logs[0]?.text || "The chairman’s office is open. Your first decision awaits.")}</span></div><footer class="footer"><span>CONGLOMERATE / A long game, well played.</span><span>Seeded monthly simulation · USD · <span class="save-indicator">Local autosave</span> · v2.0</span></footer></div></main></div>`;
}
function dialog(title, content, { wide = false, footer = "" } = {}) {
  stop();
  lastFocus = document.activeElement;
  $("#modal-root").innerHTML =
    `<div class="overlay"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1"><header class="modal-header"><h2 id="dialog-title">${title}</h2><div class="inline-actions">${modal?.type === "unit" ? button("Next month →", "advance", "", "mini") : ""}${button("✕", "close", "", "mini", 'aria-label="Close dialog"')}</div></header>${content}${footer ? "<footer>" + footer + "</footer>" : ""}</section></div>`;
  $(".modal").focus();
  // Keep play indicators correct when opening a decision dialog.
  const playButton = $('[data-action="play"]');
  if (playButton) playButton.textContent = "▷ Play";
}
function closeModal() {
  modal = null;
  $("#modal-root").innerHTML = "";
  if (lastFocus?.isConnected) lastFocus.focus();
}
function openUnit(id) {
  modal = { type: "unit", id: Number(id) };
  dialog(
    "OPERATING COMPANY / CHAIRMAN’S MANDATE",
    unitDetail(state, findUnit(state, id)),
    { wide: true },
  );
}
function refreshModal() {
  if (!modal) return;
  const m = { ...modal };
  if (m.type === "unit") {
    if (state.units.some((u) => u.id === m.id)) openUnit(m.id);
    else closeModal();
  } else if (m.type === "saves") saveDialog();
  else if (m.type === "news") newsDialog();
}
function confirmDialog(title, copy, action, id, amount) {
  modal = { type: "confirm" };
  dialog(
    title,
    `<p class="dialog-copy">${copy}</p><div class="action-row">${button("Keep things as they are", "close")}${button("Confirm decision", action, id, "primary", amount === undefined ? "" : `data-amount="${amount}"`)}</div>`,
  );
}
function buildDialog(type, acquire) {
  const i = INDUSTRIES.find((i) => i.id === type);
  modal = { type: "build" };
  dialog(
    acquire
      ? "ACQUISITIONS / NEW MANDATE"
      : "CAPITAL EXPENDITURE / NEW PROJECT",
    `<h1>${i.name}</h1><p class="dialog-copy">${i.description}</p><div class="banner">Investment: ${money(i.cost * (acquire ? 1.2 : 1))} · ${acquire ? "Immediately operational" : i.build + " months of construction"}<br>25% remains in the subsidiary bank as working capital. Pre-opening burn and future losses consume this reserve.</div><form data-form="create-unit"><input type="hidden" name="industry" value="${i.id}"><input type="hidden" name="acquire" value="${acquire}">${field("Subsidiary name", "name", "text", i.name + " " + (state.units.filter((u) => u.industry === type).length + 1), 'maxlength="70" required')}<div class="action-row"><button class="primary" type="submit">${acquire ? "Complete acquisition" : "Approve construction"}</button>${button("Cancel", "close")}</div></form>`,
  );
}
function saveDialog() {
  modal = { type: "saves" };
  dialog(
    "SAVES & SIMULATION SETTINGS",
    `<p class="muted">Every month and decision is autosaved on this browser origin. Manual slots are independent.</p>${[
      1, 2, 3,
    ]
      .map((i) => {
        let saved = null;
        try {
          let raw = localStorage.getItem("conglomerate-slot-" + i);
          if (raw) saved = decode(raw);
        } catch {}
        return `<div class="slot-row"><div><strong>Slot ${i}</strong><small>${saved ? esc(saved.group) + " · " + saved.turn + " months · " + money(valuation(saved)) : "Empty or unavailable"}</small></div><div class="action-row">${button("Save here", "save-slot", i, "mini")}${button("Load", "load-slot", i, "mini", saved ? "" : "disabled")}</div></div>`;
      })
      .join(
        "",
      )}<div class="action-row">${button("Export JSON backup", "export", "", "primary")}${button("Import JSON save", "import")}${button("New legacy", "new-game", "", "danger-button")}</div><input id="import-file" type="file" accept="application/json,.json" hidden><hr><label class="form-row"><span>Continuous-play speed</span><select id="speed"><option value="2000" ${speed === 2000 ? "selected" : ""}>1 month every 2 seconds</option><option value="5000" ${speed === 5000 ? "selected" : ""}>1 month every 5 seconds</option><option value="10000" ${speed === 10000 ? "selected" : ""}>1 month every 10 seconds</option></select></label><p class="muted">Play pauses when a dialog opens or the browser tab is hidden. Import supports version 1 migration. Back up before clearing browser data.</p>`,
  );
}
function newsDialog(filter = "all") {
  modal = { type: "news" };
  dialog(
    "THE GROUP NEWSWIRE",
    `<label class="form-row"><span>Desk</span><select id="news-filter">${["all", "alert", "macro", "results", "capital", "board", "people", "personal", "milestone"].map((k) => `<option ${filter === k ? "selected" : ""} value="${k}">${k.toUpperCase()}</option>`).join("")}</select></label>${newsList(state.logs.filter((l) => filter === "all" || l.type === filter))}`,
  );
}
function manual() {
  modal = { type: "manual" };
  dialog(
    "THE CHAIRMAN’S FIELD MANUAL",
    `<div class="model-copy"><h1>Read the whole balance sheet.</h1><p>Conglomerate is a monthly, seeded economic sandbox. Your decisions shape cash conversion, ownership, risk, and long-term value. There is no guaranteed winning strategy.</p><h3>1. Capital is not all in one bank</h3><p>Parent treasury, each subsidiary’s bank, and personal cash are separate. A new business uses 70% of investment for fixed assets, 25% for operating cash, and 5% for inventory. Acquisitions cost 20% more but open immediately. Construction consumes cash before sales begin.</p><h3>2. Revenue is not cash</h3><p>Sales are booked to receivables and collected in later months. Input inventory is bought on supplier credit, consumed into cost of sales, and paid down over time. Industry collection cycles differ. Depreciation reduces profit without spending cash. Corporate taxes accrue monthly and settle quarterly. Each subsidiary carries its own tax losses; parent losses do not automatically offset subsidiary taxes.</p><h3>3. Let companies earn their independence</h3><p>Use operating mandates to adjust prices, utilization, maintenance, wages, marketing, and R&D. Tech businesses acquire and lose subscribers. Property occupancy adjusts gradually. Plants have capacity and equipment condition. Biotech requires research progress. Unfunded operating deficits can lead to administration after six months.</p><h3>4. Distributions must be earned</h3><p>With automatic sweeps enabled, profitable companies distribute cash above their operating reserve. All shareholders receive their ownership share. Private rounds and IPOs issue new shares, dilute the parent, and put proceeds in the subsidiary bank. Founder dividends require retained parent profits, a 25% treasury payout ceiling, and bank covenant compliance.</p><h3>5. Debt changes your options</h3><p>Loans charge a 1% origination fee. Term loans amortize over 60 months; revolvers mature in 12 and permit redraws within the original facility. Variable rates follow policy rates and credit spreads. The bank checks a 65% leverage ceiling and 1.5× EBITDA interest coverage once three monthly reports exist. Breaches block new borrowing and founder dividends; floating spreads rise 250bps.</p><h3>6. People are economic decisions</h3><p>CFOs lower funding spreads. COOs reduce unit variable costs. CMOs improve acquisition efficiency. CEOs support executive loyalty. An MD with competence of at least 80 can adjust utilization and remedy critical compliance if funded and authorized. Payroll, signing payments, severance, and bonuses are real cash costs. Integrity influences misconduct risk; loyalty influences retention.</p><h3>7. Your personal life has a balance sheet too</h3><p>Salary is taxed at 30%; dividends and positive realized investment gains at 20%. Security distributions are taxable. Vehicles depreciate; property responds to growth and interest rates. Upkeep is unavoidable. Crypto custody incidents are simulated; cold custody reduces their probability. Angel investments are illiquid and often fail. No real financial accounts are connected.</p><h3>8. The model’s boundaries</h3><p>All amounts are USD and all tax rates are simplified. Valuation uses sector earnings multiples, net assets, and interest-rate discounts; it is an estimate, not a guaranteed exit price. Consolidated statements include full subsidiary accounts and noncontrolling equity. Integration is modeled as lower external input costs, not a live order book between firms. Deficits represent emergency operating arrears/overdraft pressure, not an approved credit line. There is no geographic tax code, real securities feed, real money, multiplayer, or server account.</p><h3>Controls & reproducibility</h3><p>Press N to advance one month, Space to play/pause, and Escape to close a dialog. Quarter advances three monthly closes. The same seed and decisions generate the same world. The game supports 50 active companies, 120 monthly reports, 180 news entries, and 300 recent journals per entity; all account balances remain retained. Export JSON for durable backups.</p></div>`,
    { wide: true },
  );
}
function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "conglomerate-v2-turn-" + state.turn + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("JSON backup exported.");
}
async function importSave(file) {
  if (!file) return;
  if (file.size > 8e6) {
    notify("Save exceeds the 8 MB limit.");
    return;
  }
  try {
    const candidate = decode(await file.text());
    stop();
    state = candidate;
    conflict = false;
    tab = "hq";
    closeModal();
    autosave();
    render();
    notify("Save restored. Your balance sheets are reconciled.");
  } catch (e) {
    notify(e.message + ". Current game preserved.");
  }
}
function restoreSlot(id) {
  try {
    const raw = localStorage.getItem("conglomerate-slot-" + id);
    if (!raw) throw Error("Save slot is empty.");
    const candidate = decode(raw);
    state = candidate;
    conflict = false;
    stop();
    tab = "hq";
    closeModal();
    autosave();
    render();
    notify("Manual save restored.");
  } catch (e) {
    notify(e.message);
  }
}
const actions = {
  navigate: (el) => navigate(el.dataset.id),
  advance: () => transact(() => advanceMonth(state)),
  quarter: () =>
    transact(() => {
      for (let i = 0; i < 3; i++) advanceMonth(state);
    }),
  play: setPlaying,
  close: closeModal,
  saves: saveDialog,
  manual,
  news: () => newsDialog(),
  catalog: () => {
    navigate("subs");
    document
      .querySelector(".industry-card")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  unit: (el) => openUnit(el.dataset.id),
  build: (el) => buildDialog(el.dataset.id, false),
  acquire: (el) => buildDialog(el.dataset.id, true),
  expand: (el) =>
    transact(() => expandUnit(state, el.dataset.id), "Expansion funded."),
  remediate: (el) =>
    transact(() => remediate(state, el.dataset.id), "Compliance restored."),
  round: (el) =>
    transact(
      () => equityRound(state, el.dataset.id),
      "Primary equity round completed.",
    ),
  ipo: (el) =>
    transact(
      () => equityRound(state, el.dataset.id, true),
      "Public market debut completed.",
    ),
  "sell-unit-confirm": (el) => {
    let u = findUnit(state, el.dataset.id);
    confirmDialog(
      "DIVESTMENT REVIEW",
      `Sell ${esc(u.name)} for an estimated ${money(unitValue(state, u) * ownership(u) * 0.88)}? Your entire stake and associated management appointments will leave the group. A 12% liquidity discount applies.`,
      "sell-unit",
      u.id,
    );
  },
  "sell-unit": (el) => {
    const id = el.dataset.id;
    closeModal();
    transact(() => sellUnit(state, id), "Business divested.");
  },
  repay: (el) =>
    transact(() => repay(state, el.dataset.id), "Bank facility repaid."),
  "redraw-dialog": (el) => {
    let l = state.loans.find((l) => l.id === Number(el.dataset.id));
    modal = { type: "redraw" };
    dialog(
      "REVOLVER / DRAW REQUEST",
      `<p class="dialog-copy">Undrawn commitment: ${money(l.original - l.balance)}. Maturity: ${l.remaining} months.</p><form data-form="redraw"><input name="id" type="hidden" value="${l.id}">${field("Additional draw ($)", "amount", "number", Math.min(50000, l.original - l.balance), 'min="1" required')}<button class="primary" type="submit">Draw committed funds</button></form>`,
    );
  },
  bonus: (el) =>
    transact(() => bonus(state, el.dataset.id), "Performance award paid."),
  "dismiss-confirm": (el) => {
    let e = state.executives.find((e) => e.id === Number(el.dataset.id));
    confirmDialog(
      "EXECUTIVE TRANSITION",
      `Release ${esc(e.name)} and pay ${money(e.salary * 2)} in contractual severance?`,
      "dismiss",
      e.id,
    );
  },
  dismiss: (el) => {
    let id = el.dataset.id;
    closeModal();
    transact(() => dismiss(state, id), "Executive released.");
  },
  decision: (el) =>
    transact(
      () => resolveDecision(state, el.dataset.id, el.dataset.accept === "true"),
      "Board resolution recorded.",
    ),
  cold: () => transact(() => coldStorage(state), "Cold custody enabled."),
  angel: () =>
    transact(() => angelInvest(state), "Angel investment committed."),
  "sell-all": (el) => {
    let m = state.market.find((m) => m.symbol === el.dataset.id);
    transact(
      () =>
        trade(state, m.symbol, (state.wallet[m.symbol] || 0) * m.price, true),
      "Position closed.",
    );
  },
  "buy-asset": (el) =>
    transact(
      () => buyAsset(state, Number(el.dataset.id)),
      "Personal asset acquired.",
    ),
  "sell-asset-confirm": (el) => {
    let a = state.assets.find((a) => a.id === Number(el.dataset.id));
    confirmDialog(
      "PERSONAL ASSET DISPOSAL",
      `Sell ${esc(a.name)} for ${money(a.value * 0.9)} before applicable capital-gains tax? The exit discount is 10%.`,
      "sell-asset",
      a.id,
    );
  },
  "sell-asset": (el) => {
    let id = el.dataset.id;
    closeModal();
    transact(() => sellAsset(state, id), "Personal asset sold.");
  },
  "save-slot": (el) => {
    try {
      persist(localStorage, state, "conglomerate-slot-" + el.dataset.id);
      saveDialog();
      notify("Manual save written.");
    } catch (e) {
      notify(e.message);
    }
  },
  "load-slot": (el) => restoreSlot(el.dataset.id),
  export: exportSave,
  import: () => $("#import-file").click(),
  "new-game": () =>
    confirmDialog(
      "A NEW LEGACY",
      "Your autosave will be replaced when you incorporate the new group. Keep an export or manual slot to retain this world.",
      "start-new",
    ),
  "start-new": () => {
    closeModal();
    identity.avatar = "";
    identity.logo = "";
    setup(true);
  },
  "cancel-setup": () => render(),
  "clear-logo": () => {
    let c = $("#logo-canvas");
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    identity.logo = "";
  },
};
document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) {
    try {
      fn(el);
    } catch (e) {
      notify(e.message);
    }
  }
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const f = new FormData(form),
    n = (k) => Number(f.get(k)),
    value = (k) => String(f.get(k) || "");
  if (form.dataset.form === "setup") {
    let founder = value("founder").trim(),
      group = value("group").trim();
    if (!founder || !group) {
      notify("Founder and holding company names are required.");
      return;
    }
    state = createGame({
      founder,
      group,
      difficulty: value("difficulty"),
      scenario: value("scenario"),
      seed: value("seed").trim() || "MERIDIAN-2026",
      ...identity,
    });
    conflict = false;
    news(
      state,
      "The group is incorporated. Invest with patience. Every company needs working capital.",
    );
    tab = "hq";
    autosave();
    render();
    return;
  }
  const commands = {
    "create-unit": () =>
      createUnit(
        state,
        value("industry"),
        value("name"),
        value("acquire") === "true",
      ),
    "unit-policy": () =>
      setPolicy(
        state,
        n("id"),
        Object.fromEntries([
          ...[
            "price",
            "utilization",
            "marketing",
            "maintenance",
            "wage",
            "research",
          ].map((k) => [k, n(k)]),
          ["autonomy", f.has("autonomy")],
        ]),
      ),
    inject: () => injectCapital(state, n("id"), n("amount")),
    borrow: () =>
      borrow(state, {
        amount: n("amount"),
        kind: value("kind"),
        fixed: value("fixed") === "true",
      }),
    salary: () => {
      let amount = n("amount");
      if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
        throw Error("Salary must be between $0 and $100K.");
      state.salary = amount;
      news(
        state,
        "Chairman gross monthly salary set to " + money(amount) + ".",
      );
    },
    dividend: () => distribute(state, n("amount")),
    "founder-capital": () => founderCapital(state, n("amount")),
    redraw: () => redraw(state, n("id"), n("amount")),
    governance: () => {
      for (let k of ["autoSweep", "audit", "insurance"])
        state.policies[k] = f.has(k);
      news(state, "Group governance mandate updated.", "board");
    },
    hire: () => {
      let [role, id] = value("appointment").split(":");
      hire(state, n("candidate"), role, id ? Number(id) : null);
    },
    trade: () =>
      trade(
        state,
        value("symbol"),
        n("amount"),
        event.submitter?.value === "sell",
      ),
  };
  const fn = commands[form.dataset.form];
  if (fn) {
    let context = form.dataset.form;
    const success = transact(fn, "Decision recorded.");
    if (success && context === "create-unit") {
      closeModal();
      navigate("subs");
    }
    if (success && context === "redraw") closeModal();
  }
});
document.addEventListener("change", (event) => {
  let el = event.target;
  if (el.id === "report-entity") {
    reportEntity = el.value;
    render();
  }
  if (el.id === "speed") speed = Number(el.value);
  if (el.id === "news-filter") newsDialog(el.value);
  if (el.id === "import-file") importSave(el.files[0]);
  if (el.id === "difficulty" || el.id === "scenario") setupPreview();
  if (el.id === "avatar-upload") uploadImage(el.files[0], "avatar");
  if (el.id === "logo-upload") uploadImage(el.files[0], "logo");
});
document.addEventListener("focusin", (event) => {
  if (timer && event.target.closest("form")) {
    stop();
    const play = document.querySelector('[data-action="play"]');
    if (play) play.textContent = "▷ Play";
  }
});
document.addEventListener("keydown", (event) => {
  if (document.querySelector('[data-form="setup"]')) return;
  if (event.key === "Escape" && modal) {
    closeModal();
    return;
  }
  if (modal && event.key === "Tab") {
    let nodes = [
      ...$(".modal").querySelectorAll(
        'button:not([disabled]),input:not([hidden]),select,a[href],[tabindex="0"]',
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0],
      last = nodes.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === $(".modal"))
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (
    !state ||
    modal ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)
  )
    return;
  if (event.key.toLowerCase() === "n") transact(() => advanceMonth(state));
  if (event.code === "Space") {
    event.preventDefault();
    setPlaying();
  }
});
window.addEventListener("hashchange", () => {
  if (state && PAGES[location.hash.slice(1)]) {
    tab = location.hash.slice(1);
    render();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === AUTO && state) {
    conflict = true;
    stop();
    notify(
      "Another tab changed the autosave. Reload this tab before continuing.",
    );
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && timer) {
    stop();
    render();
  }
});
function setup(fresh = false) {
  stop();
  $("#app").innerHTML =
    `<div class="setup-wrap"><section class="setup-card"><div class="setup-heading"><div class="brand"><span class="brand-icon">▥</span> conglomerate.</div><span class="tag">THE FOUNDER & CHAIRMAN SIMULATOR / 2.0</span></div><div class="eyebrow">A WORLD OF CAPITAL, CONSEQUENCES & COMPOUNDING</div><h1>Great empires start with a decision.</h1><p class="subtitle" style="margin-bottom:30px">Build the businesses. Read the economy. Lead the people. Own the consequences.</p><form data-form="setup"><div class="setup-grid"><div>${field("Founder name", "founder", "text", "Alex Morgan", 'maxlength="60" required')}${field("Holding company name", "group", "text", "Meridian Holdings", 'maxlength="80" required')}${select(
      "Your starting story",
      "difficulty",
      Object.entries(DIFFICULTIES).map(([k, d]) => [k, d.name]),
      "operator",
    ).replace(
      '<select name="difficulty"',
      '<select id="difficulty" name="difficulty"',
    )}<div class="setup-note" id="difficulty-preview"></div>${select(
      "Economic starting conditions",
      "scenario",
      Object.entries(SCENARIOS).map(([k, v]) => [k, v.name]),
      "balanced",
    ).replace(
      '<select name="scenario"',
      '<select id="scenario" name="scenario"',
    )}${field("World seed · repeatable simulation", "seed", "text", "MERIDIAN-2026", 'maxlength="100" required')}<p class="scenario-preview" id="scenario-preview"></p></div><div><div class="form-row"><label for="avatar-upload">Founder portrait (optional)</label><input id="avatar-upload" type="file" accept="image/png,image/jpeg,image/webp"><img id="avatar-preview" class="avatar-preview" alt="Your portrait"></div><div class="form-row"><label for="logo-upload">Company logo (upload or draw)</label><input id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp"><canvas id="logo-canvas" width="560" height="240" aria-label="Draw your company logo"></canvas><div class="inline-actions"><input type="color" id="pen-color" value="#176b51" aria-label="Drawing pen color" style="width:45px;padding:3px;height:30px">${button("Clear drawing", "clear-logo", "", "mini")}</div><p id="upload-status" class="muted">PNG, JPEG or WebP · maximum 5 MB · resized locally</p></div><div class="setup-note"><strong>Your first 90 days</strong><br>1. Incorporate a focused operating business.<br>2. Keep working capital inside that company.<br>3. Set your mandate and advance monthly.<br>4. Follow the cash flow, not just the valuation.</div><p class="muted" style="line-height:1.9">Everything runs locally. No accounts, external services, or real financial transactions. Your browser stores the world; JSON exports keep it safe.</p></div></div><div class="action-row"><button class="primary" type="submit" style="padding:14px 25px">Take the chairman’s seat →</button>${fresh ? button("Return to your current game", "cancel-setup") : button("Restore a JSON world", "import")}<input id="import-file" type="file" accept=".json,application/json" hidden></div></form></section></div>`;
  setupPreview();
  const canvas = $("#logo-canvas"),
    ctx = canvas.getContext("2d");
  let drawing = false;
  const point = (e) => {
    let r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * canvas.width) / r.width,
      ((e.clientY - r.top) * canvas.height) / r.height,
    ];
  };
  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(...point(e));
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    ctx.strokeStyle = $("#pen-color").value;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineTo(...point(e));
    ctx.stroke();
  });
  canvas.addEventListener("pointerup", () => {
    drawing = false;
    identity.logo = canvas.toDataURL("image/png");
  });
  canvas.addEventListener("pointercancel", () => {
    drawing = false;
  });
}
function setupPreview() {
  let d = DIFFICULTIES[$("#difficulty").value],
    m = SCENARIOS[$("#scenario").value];
  $("#difficulty-preview").innerHTML =
    `<strong>${money(d.capital)} corporate seed capital</strong><br>${money(d.cash)} personal cash · Credit ${d.credit}<br>${d.description}`;
  $("#scenario-preview").textContent =
    "GDP " +
    pct(m.growth) +
    " · Inflation " +
    pct(m.inflation) +
    " · Policy rate " +
    pct(m.rate);
}
async function uploadImage(file, key) {
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 5e6
  ) {
    notify("Choose a PNG, JPEG, or WebP under 5 MB.");
    return;
  }
  try {
    const bitmap = await createImageBitmap(file),
      c = document.createElement("canvas"),
      scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
    identity[key] = c.toDataURL("image/png");
    bitmap.close();
    $("#upload-status").textContent =
      (key === "avatar" ? "Founder portrait" : "Company logo") + " ready.";
    if (key === "avatar") {
      $("#avatar-preview").src = identity.avatar;
      $("#avatar-preview").style.display = "block";
    } else {
      let ctx = $("#logo-canvas").getContext("2d");
      ctx.clearRect(0, 0, 560, 240);
      const img = new Image();
      img.onload = () =>
        ctx.drawImage(
          img,
          0,
          0,
          Math.min(560, img.width),
          Math.min(240, img.height),
        );
      img.src = identity.logo;
    }
  } catch {
    notify("This image could not be decoded. Choose another image.");
  }
}
try {
  const raw = localStorage.getItem(AUTO);
  if (raw) state = decode(raw);
} catch (e) {
  setTimeout(
    () =>
      notify(
        "Existing autosave could not be loaded. It has not been overwritten. Import a backup or start a new world. " +
          e.message,
      ),
    100,
  );
}
render();
// A read-only state copy helps inspect the model without granting UI code mutable globals.
window.simulator = Object.freeze({
  snapshot: () => structuredClone(state),
  version: 2,
});
