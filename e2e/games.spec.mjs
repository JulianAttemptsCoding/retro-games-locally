import { test, expect } from '@playwright/test';
import { startAutopilot } from './slope-autopilot.mjs';

const cell = (page, n) => page.locator(`[data-cell="${n}"]`);

test.describe('tabletop (local pass-and-play)', () => {
  test('tic-tac-toe: first player wins and the board locks', async ({ page }) => {
    await page.goto('/games/tabletop/index.html?game=tictactoe');
    for (const n of [0, 3, 1, 4, 2]) await cell(page, n).click();
    await expect(page.locator('#turn')).toContainText(/win|Crosses/i);
    await expect(cell(page, 8)).toBeDisabled();
  });

  test('connect four: stacking discs in one column wins', async ({ page }) => {
    await page.goto('/games/tabletop/index.html?game=connect4');
    for (const n of [0, 1, 0, 1, 0, 1, 0]) await cell(page, n).click();
    await expect(page.locator('#turn')).toContainText(/win|Coral/i);
  });

  test('chess: promotion dropdown set to knight does not block ordinary moves', async ({ page }) => {
    await page.goto('/games/tabletop/index.html?game=chess');
    await page.locator('#promotion').selectOption('n');
    await cell(page, 52).click();
    await cell(page, 36).click();
    await expect(cell(page, 36)).toHaveAttribute('aria-label', /white pawn/i);
    await expect(page.locator('#turn')).toContainText(/Black/);
  });

  test('every game variant loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const g of ['chess', 'connect4', 'checkers', 'reversi', 'tictactoe', 'gomoku', 'mancala', 'nim', 'dots']) {
      await page.goto(`/games/tabletop/index.html?game=${g}`);
      await expect(page.locator('#board button').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test.describe('originals', () => {
  test('slope run: starts, scores, ends, and restarts', async ({ page }) => {
    await page.goto('/games/slope-run/index.html');
    await page.locator('#go').click();
    await expect.poll(() => page.evaluate(() => window.__slope.mode)).toBe('play');
    await expect.poll(() => page.evaluate(() => window.__slope.dist), { timeout: 5000 }).toBeGreaterThan(10);
    await page.keyboard.down('ArrowLeft');
    await expect.poll(() => page.evaluate(() => window.__slope.mode), { timeout: 20000 }).toBe('dead');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('KeyR');
    await expect.poll(() => page.evaluate(() => window.__slope.mode)).toBe('play');
  });

  test('slope: the generated track is beatable, including jump ramps over gaps', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => { window.__slopeLog = []; });
    await page.goto('/games/slope-run/index.html');
    await page.locator('#go').click();
    await startAutopilot(page);
    await page.waitForFunction(() => window.__slope.mode === 'dead' || window.__slope.dist > 320, null, { timeout: 110000 });
    const r = await page.evaluate(() => ({
      mode: window.__slope.mode, dist: window.__slope.dist, reason: window.__slope.reason,
      ramps: window.__slopeLog.filter((row, i) => row?.ramp && i * 4 < window.__slope.dist - 20).length,
      gaps: window.__slopeLog.filter((row, i) => row && !row.cells.some(Boolean) && i * 4 < window.__slope.dist - 20).length,
    }));
    expect(r.mode, `died: ${r.reason} at ${r.dist}`).toBe('play');
    expect(r.ramps).toBeGreaterThan(0); // crossed at least one ramp-and-gap jump
    expect(r.gaps).toBeGreaterThan(0);
  });

  test('duel arena: a hit costs health', async ({ page }) => {
    await page.goto('/games/duel-arena/index.html');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__duel.state.mode)).toBe('play');
    await page.evaluate(() => { const d = window.__duel; for (const [k, w] of d.walls) if (w.hp < 90) d.walls.delete(k); d.tanks[0].y = d.tanks[1].y = 270; d.tanks[0].a = 0; });
    await page.keyboard.down('KeyF');
    await expect.poll(() => page.evaluate(() => window.__duel.tanks[1].hp), { timeout: 8000 }).toBeLessThan(3);
    await page.keyboard.up('KeyF');
  });
});

test.describe('console', () => {
  test('emulator page requires a ROM and ships the cores', async ({ page, request }) => {
    await page.goto('/games/console/index.html?core=n64&title=Mario%20Kart%2064');
    await expect(page.locator('#title')).toHaveText('Mario Kart 64');
    await expect(page.locator('#core')).toHaveValue('n64');
    await expect(page.locator('#start')).toBeDisabled();
    for (const f of ['emulator/data/loader.js', 'emulator/data/cores/mupen64plus_next-wasm.data', 'emulator/data/cores/snes9x-wasm.data', 'emulator/data/cores/mgba-wasm.data'])
      expect((await request.get('/games/console/' + f)).status(), f).toBe(200);
  });
});

test.describe('tetris', () => {
  test('loads without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/games/tetris/index.html');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4500);
    expect(errors).toEqual([]);
  });
});
