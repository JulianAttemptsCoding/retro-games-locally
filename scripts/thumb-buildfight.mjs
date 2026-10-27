// Captures the library thumbnail for Build Fight: the player behind a freshly built wall and ramp, the bot ahead.
//   node scripts/thumb-buildfight.mjs   (server must be running on :3000)
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
await page.goto(`${base}/games/buildfight/index.html?mode=bot&nolock=1&diff=normal`);
await page.evaluate(() => {
  const b = window.__bf;
  const step = (n) => { for (let i = 0; i < n; i++) b.step(1 / 60); };
  const press = (code) => { b.keys.add(code); step(2); b.keys.delete(code); step(8); };
  step(60 * 3.4); // out of the countdown
  b.state.bot.update = () => {};
  b.me.x = -13; b.me.z = -2; b.aim.yaw = -Math.PI / 2 + 0.18; b.aim.pitch = 0.1;
  // A small fort built directly (same pieces the Q/F/C/V keys place): ramp up to a floor, with walls, plus the bot's cover.
  for (const sp of [
    { t: 'r', gx: -2, gy: 0, gz: -1, d: 3 }, { t: 'f', gx: -1, gy: 1, gz: -1 },
    { t: 'w', ax: 'x', i: 0, j: -1, gy: 1 }, { t: 'w', ax: 'z', i: -1, j: -1, gy: 1 }, { t: 'w', ax: 'z', i: 0, j: -1, gy: 1 },
  ]) b.addPiece(sp, 'me');
  for (const sp of [{ t: 'w', ax: 'x', i: 2, j: -1, gy: 0 }, { t: 'w', ax: 'x', i: 2, j: 0, gy: 0 }]) b.addPiece(sp, 'foe');
  b.foe.x = 8; b.foe.z = 2; b.foe.yaw = Math.PI / 2 + 0.3; b.foe.weapon = 'ar';  step(40);
});
await page.waitForTimeout(300);
await page.locator('canvas').screenshot({ path: 'public/thumbs/buildfight.jpg', type: 'jpeg', quality: 72 });
await browser.close();
console.log('wrote public/thumbs/buildfight.jpg');

