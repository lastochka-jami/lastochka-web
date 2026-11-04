// Same browser, viewport and API for before/after. No throttling; fresh browser cache per pair.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({channel: 'chrome'});
  const results = [];
  for (let n = 0; n < 3; n++) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.loadMetrics = {lcp: 0, cls: 0};
      new PerformanceObserver(list => { window.loadMetrics.lcp = list.getEntries().at(-1).startTime; }).observe({type:'largest-contentful-paint', buffered:true});
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.loadMetrics.cls += entry.value; }).observe({type:'layout-shift', buffered:true});
    });
    for (const cache of ['cold', 'repeat']) {
      const scriptBodies = [];
      const responseListener = r => { if (r.request().resourceType() === 'script') scriptBodies.push(r.body().then(b => b.length).catch(() => 0)); };
      page.on('response', responseListener);
      const start = Date.now();
      await page.goto(process.env.MEASURE_URL || 'http://127.0.0.1:3011');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      const durationMs = Date.now() - start;
      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        return {...window.loadMetrics, ttfbMs: nav.responseStart, documentBytes: nav.transferSize,
          resources: performance.getEntriesByType('resource').filter(r => r.initiatorType === 'img' || r.name.includes('/api/')).map(r => ({url: r.name, ms: r.duration, transferBytes: r.transferSize, encodedBytes: r.encodedBodySize})),
          images: [...document.images].map(i => ({src:i.currentSrc, width:i.getBoundingClientRect().width, naturalWidth:i.naturalWidth, loading:i.loading, priority:i.fetchPriority}))};
      });
      results.push({cache, durationMs, scriptBytes:(await Promise.all(scriptBodies)).reduce((a,b) => a+b,0), ...metrics});
      page.off('response', responseListener);
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(process.argv[2] || '/tmp/lastochka-load.json', JSON.stringify(results, null, 2));
  console.log(results.map(({resources,images,...r}) => ({...r,imageTransferBytes:resources.filter(r=>r.url.includes('_next/image')).reduce((s,r)=>s+r.transferBytes,0)})));
})();
