const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=540,960'] });
  const page = await (await browser.newContext({ viewport: { width: 540, height: 960 } })).newPage();
  await page.goto('http://100.65.173.85:8099/clase.html?id=econ-2018-romer-nordhaus', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(7000);
  const btn = await page.$('[data-cine-play]');
  if (btn) await btn.click();
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const a = document.querySelector('audio'); if (a) { a.currentTime = 40; } });
  await page.waitForTimeout(400);
  const t1 = await page.evaluate(() => document.querySelector('audio')?.currentTime);
  await page.waitForTimeout(800);
  const t2 = await page.evaluate(() => document.querySelector('audio')?.currentTime);
  console.log('t tras seek:', t1, '→', t2);
  const st = await page.evaluate(() => {
    const a = document.querySelector('audio');
    return {
      audioSrc: a?.currentSrc?.slice(-40), readyState: a?.readyState, err: a?.error?.code ?? null,
      t: a?.currentTime, paused: a?.paused, playBtnGone: !document.querySelector('[data-cine-play]'),
    };
  });
  console.log(JSON.stringify(st));
  await page.screenshot({ path: 'diag-t40.png' });
  await browser.close();
})();
