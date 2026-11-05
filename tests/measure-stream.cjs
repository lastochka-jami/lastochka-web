// Run against a warmed local dev server and the deterministic API fixture.
// Product 31 has 100 ms detail and 800 ms recommendation responses.
const fs = require('node:fs');
(async () => {
  const samples = [];
  for (let i = 0; i < 6; i++) {
    const start = performance.now();
    const response = await fetch('http://127.0.0.1:3011/product/31', {
      headers: { 'cache-control': 'no-cache', 'user-agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' },
    });
    let html = '', mainMs;
    for await (const chunk of response.body) {
      html += Buffer.from(chunk).toString();
      if (!mainMs && html.includes('<div class="product-detail ')) mainMs = performance.now() - start;
    }
    if (!response.ok || !mainMs) throw new Error('Missing product detail');
    if (i) samples.push({ mainMs: Math.round(mainMs), completeMs: Math.round(performance.now() - start) });
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(samples, null, 2));
  console.log(samples);
})();
