# Conglomerate: Founder & Chairman Simulator

A complete local web application built with HTML, CSS, and native JavaScript modules. Build a parent holding company, fund operating businesses, navigate economic cycles, and manage the founder’s separate wealth. No backend, API keys, CDN, framework, bundler, or production dependencies are required.

## Run

From this directory:

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

Or run `npm start` (which invokes the same Python server). Open the served application in a modern browser. Use a static HTTP server rather than opening `index.html` directly: native ES modules require HTTP. Keep the same browser origin and port to retain local saves.

## Play

1. Choose a founder, holding group, difficulty, economic scenario, and reproducible world seed. Upload a portrait and logo, or draw the logo.
2. Start with a business you can afford. Construction takes industry-specific time; acquisitions open immediately at a premium.
3. Keep working capital in each subsidiary. Review its operating bank, receivables, payables, taxes, and cash runway.
4. Set pricing, utilization, marketing, maintenance, wages, R&D, and management autonomy. Advance monthly or run continuous time.
5. Fund expansion, recruit executives, raise outside equity, monitor bank covenants, and decide whether to list or divest.
6. Pay yourself through salary or earned dividends. Invest or buy personal assets using personal cash.

**Keyboard:** `N` advances one month, `Space` plays/pauses, and `Escape` closes dialogs. Quarter advances three monthly closes. Play pauses while a dialog is open, a form is being edited, or the browser tab is hidden.

## Implemented systems

- **Ten industries:** biofuel, steel, solar, commercial property, residential, warehousing, AI SaaS, fintech, biotech, and e-commerce logistics.
- **Different economics:** plant capacity and condition; property occupancy and sticky leases; SaaS customer acquisition, CAC, churn, and ARR; biotech research milestones; seasonal solar output.
- **Working capital:** separate bank balances, sales on credit, delayed collections, input inventory, supplier payables, and operating reserves.
- **Accounting:** balanced double-entry journals, construction in progress, depreciation, profit versus cash flow, tax accruals, quarterly tax settlement, and tax loss carryforwards.
- **Holding company structure:** subsidiary capitalization, upstream distributions, primary equity issuance, ownership dilution, minority equity, IPO eligibility, secondary offerings, and private-market divestment.
- **Banking:** fixed/floating rates, credit-based spreads, origination fees, term amortization, revolving repayment/redraw, bullet maturities, leverage and interest-coverage covenants, and breach penalties.
- **Leadership:** CEO, CFO, COO, CMO, and company MD appointments; competence-based benefits; signing payments; salaries; bonuses; severance; loyalty; integrity; misconduct; and autonomous remediation.
- **Governance:** internal audit, operating insurance, automatic distributions, timed board resolutions, training accords, and procurement agreements.
- **Economy:** seeded business-cycle transitions, GDP, inflation, price levels, unemployment, rate responses, sector demand, and mean-reverting commodity indices with supply shocks.
- **Personal finance:** stocks, a market index, a bond fund, REIT exposure, crypto, taxable distributions, average-cost security positions, realized capital gains, and simulated custody risk.
- **Private wealth:** angel commitments with delayed exits, vehicles, homes, islands, yachts, aircraft, recurring upkeep, market values, depreciation, and liquidity discounts.
- **Interface:** eight responsive sections, financial statements, entity-level journal explorers, historical charts, a filtered newswire, legacy milestones, and an in-game field manual.
- **Persistence:** local autosave, three manual slots, JSON export/import, save validation, atomic command rollback, cross-tab conflict protection, and migration from the original version 1 format.

## Source map

