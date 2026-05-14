const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('/tmp/chalkboard-shots', { recursive: true });

// Index 1 = "02-paradoja" (first one with board content)
const TARGETS = [
  { name: '02-paradoja',  jumpTo: 1 },
  { name: '03-bombelli',  jumpTo: 2 },
  { name: '05-rotacion',  jumpTo: 4 },
  { name: '06-mobius',    jumpTo: 5 },
  { name: '08-riemann',   jumpTo: 7 },
  { name: '10-fractal',   jumpTo: 9 },
  { name: '13-flujo',     jumpTo: 12 },
  { name: '15-motor',     jumpTo: 14 },
  { name: '17-rotor',     jumpTo: 16 },
];

(async () => {
  const b = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  for (const t of TARGETS) {
    const ctx = await b.newContext({ viewport: { width: 1800, height: 1080 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(`PAGEERR(${t.name}):`, e.message));
    await page.goto('http://localhost:5001/masterclass.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Empezar'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.muted = true; });
    for (let k = 0; k < t.jumpTo; k++) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('siguiente'));
        if (btn) btn.click();
      });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(3500);  // let chalk animation finish
    await page.screenshot({ path: `/tmp/chalkboard-shots/${t.name}.png` });
    console.log(`[shot] ${t.name} OK`);
    await ctx.close();
  }
  await b.close();
})();
