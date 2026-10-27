// Dev helper: node scripts/shot.mjs <id> [out.png] [key,key,...] [waitMs]
import { chromium } from '@playwright/test';
const [id, out = `shot-${id}.png`, keys = '', wait = '2500'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('response', (r) => r.status() >= 400 && console.log('HTTP', r.status(), r.url()));
await page.goto(`${process.env.BASE_URL ?? 'http://localhost:3000'}/play.html?g=${id}`);
await page.waitForTimeout(1500);
await page.evaluate(() => document.getElementById('panel')?.classList.remove('open'));
await page.mouse.click(500, 400);
for (const k of keys.split(',').filter(Boolean)) { await page.keyboard.press(k); await page.waitForTimeout(250); }
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
