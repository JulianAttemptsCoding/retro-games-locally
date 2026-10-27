// Captures the library thumbnail for Slope by letting an autopilot play for a few seconds.
//   node scripts/thumb-slope.mjs   (server must be running on :3000)
import { chromium } from '@playwright/test';
import { startAutopilot } from '../e2e/slope-autopilot.mjs';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
await page.addInitScript(() => { window.__slopeLog = []; });
await page.goto(`${base}/games/slope-run/index.html`);
await page.keyboard.press('Enter');
await startAutopilot(page);
await page.waitForFunction(() => window.__slope.dist > 110, null, { timeout: 30000 });
await page.waitForTimeout(400);
await page.locator('canvas').screenshot({ path: 'public/thumbs/slope-run.jpg', type: 'jpeg', quality: 72 });
console.log('wrote public/thumbs/slope-run.jpg at distance', await page.evaluate(() => Math.round(window.__slope.dist)));
await browser.close();
