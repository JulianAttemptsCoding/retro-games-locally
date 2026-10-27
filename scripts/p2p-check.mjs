// Manual live check of online rooms (needs internet: Trystero uses public Nostr relays).
//   node scripts/p2p-check.mjs            (server must be running on :3000)
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const room = 'QA' + Math.random().toString(36).slice(2, 7).toUpperCase();
const browser = await chromium.launch();
const mk = async () => (await browser.newContext()).newPage();
const [a, b] = [await mk(), await mk()];
let ok = true;
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); ok &&= cond; };

// --- Tabletop: tic-tac-toe over WebRTC -----------------------------------------------------
for (const p of [a, b]) p.on('pageerror', (e) => console.log('pageerror', e.message));
await a.goto(`${base}/games/tabletop/index.html?game=tictactoe&room=${room}&autojoin=1&name=Alice`);
await b.goto(`${base}/games/tabletop/index.html?game=tictactoe&room=${room}&autojoin=1&name=Bob`);
const connected = async (p) => p.waitForFunction(() => document.getElementById('modeBadge').textContent === 'FRIENDS ONLINE', null, { timeout: 40000 }).then(() => true, () => false);
const [ca, cb] = await Promise.all([connected(a), connected(b)]);
check('tabletop: both peers connected', ca && cb);
if (ca && cb) {
  const mover = (await a.locator('#turn').textContent()).includes('you') ? a : b;
  const other = mover === a ? b : a;
  await mover.locator('[data-cell="4"]').click();
  await other.waitForFunction(() => document.querySelector('[data-cell="4"]').getAttribute('aria-label').match(/cross|nought/), null, { timeout: 8000 }).catch(() => {});
  const label = await other.locator('[data-cell="4"]').getAttribute('aria-label');
  check('tabletop: move reaches the other peer', /cross|nought/.test(label));
}

// --- Tetris: board snapshots appear in the friend list ---------------------------------------
const t1 = await mk(), t2 = await mk();
await t1.goto(`${base}/games/tetris/index.html?room=${room}&autojoin=1&name=Alice`);
await t2.goto(`${base}/games/tetris/index.html?room=${room}&autojoin=1&name=Bob`);
const sees = (p) => p.waitForFunction(() => document.querySelectorAll('#players .player').length >= 1, null, { timeout: 40000 }).then(() => true, () => false);
const [sa, sb] = await Promise.all([sees(t1), sees(t2)]);
check('tetris: each player sees the other in the room', sa && sb);

// --- Build Fight: handshake, positions and builds sync ---------------------------------------
const f1 = await mk(), f2 = await mk();
for (const p of [f1, f2]) p.on('pageerror', (e) => console.log('pageerror', e.message));
await f1.goto(`${base}/games/buildfight/index.html?room=${room}&autojoin=1&name=Alice&nolock=1`);
await f2.goto(`${base}/games/buildfight/index.html?room=${room}&autojoin=1&name=Bob&nolock=1`);
const inMatch = (p) => p.waitForFunction(() => ['countdown', 'fight'].includes(window.__bf?.state.phase), null, { timeout: 40000 }).then(() => true, () => false);
const [ma, mb] = await Promise.all([inMatch(f1), inMatch(f2)]);
check('buildfight: both peers enter the match', ma && mb);
if (ma && mb) {
  await f1.waitForFunction(() => window.__bf.state.phase === 'fight', null, { timeout: 20000 }); // out of the countdown
  const tracked = await Promise.all([f1, f2].map((p) => p.waitForFunction(() => window.__bf.foe?.tx != null, null, { timeout: 8000 }).then(() => true, () => false)));
  check('buildfight: opponent position arrives', tracked.every(Boolean));
  // Shooter aims the crosshair (camera ray) at the other peer's body and fires a short rifle burst.
  await f1.evaluate(() => {
    const b = window.__bf;
    for (let k = 0; k < 4; k++) {
      const f = b.foe, m = b.me, cp = Math.cos(b.aim.pitch);
      const dx = -Math.sin(b.aim.yaw) * cp, dy = Math.sin(b.aim.pitch), dz = -Math.cos(b.aim.yaw) * cp;
      const cam = [m.x - dx * 3.6 + Math.cos(b.aim.yaw) * 0.8, m.y + 1.55 - dy * 3.6 + 0.3, m.z - dz * 3.6 - Math.sin(b.aim.yaw) * 0.8];
      const tx = f.x - cam[0], ty = f.y + 1.0 - cam[1], tz = f.z - cam[2];
      b.aim.yaw = Math.atan2(-tx, -tz); b.aim.pitch = Math.atan2(ty, Math.hypot(tx, tz));
    }
    b.me.weapon = 'ar'; b.keys.add('KeyJ');
  });
  await f1.waitForTimeout(600);
  await f1.evaluate(() => window.__bf.keys.delete('KeyJ'));
  const hurt = await f2.waitForFunction(() => window.__bf.me.hp < 100, null, { timeout: 5000 }).then(() => true, () => false);
  check('buildfight: a hit on one peer lowers their health', hurt);
  // Then a wall built by one peer must appear for the other (done after shooting so it does not block the shots).
  await f1.evaluate(() => { window.__bf.keys.add('KeyQ'); });
  await f1.waitForTimeout(400);
  await f1.evaluate(() => { window.__bf.keys.delete('KeyQ'); });
  const sees = await f2.waitForFunction(() => window.__bf.pieces.size >= 1, null, { timeout: 8000 }).then(() => true, () => false);
  check('buildfight: a wall built by one peer appears for the other', sees);
  const seats = await Promise.all([f1, f2].map((p) => p.evaluate(() => window.__bf.me.x)));
  check('buildfight: peers spawn on opposite sides', Math.sign(seats[0]) !== Math.sign(seats[1]));
}

await browser.close();
console.log(ok ? '\nonline rooms OK' : '\nonline rooms FAILED (relay/network issue or a real bug)');
process.exit(ok ? 0 : 1);
