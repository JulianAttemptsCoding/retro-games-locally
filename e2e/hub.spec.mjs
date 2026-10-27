import { test, expect } from '@playwright/test';

test.describe('library', () => {
  test('lists games, filters by players and category, searches, and clears', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('#grid .card');
    const total = await cards.count();
    expect(total).toBeGreaterThan(30);

    await page.getByRole('button', { name: /Online friends/ }).click();
    const online = await cards.count();
    expect(online).toBeGreaterThan(5);
    expect(online).toBeLessThan(total);

    await page.getByRole('button', { name: /^Board & Strategy/ }).click();
    await expect(cards.first()).toContainText(/Chess|Four in a Row|Checkers|Reversi|Tic|Gomoku|Mancala|Nim|Dots/);

    await page.locator('#clear').click();
    await expect(cards).toHaveCount(total);

    await page.locator('#q').fill('pong');
    await expect(cards).toHaveCount(1);
    await page.locator('#q').fill('zzzz-no-such-game');
    await expect(page.locator('#empty')).toBeVisible();
  });

  test('keyboard: "/" focuses search and Enter opens the detail dialog', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('/');
    await expect(page.locator('#q')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.locator('#grid .card').first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#detail')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#detail')).toBeHidden();
  });

  test('favorites persist across reloads and filter the grid', async ({ page }) => {
    await page.goto('/');
    await page.locator('#q').fill('2048');
    await page.locator('#grid .card .fav').first().click();
    await page.reload();
    await page.locator('#q').fill('');
    await page.locator('#favOnly').check();
    await expect(page.locator('#grid .card')).toHaveCount(1);
    await expect(page.locator('#grid .card').first()).toContainText('2048');
  });

  test('unavailable and ROM titles are honest', async ({ page }) => {
    await page.goto('/#1v1lol');
    const dlg = page.locator('#detail');
    await expect(dlg).toContainText(/permanently shut down/i);
    await expect(dlg.getByRole('button', { name: /Duel Arena/ })).toBeVisible();
    await expect(dlg.getByRole('link', { name: /Play now/ })).toHaveCount(0);

    await page.goto('/#mariokart-64');
    await expect(page.locator('#detail')).toContainText('No game files are included');
    await expect(page.locator('#detail').getByRole('link', { name: /Open emulator/ })).toBeVisible();
  });

  test('"Play now" opens the player wrapper with the game loaded, and Library returns', async ({ page }) => {
    await page.goto('/#2048');
    await page.locator('#detail').getByRole('link', { name: /Play now/ }).click();
    await expect(page).toHaveURL(/play\.html\?g=2048/);
    await expect(page.frameLocator('#frame').locator('.game-container')).toBeVisible();
    await page.getByRole('link', { name: '← Library' }).click();
    await expect(page.locator('#recent .card')).toHaveCount(1);
  });

  test('every catalog entry points at a file that exists', async ({ request }) => {
    const { GAMES } = await import('../public/catalog.js');
    for (const g of GAMES.filter((x) => x.path)) {
      const res = await request.get('/' + g.path.split('?')[0]);
      expect(res.status(), g.id).toBe(200);
    }
  });
});
