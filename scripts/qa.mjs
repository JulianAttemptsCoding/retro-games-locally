// Smoke-tests every bundled game in a real browser and (optionally) captures card thumbnails.
//   node scripts/qa.mjs                 -> report only
//   node scripts/qa.mjs --thumbs        -> also writes public/thumbs/<id>.jpg
//   node scripts/qa.mjs id1 id2         -> only these games
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { GAMES } from '../public/catalog.js';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const args = process.argv.slice(2);
const thumbs = args.includes('--thumbs');
const only = args.filter((a) => !a.startsWith('--'));
const list = GAMES.filter((g) => g.status === 'playable' && (!only.length || only.includes(g.id)));
fs.mkdirSync('public/thumbs', { recursive: true });

// Keys that start most of the bundled games.
const startKeys = ['Enter', 'Space', 'ArrowRight', 'ArrowLeft', 'ArrowUp'];

const browser = await chromium.launch();
let failures = 0;
for (const game of list) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const problems = [];
  // Audio autoplay rejections before a user gesture are expected and harmless.
  page.on('pageerror', (e) => { if (!/play\(\) failed because the user didn't interact/.test(e.message)) problems.push(`pageerror: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url().replace(base, '')}`); });
  const t0 = Date.now();
  try {
    await page.goto(`${base}/play.html?g=${game.id}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1800);
    await page.mouse.click(550, 420);
    for (const k of startKeys) { await page.keyboard.press(k); await page.waitForTimeout(120); }
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(1600);
    const frames = page.frames().length;
    if (thumbs) {
      await page.evaluate(() => document.getElementById('panel')?.classList.remove('open'));
      await page.locator('#frame').screenshot({ path: `public/thumbs/${game.id}.jpg`, type: 'jpeg', quality: 72 });
    }
    const status = problems.length ? 'ISSUES' : 'ok';
    if (problems.length) failures++;
    console.log(`${status.padEnd(6)} ${game.id.padEnd(22)} ${Date.now() - t0}ms frames=${frames}`);
    for (const p of [...new Set(problems)].slice(0, 6)) console.log(`         ${p}`);
  } catch (e) {
    failures++;
    console.log(`FAIL   ${game.id}: ${e.message}`);
  }
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} game(s) with problems` : '\nall games loaded cleanly');
process.exit(failures ? 1 : 0);
