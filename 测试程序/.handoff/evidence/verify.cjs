const { chromium } = require(process.argv[2]);
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const assert = require("node:assert/strict");

async function main() {
  const browser = await chromium.launch({ executablePath: process.argv[3], headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("requestfailed", req => errors.push(req.url()));
    await page.goto(pathToFileURL(path.resolve(__dirname, "../../index.html")).href);
    const read = selector => page.locator(selector).innerText();
    const apply = () => page.locator("#apply").click();
    assert.equal(await read("#route-kind"), "光路直达");
    assert.equal(await read("#delivered"), "60");
    const maps = [[1,0,3,2],[2,3,0,1],[3,2,1,0]];
    for (let t = 0; t < maps.length; t++) {
      await page.locator('input[name="topology"]').nth(t).check();
      for (let s = 0; s < 4; s++) {
        for (let d = 0; d < 4; d++) {
          if (s === d) continue;
          await page.selectOption("#src", String(s));
          await page.selectOption("#dst", String(d));
          if (await page.locator("#apply").isEnabled()) await apply();
          assert.equal(await read("#route-kind"), maps[t][s] === d ? "光路直达" : "电路径转发");
          assert.equal(await read("#route-nodes"), "S0" + (s+1) + " → S0" + (d+1));
        }
      }
      for (let s = 0; s < 4; s++) assert.equal(await page.locator(".mapping b").nth(s).innerText(), "IN " + (s+1) + " → OUT " + (17+maps[t][s]));
    }
    await page.locator("#fallback").uncheck();
    await apply();
    assert.equal(await read("#route-kind"), "无可用路径");
    assert.equal(await read("#delivered"), "0");
    await page.locator("#reverse").click();
    await apply();
    assert.equal(await read("#route-nodes"), "S03 → S04");
    await page.selectOption("#src", "3");
    assert.ok(await page.locator("#apply").isDisabled());
    await page.reload();
    await page.locator("#rate").fill("0");
    await apply();
    assert.equal(await read("#delivered"), "0");
    assert.equal(await page.locator("animateMotion").count(), 0);
    await page.locator("#rate").fill("100");
    await apply();
    await page.locator("#pause").click();
    assert.equal(await read("#delivered"), "0");
    await page.locator("#pause").click();
    assert.equal(await read("#delivered"), "100");
    assert.ok(await page.locator("#events li").count() >= 5);
    await page.reload();
    await page.screenshot({path: path.join(__dirname, "desktop.png"), fullPage: true});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('input[name="topology"]').nth(1).check();
    await apply();
    assert.equal(await read("#route-kind"), "电路径转发");
    await page.screenshot({path: path.join(__dirname, "mobile.png"), fullPage: true});
    assert.deepEqual(errors, []);
    console.log("PASS: 36 directed paths, 12 port mappings, fallback, reverse, validation, idle/rate/pause/resume, log, offline load, narrow-screen controls and layout.");
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
