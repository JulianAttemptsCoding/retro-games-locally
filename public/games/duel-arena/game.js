'use strict';
// Duel Arena 1v1 — an original local two-player top-down duel.
// Inspired by the build-and-shoot feel of 1v1 games; shares no code or assets with any of them.
(() => {
  const W = 960, H = 540, CELL = 30;
  const COLS = W / CELL, ROWS = H / CELL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const P = [
    { name: 'P1', color: '#5ee7ff', keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'KeyF', wall: 'KeyG' } },
    { name: 'P2', color: '#ff6b8a', keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'KeyL', wall: 'KeyK' } },
  ];
  const held = new Set();
  const state = { mode: 'title', round: 0, wins: [0, 0], msg: '', msgUntil: 0 };
  let walls, tanks, bullets;

  const key = (c, r) => r * COLS + c;

  function buildArena() {
    walls = new Map();
    const put = (c, r, hp = 3) => { if (c >= 0 && r >= 0 && c < COLS && r < ROWS) walls.set(key(c, r), { c, r, hp, solid: true }); };
    for (let c = 0; c < COLS; c++) { put(c, 0, 99); put(c, ROWS - 1, 99); }
    for (let r = 0; r < ROWS; r++) { put(0, r, 99); put(COLS - 1, r, 99); }
    // Symmetric random cover so neither side is favoured.
    const n = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const c = 5 + Math.floor(Math.random() * (COLS / 2 - 6));
      const r = 2 + Math.floor(Math.random() * (ROWS - 4));
      const len = 1 + Math.floor(Math.random() * 3);
      const horiz = Math.random() < 0.5;
      for (let k = 0; k < len; k++) {
        const cc = horiz ? c + k : c, rr = horiz ? r : r + k;
        put(cc, rr); put(COLS - 1 - cc, ROWS - 1 - rr);
      }
    }
    // Clear spawn areas.
    for (let c = 1; c < 5; c++) for (let r = Math.floor(ROWS / 2) - 2; r <= Math.floor(ROWS / 2) + 2; r++) { walls.delete(key(c, r)); walls.delete(key(COLS - 1 - c, r)); }
  }

  function spawn() {
    buildArena();
    bullets = [];
    tanks = [
      { x: 2.5 * CELL, y: H / 2, a: 0, hp: 3, cd: 0, wallCd: 0, walls: 4 },
      { x: W - 2.5 * CELL, y: H / 2, a: Math.PI, hp: 3, cd: 0, wallCd: 0, walls: 4 },
    ];
  }

  function isBlocked(x, y, r) {
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    const r0 = Math.floor((y - r) / CELL), r1 = Math.floor((y + r) / CELL);
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) if (walls.has(key(cc, rr))) return true;
    return false;
  }

  function update(dt) {
    for (let i = 0; i < 2; i++) {
      const t = tanks[i], k = P[i].keys;
      let dx = (held.has(k.right) ? 1 : 0) - (held.has(k.left) ? 1 : 0);
      let dy = (held.has(k.down) ? 1 : 0) - (held.has(k.up) ? 1 : 0);
      if (dx || dy) {
        const len = Math.hypot(dx, dy); dx /= len; dy /= len;
        t.a = Math.atan2(dy, dx);
        const sp = 190 * dt;
        if (!isBlocked(t.x + dx * sp, t.y, 11)) t.x += dx * sp;
        if (!isBlocked(t.x, t.y + dy * sp, 11)) t.y += dy * sp;
        const o = tanks[1 - i];
        if (Math.hypot(t.x - o.x, t.y - o.y) < 22) { t.x -= dx * sp; t.y -= dy * sp; }
      }
      t.cd -= dt; t.wallCd -= dt;
      if (held.has(k.fire) && t.cd <= 0) {
        t.cd = 0.38;
        bullets.push({ x: t.x + Math.cos(t.a) * 18, y: t.y + Math.sin(t.a) * 18, vx: Math.cos(t.a) * 520, vy: Math.sin(t.a) * 520, owner: i, life: 1.6 });
      }
      if (held.has(k.wall) && t.wallCd <= 0 && t.walls > 0) {
        const c = Math.floor((t.x + Math.cos(t.a) * 34) / CELL), r = Math.floor((t.y + Math.sin(t.a) * 34) / CELL);
        const o = tanks[1 - i];
        const free = !walls.has(key(c, r)) && Math.hypot((c + 0.5) * CELL - o.x, (r + 0.5) * CELL - o.y) > 24 && Math.hypot((c + 0.5) * CELL - t.x, (r + 0.5) * CELL - t.y) > 20;
        if (free) { walls.set(key(c, r), { c, r, hp: 2 }); t.walls--; t.wallCd = 0.4; }
      }
      if (t.walls < 4) t.regen = (t.regen ?? 0) + dt, t.regen > 4 && (t.walls++, t.regen = 0);
    }
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const c = Math.floor(b.x / CELL), r = Math.floor(b.y / CELL), w = walls.get(key(c, r));
      if (w) { b.life = 0; if (w.hp < 90 && --w.hp <= 0) walls.delete(key(c, r)); continue; }
      const o = tanks[1 - b.owner];
      if (Math.hypot(b.x - o.x, b.y - o.y) < 14) {
        b.life = 0; o.hp--;
        if (o.hp <= 0) return endRound(b.owner);
      }
    }
    bullets = bullets.filter((b) => b.life > 0);
  }

  function endRound(winner) {
    state.wins[winner]++;
    state.round++;
    if (state.wins[winner] >= 3) {
      state.mode = 'over';
      state.msg = `${P[winner].name} wins the match ${state.wins[0]}–${state.wins[1]}! Press Enter for a rematch.`;
    } else {
      state.mode = 'between';
      state.msg = `${P[winner].name} takes the round. Next round starting…`;
      state.msgUntil = performance.now() + 1500;
    }
  }

  function startMatch() { state.wins = [0, 0]; state.round = 0; spawn(); state.mode = 'play'; state.msg = ''; }

  function drawTank(t, color) {
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a);
    ctx.fillStyle = color; ctx.fillRect(-12, -10, 24, 20);
    ctx.fillStyle = '#0b0e1a'; ctx.fillRect(2, -3, 16, 6);
    ctx.fillStyle = color; ctx.fillRect(4, -2, 14, 4);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#10152e'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
    if (walls) for (const w of walls.values()) {
      ctx.fillStyle = w.hp >= 90 ? '#2a3363' : w.hp === 3 ? '#8a93c9' : w.hp === 2 ? '#6a73a9' : '#4a5389';
      ctx.fillRect(w.c * CELL + 1, w.r * CELL + 1, CELL - 2, CELL - 2);
    }
    if (tanks) {
      tanks.forEach((t, i) => drawTank(t, P[i].color));
      ctx.fillStyle = '#fff';
      for (const b of bullets) ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
    }
    // HUD
    ctx.font = '700 20px ui-monospace, monospace'; ctx.textBaseline = 'top';
    P.forEach((p, i) => {
      ctx.fillStyle = p.color; ctx.textAlign = i ? 'right' : 'left';
      const x = i ? W - 40 : 40;
      const hp = tanks ? '♥'.repeat(Math.max(0, tanks[i].hp)) + '♡'.repeat(3 - Math.max(0, tanks[i].hp)) : '♥♥♥';
      ctx.fillText(`${p.name}  ${hp}  🧱${tanks ? tanks[i].walls : 4}`, x, 36);
      ctx.fillText(`${state.wins[i]}`, i ? W - 40 : 40, 62);
    });
    if (state.mode !== 'play') {
      ctx.fillStyle = 'rgba(5,7,18,.72)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      ctx.font = '800 54px system-ui, sans-serif';
      ctx.fillText(state.mode === 'title' ? 'DUEL ARENA 1v1' : state.mode === 'over' ? 'MATCH OVER' : `ROUND ${state.round + 1}`, W / 2, H / 2 - 70);
      ctx.font = '500 22px system-ui, sans-serif'; ctx.fillStyle = '#c8d0ff';
      const lines = state.mode === 'title'
        ? ['Two players, one keyboard. First to 3 rounds wins.', 'Place walls for cover — they regenerate slowly.', 'Press Enter to start']
        : [state.msg];
      lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + i * 32));
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state.mode === 'play') update(dt);
    if (state.mode === 'between' && now > state.msgUntil) { spawn(); state.mode = 'play'; }
    draw();
    requestAnimationFrame(loop);
  }

  addEventListener('keydown', (e) => {
    if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
    held.add(e.code);
    if (e.code === 'Enter' && (state.mode === 'title' || state.mode === 'over')) startMatch();
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());
  window.__duel = { state, get tanks() { return tanks; }, get walls() { return walls; } };
  spawn();
  requestAnimationFrame(loop);
})();
