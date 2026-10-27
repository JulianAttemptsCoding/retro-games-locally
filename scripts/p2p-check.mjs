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

await browser.close();
console.log(ok ? '\nonline rooms OK' : '\nonline rooms FAILED (relay/network issue or a real bug)');
process.exit(ok ? 0 : 1);
