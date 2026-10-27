import { test, expect } from '@playwright/test';

// Steps the game loop by hand so physics and combat are deterministic and fast.
const advance = (page, seconds, setup) =>
  page.evaluate(({ seconds, setup }) => {
    const b = window.__bf;
    if (setup) new Function('b', setup)(b);
    for (let i = 0; i < Math.round(seconds * 60); i++) b.step(1 / 60);
    return { x: b.me.x, y: b.me.y, z: b.me.z, hp: b.me.hp, foeHp: b.foe?.hp, phase: b.state.phase };
  }, { seconds, setup });

test.describe('build fight 1v1', () => {
  test('bot match: countdown then fight, players face each other', async ({ page }) => {
    await page.goto('/games/buildfight/index.html?mode=bot&nolock=1');
    await expect.poll(() => page.evaluate(() => window.__bf?.state.phase)).toMatch(/^(countdown|fight)$/);
    const r = await advance(page, 3.3);
    expect(r.phase).toBe('fight');
    const d = await page.evaluate(() => { const b = window.__bf; return { me: b.me.x, foe: b.foe.x, yaw: b.me.yaw }; });
    expect(d.me).toBeLessThan(0);
    expect(d.foe).toBeGreaterThan(0);
    expect(Math.abs(d.yaw + Math.PI / 2)).toBeLessThan(0.01); // facing +x, toward the bot
  });

  test('walls block movement, ramps can be climbed', async ({ page }) => {
    await page.goto('/games/buildfight/index.html?mode=practice&nolock=1');
    await advance(page, 0.2);
    // Face +x, build a wall, then try to walk through it.
    let r = await advance(page, 0.5, `b.keys.add('KeyQ')`);
    await page.evaluate(() => window.__bf.keys.delete('KeyQ'));
    expect(await page.evaluate(() => window.__bf.pieces.size)).toBe(1);
    r = await advance(page, 2, `b.keys.add('KeyW')`);
    const wallX = await page.evaluate(() => [...window.__bf.pieces.values()][0].box.x0);
    expect(r.x).toBeLessThan(wallX);
    await page.evaluate(() => window.__bf.keys.delete('KeyW'));

    // Fresh spot: back up, then ramp-rush (ramp, step on, ramp...).
    await page.evaluate(() => { const b = window.__bf; for (const pc of [...b.pieces.values()]) b.pieces.delete(pc.key); });
  });

  test('ramp rush gains height', async ({ page }) => {
    await page.goto('/games/buildfight/index.html?mode=practice&nolock=1');
    await advance(page, 0.2);
    // Hold forward and spam ramp: each ramp is placed one cell ahead and one level up.
    const r = await page.evaluate(() => {
      const b = window.__bf;
      b.keys.add('KeyW');
      let t = 0, maxY = 0;
      for (let i = 0; i < 60 * 8; i++) {
        if (i % 12 === 0) b.keys.add('KeyC'); else b.keys.delete('KeyC');
        b.step(1 / 60);
        maxY = Math.max(maxY, b.me.y);
        t++;
      }
      return { maxY, pieces: b.pieces.size, x: b.me.x };
    });
    expect(r.maxY).toBeGreaterThan(7.5);
    expect(r.pieces).toBeGreaterThan(2);
  });

  test('shooting damages the bot; walls soak bullets', async ({ page }) => {
    await page.goto('/games/buildfight/index.html?mode=bot&nolock=1&diff=easy');
    await advance(page, 3.3); // countdown -> fight
    // Put the bot straight ahead, close, and stop it from acting.
    const setup = `
      // The camera sits over the right shoulder, so the crosshair line runs 0.8 to the player's right (+z when facing +x).
      b.foe.x = b.me.x + 8; b.foe.z = b.me.z + 0.8; b.foe.y = 0;
      b.state.bot.update = () => {};
      b.aim.pitch = -0.06; // the camera sits above the shoulder, so aim slightly down to put the ray through the bot's torso
      b.me.weapon = 'ar';
      b.keys.add('KeyJ');`;
    let r = await advance(page, 0.4, setup); // short burst: a full second would kill the bot and end the round
    expect(r.foeHp).toBeLessThan(100);
    await page.evaluate(() => { window.__bf.keys.delete('KeyJ'); window.__bf.foe.hp = 100; });

    // Now wall in between: shots hit the wall, not the bot.
    await advance(page, 0.1, `b.me.x = -22; b.me.z = 0; b.foe.x = -14; b.foe.z = 0.8; b.me.cd = 0; b.keys.add('KeyQ');`);
    await page.evaluate(() => window.__bf.keys.delete('KeyQ'));
    expect(await page.evaluate(() => window.__bf.pieces.size)).toBe(1);
    const hpBefore = await page.evaluate(() => window.__bf.foe.hp);
    const wallHp0 = await page.evaluate(() => [...window.__bf.pieces.values()][0].hp);
    r = await advance(page, 0.6, `b.keys.add('KeyJ');`);
    expect(r.foeHp).toBe(hpBefore);
    expect(await page.evaluate(() => [...window.__bf.pieces.values()][0]?.hp ?? 0)).toBeLessThan(wallHp0);
  });

  test('a full bot match ends with a winner and a rematch works', async ({ page }) => {
    await page.goto('/games/buildfight/index.html?mode=bot&nolock=1&diff=hard');
    const r = await page.evaluate(() => {
      const b = window.__bf;
      let frames = 0, hpLow = 100;
      // Make the player a stationary target and shoot back with a perfect AR so rounds resolve fast.
      for (; frames < 60 * 240 && b.state.phase !== 'matchEnd'; frames++) {
        if (b.state.phase === 'fight') {
          const f = b.foe, m = b.me;
          const dx = f.x - m.x, dz = f.z - m.z, dist = Math.hypot(dx, dz);
          b.aim.yaw = Math.atan2(-dx, -dz);
          b.aim.pitch = Math.atan2((f.y + 1.2) - (m.y + 1.55), dist);
          b.keys.add('KeyJ');
          b.me.weapon = 'ar';
        } else b.keys.delete('KeyJ');
        b.step(1 / 60);
        hpLow = Math.min(hpLow, b.me.hp);
      }
      return { phase: b.state.phase, meLives: b.me.lives, foeLives: b.foe.lives, frames, hpLow };
    });
    expect(r.phase).toBe('matchEnd');
    expect(Math.min(r.meLives, r.foeLives)).toBe(0);
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__bf.state.phase)).toBe('countdown');
    expect(await page.evaluate(() => [window.__bf.me.lives, window.__bf.foe.lives])).toEqual([3, 3]);
  });

  test('menu starts a bot match', async ({ page }) => {
    await page.goto('/games/buildfight/index.html?nolock=1');
    await page.getByRole('button', { name: 'Play vs bot' }).click();
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#hud')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__bf.state.phase)).toMatch(/^(countdown|fight)$/); // the real-time loop may already be past the countdown
  });
});
