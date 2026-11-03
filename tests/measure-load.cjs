// Run against the same production build, fixture API and browser for both revisions.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({channel: 'chrome'});
  const results = [];
  for (let n = 0; n < 5; n++) {
    const context = await browser.newContext({ viewport: {width: 390, height: 844} });
    const page = await context.newPage();
    const pending = [];
    page.on('response', r => { if (r.request().resourceType() === 'script') pending.push(r.body().then(b => b.length).catch(() => 0)); });
    const start = Date.now();
    await page.goto('http://127.0.0.1:3011');
    await page.waitForLoadState('networkidle');
    const duration = Date.now() - start;
    const sizes = await Promise.all(pending);
    results.push({ durationMs: duration, scriptBytes: sizes.reduce((a,b) => a+b,0) });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(process.argv[2] || '/tmp/lastochka-load.json', JSON.stringify(results, null, 2));
  console.log(results);
})();
