const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "conglomerate-browser-"));
let server;
const baseURL = process.env.TEST_URL || "http://127.0.0.1:4173";
async function startServer() {
  if (process.env.TEST_URL) return;
  server = spawn(
    "python3",
    ["-m", "http.server", "4173", "--bind", "127.0.0.1"],
    { cwd: path.resolve(__dirname, ".."), stdio: "ignore" },
  );
  server.on("error", (e) => {
    console.error(e.message);
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error("Test HTTP server did not become ready.");
}
let browser;

(async () => {
  await startServer();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE", m.text());
  });
  await page.goto(baseURL);
  await page.waitForSelector('[data-form="setup"]');
  await page.selectOption("#difficulty", "heir");
  await page.getByRole("button", { name: /Take the chairman/ }).click();
  await page.waitForSelector('[data-action="advance"]');
  console.log(
    "Created",
    await page.evaluate(() => simulator.snapshot().version),
  );
  await page.locator('nav [data-action="navigate"][data-id="subs"]').click();
  await page.locator('[data-action="acquire"][data-id="saas"]').click();
  await page
    .locator('[data-form="create-unit"] [name="name"]')
    .fill("Meridian Intelligence");
  await page.getByRole("button", { name: "Complete acquisition" }).click();
  await page.getByRole("button", { name: "Manage →" }).click();
  await page.locator('[data-form="unit-policy"] [name="price"]').fill("1.1");
  await page.getByRole("button", { name: "Save operating mandate" }).click();
  await page.getByRole("button", { name: "Private equity round" }).click();
  await page.locator('.modal [data-action="advance"]').click();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator('nav [data-action="navigate"][data-id="finance"]').click();
  await page.getByRole("button", { name: "Apply for facility" }).click();
  await page.locator('nav [data-action="navigate"][data-id="exec"]').click();
  await page
    .locator('[data-form="hire"]')
    .nth(2)
    .locator("select")
    .selectOption("CFO");
  await page
    .locator('[data-form="hire"]')
    .nth(2)
    .getByRole("button", { name: "Appoint executive" })
    .click();
  await page.locator('nav [data-action="navigate"][data-id="market"]').click();
  await page
    .locator('[data-form="trade"]')
    .first()
    .getByRole("button", { name: "Buy", exact: true })
    .click();
  await page.getByRole("button", { name: "Back a venture · $50K" }).click();
  await page.locator('nav [data-action="navigate"][data-id="life"]').click();
  await page
    .getByRole("button", { name: "Acquire personally" })
    .first()
    .click();
  await page.locator('nav [data-action="navigate"][data-id="hq"]').click();
  await page.getByRole("button", { name: "Quarter +3" }).click();
  let before = await page.evaluate(() => simulator.snapshot());
  console.log(
    "World",
    before.turn,
    before.units.length,
    before.loans.length,
    before.assets.length,
    before.executives.length,
  );
  await page.reload();
  assert.deepEqual(await page.evaluate(() => simulator.snapshot()), before);
  await page.locator('[data-action="saves"]').click();
  await page.getByRole("button", { name: "Save here" }).first().click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON backup" }).click();
  let download = await downloadEvent;
  await download.saveAs(path.join(temp, "save.json"));
  await page
    .locator("#import-file")
    .setInputFiles(path.join(temp, "save.json"));
  await page.waitForFunction(() => !document.querySelector(".modal"));
  assert.deepEqual(await page.evaluate(() => simulator.snapshot()), before);
  await page.locator('[data-action="saves"]').click();
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":2}'),
  });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Invalid"),
  );
  assert.deepEqual(await page.evaluate(() => simulator.snapshot()), before);
  await page.getByRole("button", { name: "Close dialog" }).click();
  // Exercise entity reporting and reject a purchase that cannot be personally funded.
  await page.locator('nav [data-action="navigate"][data-id="reports"]').click();
  for (const entity of [
    "parent",
    "personal",
    String(before.units[0].id),
    "group",
  ]) {
    await page.selectOption("#report-entity", entity);
    await page
      .getByRole("heading", { name: "Balance sheet", exact: true })
      .waitFor();
  }
  await page.locator('nav [data-action="navigate"][data-id="life"]').click();
  const protectedState = await page.evaluate(() => simulator.snapshot());
  await page.locator('[data-action="buy-asset"][data-id="7"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Insufficient"),
  );
  assert.deepEqual(
    await page.evaluate(() => simulator.snapshot()),
    protectedState,
  );
  await page.locator('nav [data-action="navigate"][data-id="hq"]').click();
  // A stale tab must not overwrite a newer monthly close.
  const second = await page.context().newPage();
  second.on("pageerror", (e) => errors.push(e.message));
  await second.goto(baseURL);
  await second.locator('[data-action="advance"]').click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Another tab"),
  );
  await page.locator('[data-action="advance"]').click();
  assert.deepEqual(
    await page.evaluate(() => simulator.snapshot()),
    protectedState,
  );
  const newer = await second.evaluate(() => simulator.snapshot());
  await page.reload();
  assert.deepEqual(await page.evaluate(() => simulator.snapshot()), newer);
  await second.close();
  await page.screenshot({
    path: path.join(temp, "desktop.png"),
    fullPage: true,
  });
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of [
      "hq",
      "subs",
      "finance",
      "reports",
      "exec",
      "macro",
      "market",
      "life",
    ]) {
      await page
        .locator(`nav [data-action="navigate"][data-id="${tab}"]`)
        .click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "overflow " + width + " " + tab,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('nav [data-action="navigate"][data-id="hq"]').click();
  await page.screenshot({
    path: path.join(temp, "mobile.png"),
    fullPage: true,
  });
  await page.locator('nav [data-action="navigate"][data-id="subs"]').click();
  await page.getByRole("button", { name: "Manage →" }).click();
  assert.equal(
    await page
      .locator(".modal")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
    "mobile management dialog overflow",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser flows, reporting entities, rejected transactions, cross-tab protection, save/import/export, responsive 8 tabs × 3 widths, mobile management dialog; no page errors.",
  );
  console.log("Test artifacts:", temp);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.kill("SIGTERM");
  });
