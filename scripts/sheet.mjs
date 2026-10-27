// Dev helper: node scripts/sheet.mjs out.png id1 id2 ...   -> contact sheet of games after pressing start keys
import { chromium } from '@playwright/test';
const [out, ...ids] = process.argv.slice(2);
const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const shots = [];
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await page.goto(`${base}/play.html?g=${id}`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('panel')?.classList.remove('open'));
  await page.mouse.click(480, 360);
  for (const k of ['Enter', 'ArrowRight', 'Space']) { await page.keyboard.press(k); await page.waitForTimeout(200); }
  await page.waitForTimeout(1800);
  shots.push([id, (await page.screenshot()).toString('base64')]);
  await page.close();
}
const sheet = await browser.newPage({ viewport: { width: 1440, height: Math.ceil(ids.length / 3) * 330 } });
await sheet.setContent(`<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(3,480px)">${shots.map(([id, b]) => `<figure style="margin:0;position:relative"><img width=480 height=320 src="data:image/png;base64,${b}"><figcaption style="position:absolute;left:4px;top:62px;color:#0f0;background:#000a;font:12px monospace">${id}</figcaption></figure>`).join('')}</body>`);
await sheet.screenshot({ path: out });
await browser.close();
