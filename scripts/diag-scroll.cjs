const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://university.gaiaprime.com.mx/escuela.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      htmlOverflow: getComputedStyle(html).overflow,
      htmlOverflowY: getComputedStyle(html).overflowY,
      bodyOverflow: getComputedStyle(body).overflow,
      bodyOverflowY: getComputedStyle(body).overflowY,
      htmlHeight: html.scrollHeight,
      bodyHeight: body.scrollHeight,
      windowInner: window.innerHeight,
      // Try scrolling
      canScroll: (() => {
        body.scrollTop = 200;
        html.scrollTop = 200;
        const r = { bodyScroll: body.scrollTop, htmlScroll: html.scrollTop, winScroll: window.scrollY };
        body.scrollTop = 0;
        html.scrollTop = 0;
        return r;
      })(),
      // Find any overflow-hidden in tree
      hiddenAncestors: (() => {
        const out = [];
        let el = document.querySelector('section');
        while (el) {
          const o = getComputedStyle(el).overflow;
          if (o.includes('hidden')) out.push({ tag: el.tagName, cls: el.className.slice(0, 80), overflow: o });
          el = el.parentElement;
        }
        return out;
      })(),
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await b.close();
})();