```text
index.html                    Application shell
css/styles.css                Responsive design and all visual styling
js/app.js                     UI controller, commands, dialogs, setup, browser lifecycle
js/core/catalog.js            Industry, market, difficulty, executive, and luxury assumptions
js/core/random.js             Serializable seeded random number generator
js/core/accounting.js         Chart of accounts, posting, trial balance, balance sheet
js/core/state.js              New-game state and event records
js/core/selectors.js          Valuation, ownership, covenants, consolidation, derived metrics
js/core/engine.js             Monthly close orchestration and financial reporting
js/core/storage.js            Persistence, schema checks, legacy save migration
js/systems/businesses.js      Formation, operations, expansion, equity issuance, exits
js/systems/economy.js         Business cycle, central bank, commodities, sector demand
js/systems/finance.js         Debt, revolvers, repayments, dividends, founder equity
js/systems/governance.js      Recruitment, executive economics, controls, board decisions
js/systems/personal.js        Securities, crypto custody, angel investing, private assets
js/ui/components.js           Escaping, formatting, charts, buttons, shared UI components
js/ui/pages.js                Eight application sections and business detail views
tests/simulation.test.js     Deterministic model, accounting, save, and stress tests
tests/browser.cjs            Optional end-to-end browser playthrough
```

Domain modules use plain serializable state and have no DOM or storage dependency. `advanceMonth(state)` advances the world; the UI applies commands transactionally and rolls back on failure. Double-entry accounting rejects unbalanced postings. All UI text derived from saves is escaped before insertion.

## Validation

Requires Node 20 or newer; no install is needed for model tests:

```sh
npm test
```

The suite exercises accounting conservation, industry operations, construction and expansion timing, cash conversion, funding dilution, IPO gates, debt schedules, revolving redraws, taxes, personal/corporate separation, executive behavior, disposals, save rejection, version 1 migration, deterministic replay, and 120-month stress runs in three economic scenarios.

The optional browser test requires Playwright and Chromium. Install Playwright locally without changing the dependency manifest, then install its browser:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

The browser test starts and stops its own static server. `PLAYWRIGHT_MODULE` can point to an existing Playwright module, `CHROMIUM_PATH` to an existing Chromium binary, and `TEST_URL` to an already-running server. These are test-only conveniences; the application needs none of them.

## Financial modeling notes

This is a fictional economic simulation, not a real investment platform or a complete reproduction of a particular jurisdiction’s accounting and tax law.

- All amounts are USD. Corporate income is taxed at 24%, salary at 30%, and personal dividends/positive realized investment gains at 20%. Entity tax losses carry forward individually; internal dividends are exempt at the parent. No group tax relief, deferred tax, or personal loss offsets are modeled.
- Internal dividends are eliminated from consolidated income. Subsidiaries are fully consolidated and noncontrolling equity is shown separately. Parent market value replaces the book cost of each holding with its ownership share of estimated subsidiary equity value.
- Valuation uses sector earnings multiples, net assets, and interest-rate adjustments. Early-stage construction is valued at book assets. Actual sale proceeds include a liquidity discount. Unrealized values cannot be spent.
- Outside financing is primary issuance: proceeds stay inside the subsidiary. The cap table explicitly tracks parent shares and total shares. An IPO requires 12 operating months, three positive EBITDA months, and $1M estimated equity value.
- Integration reduces eligible external input costs. It does not model a physical intercompany order book, transfer pricing, or geographic supply routes.
- Negative operating bank balances represent an emergency arrears/overdraft state. They reduce equity and creditworthiness, block normal discretionary spending, and can send subsidiaries into administration after six unfunded months. They are not an approved additional loan facility.
- The cash-flow bridge explicitly groups investing, noncontrolling distributions, and transactions between monthly closes in its residual cash-flow line. Journal entries provide transaction detail.
- Securities are synthetic prices driven by shared macro conditions and instrument-specific shocks. No external quote feed, wallet, exchange, or real money is connected.
- Simulation limits: 50 active companies, 120 monthly histories, 180 recent news items, and 300 recent journal entries per entity. Journal truncation does not discard account balances.
- Version 1 migration retains available cash, debt balances, securities, luxury holdings, angel investments, executives, and recent news. Industry assumptions and book values are reconstructed for the new model; historical purchase bases were not recorded in version 1. Legacy subsidiaries may require fresh working capital.

Save data stays in browser `localStorage`. Large groups and multiple save slots can exceed the browser’s storage quota; failures are reported and JSON export remains available. Export JSON backups for portability. Changing port/origin, browser, private-browsing session, or clearing site data changes the save store. Multi-tab changes pause the stale tab and require a reload rather than silently overwriting newer decisions.
