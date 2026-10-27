import * as THREE from '../../vendor/three.module.min.js';

// Slope remake: an original implementation of the endless "ball down a steep slope" idea.
// Gameplay facts come from public descriptions of Slope (steer a ball, speed rises, red blocks, gaps, ramps).
// No code or assets from the original are used.

const ROW = 4;            // depth of one track row
const COLS = 5;           // tiles across
const TILE_W = 2.2;
const HALF = (COLS * TILE_W) / 2;
const VISIBLE_ROWS = 46;
const BALL_R = 0.5;
const GRAVITY = 32;
const SLOPE = 0.42;       // radians the whole track is tilted downhill
const RAMP_H = 1.4;       // rise of a jump ramp over one row

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050816);
scene.fog = new THREE.Fog(0x050816, 30, 150);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0x9fffe0, 0x120a2a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-4, 10, 6);
scene.add(sun);

// Everything that lies on the track lives in `world`, which is tilted so the track runs downhill.
const world = new THREE.Group();
world.rotation.x = -SLOPE;
scene.add(world);

const tileGeo = new THREE.BoxGeometry(TILE_W - 0.12, 0.5, ROW - 0.12);
const blockGeo = new THREE.BoxGeometry(TILE_W - 0.3, 1.4, 1.4);
const rampLen = Math.hypot(ROW, RAMP_H);
const rampGeo = new THREE.BoxGeometry(TILE_W - 0.12, 0.4, rampLen);
const tileMats = [0.0, 0.05].map((l) => new THREE.MeshStandardMaterial({ color: 0x0f8f6b, roughness: 0.5, metalness: 0.2, emissive: 0x0f8f6b, emissiveIntensity: 0.15 + l }));
const blockMat = new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff1744, emissiveIntensity: 0.55, roughness: 0.4 });
const rampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfffee, emissiveIntensity: 0.4, roughness: 0.4 });
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7affd7, emissiveIntensity: 0.35, roughness: 0.25 }));
world.add(ball);

const rows = new Map(); // row index -> { cells, blocks, ramp, group }
let safeCol = 2;      // lane that is always clear
let nextCol = 2;      // lane being moved to (both stay clear during a transition)
let shiftRows = 0;    // rows left in the current transition
let lastShift = -9;
let section = null;   // { ramp, gapEnd, padEnd } for a jump section
let nextSectionAt = 40;
let rng = Math.random;

const speedAtRow = (i) => Math.min(42, 14 + i * ROW * 0.018);

function makeRow(i) {
  const cells = Array(COLS).fill(true);
  const blocks = Array(COLS).fill(false);
  let ramp = false;
  if (i > 6) {
    const d = Math.min(1, i / 220);
    const speedAt = speedAtRow(i);
    if (section && i > section.padEnd) section = null;
    if (!section && shiftRows === 0 && i >= nextSectionAt && i - lastShift > 6 && rng() < 0.25) {
      // Jump: a full-width ramp, then a gap sized to the flight distance at this speed, then a clear landing pad.
      // Airtime = 2 * climb / g, with climb = speed * RAMP_H / ROW, so the distance is 2 * speed^2 * RAMP_H / (ROW * g).
      const flight = (2 * speedAt * speedAt * RAMP_H) / (ROW * GRAVITY);
      const gap = Math.max(1, Math.min(7, Math.floor((flight * 0.55) / ROW)));
      const pad = Math.ceil(flight / ROW) + 3;
      section = { ramp: i, gapEnd: i + gap, padEnd: i + gap + pad };
      lastShift = section.padEnd;
      nextSectionAt = section.padEnd + 14 + Math.floor(rng() * 20);
    }
    if (section && i === section.ramp) {
      ramp = true;
    } else if (section && i > section.ramp && i <= section.gapEnd) {
      cells.fill(false);
    } else if (section && i > section.gapEnd) {
      // landing pad: plain tiles
    } else {
      // Moving one column takes about TILE_W / 13 seconds, so keep both lanes clear for as many rows as that needs
      // at the speed the ball will have here. That keeps every generated track beatable at top speed.
      const transitionRows = Math.ceil(TILE_W / (13 * (ROW / speedAt))) + 1;
      if (shiftRows > 0) {
        if (--shiftRows === 0) safeCol = nextCol;
      } else if (i - lastShift >= transitionRows + 1 && rng() < 0.5) {
        const to = Math.max(0, Math.min(COLS - 1, safeCol + (rng() < 0.5 ? -1 : 1)));
        if (to !== safeCol) { nextCol = to; shiftRows = transitionRows; lastShift = i; }
      }
      for (let c = 0; c < COLS; c++) {
        if (c === safeCol || (shiftRows > 0 && c === nextCol)) continue;
        const r = rng();
        if (r < 0.1 + d * 0.28) cells[c] = false;
        else if (r < 0.2 + d * 0.4) blocks[c] = true;
      }
      // Occasionally add a full-width obstacle row with a single gap so the safe lane stays reachable.
      if (rng() < 0.03 + d * 0.08) for (let c = 0; c < COLS; c++) if (c !== safeCol && !(shiftRows > 0 && c === nextCol)) blocks[c] = true;
    }
  }
  const group = new THREE.Group();
  group.position.z = -i * ROW;
  for (let c = 0; c < COLS; c++) {
    const x = -HALF + TILE_W * (c + 0.5);
    if (!cells[c]) continue;
    if (ramp) {
      const t = new THREE.Mesh(rampGeo, rampMat);
      t.rotation.x = Math.atan2(RAMP_H, ROW);
      t.position.set(x, RAMP_H / 2 - 0.2, 0);
      group.add(t);
      continue;
    }
    const t = new THREE.Mesh(tileGeo, tileMats[(i + c) % 2]);
    t.position.set(x, -0.25, 0);
    group.add(t);
    if (blocks[c]) {
      const b = new THREE.Mesh(blockGeo, blockMat);
      b.position.set(x, 0.7, 0);
      group.add(b);
    }
  }
  world.add(group);
  rows.set(i, { cells, blocks, ramp, group });
  // QA hook: lets tests check the whole track. `lane` is the column the generator guarantees is clear on this row.
  if (window.__slopeLog) window.__slopeLog[i] = { cells: [...cells], blocks: [...blocks], ramp, lane: shiftRows > 0 ? nextCol : safeCol };
}

function clearRows() {
  for (const r of rows.values()) world.remove(r.group);
  rows.clear();
}

const state = { mode: 'ready', z: 0, x: 0, y: BALL_R, vy: 0, speed: 0, dist: 0, vx: 0, left: false, right: false, best: 0, t: 0 };
try { state.best = Number(localStorage.getItem('slope-run.best')) || 0; } catch { /* storage blocked */ }
$('best').textContent = `BEST ${state.best}`;

function reset() {
  clearRows();
  rng = Math.random;
  safeCol = nextCol = 2;
  shiftRows = 0;
  lastShift = -9;
  section = null;
  nextSectionAt = 40;
  Object.assign(state, { mode: 'play', z: 0, x: 0, y: BALL_R, vy: 0, speed: 14, dist: 0, vx: 0, t: 0 });
  $('msg').hidden = true;
}

function die(reason) {
  if (state.mode !== 'play') return;
  state.mode = 'dead';
  state.reason = reason;
  const score = Math.floor(state.dist);
  if (score > state.best) {
    state.best = score;
    try { localStorage.setItem('slope-run.best', String(score)); } catch { /* ignore */ }
  }
  $('best').textContent = `BEST ${state.best}`;
  $('mTitle').textContent = reason === 'fall' ? 'YOU FELL' : 'CRASH';
  $('mText').textContent = `Score ${score}${score >= state.best && score > 0 ? ' — new best!' : ''}. Press R or Space to try again.`;
  $('go').textContent = 'Play again';
  setTimeout(() => { if (state.mode === 'dead') $('msg').hidden = false; }, 450);
}

function step(dt) {
  if (state.mode === 'ready') {
    state.t += dt;
    return;
  }
  if (state.mode === 'play') {
    state.speed = speedAtRow(state.dist / ROW);
    state.z -= state.speed * dt;
    state.dist = -state.z;
    const dir = (state.right ? 1 : 0) - (state.left ? 1 : 0);
    const target = dir * 13;
    state.vx += (target - state.vx) * Math.min(1, dt * 14);
    state.x = Math.max(-HALF - 1.5, Math.min(HALF + 1.5, state.x + state.vx * dt));

    const rowIdx = Math.round(-state.z / ROW);
    const col = Math.floor((state.x + HALF) / TILE_W);
    const row = rows.get(rowIdx);
    const hasTile = !!row && col >= 0 && col < COLS && row.cells[col];
    const u = -state.z - rowIdx * ROW;                       // position along the row, -ROW/2 .. ROW/2
    const ground = hasTile && row.ramp ? ((u + ROW / 2) / ROW) * RAMP_H : 0;
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    if (hasTile && state.y <= ground + BALL_R && state.y > ground - 0.35 && state.vy <= (row.ramp ? state.speed * RAMP_H / ROW : 0)) {
      state.y = ground + BALL_R;
      state.vy = row.ramp ? (state.speed * RAMP_H) / ROW : 0; // leaving a ramp carries the climb speed into the air
    }
    if (hasTile && row.blocks[col] && state.y < 1.4 + BALL_R * 0.8) {
      if (Math.abs(u) < 0.7 + BALL_R) return die('crash');
    }
    if (state.y < -8) return die('fall');
  }
  if (state.mode === 'dead') {
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    state.speed *= 0.96;
    state.z -= state.speed * dt;
  }
  const head = Math.floor(-state.z / ROW);
  for (let i = Math.max(0, head - 6); i < head + VISIBLE_ROWS; i++) if (!rows.has(i)) makeRow(i);
  for (const [i, r] of rows) if (i < head - 8) { world.remove(r.group); rows.delete(i); }
}

const _bw = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last ?? now)) / 1000);
  frame.last = now;
  step(dt);
  // The track slowly changes colour as you go further, like the levels of the original.
  const hue = ((160 + state.dist / 40) % 360) / 360;
  for (const m of tileMats) { m.color.setHSL(hue, 0.8, 0.32); m.emissive.setHSL(hue, 0.8, 0.32); }
  if (state.mode !== 'ready') {
    ball.position.set(state.x, state.y, state.z);
    ball.rotation.x -= state.speed * dt * 2;
    world.updateMatrixWorld();
    ball.getWorldPosition(_bw);
    camera.position.set(state.x * 0.6, _bw.y + 3.6, _bw.z + 7);
    camera.lookAt(state.x * 0.4, _bw.y - 4, _bw.z - 12);
    $('score').textContent = Math.floor(state.dist);
  } else {
    ball.position.set(0, BALL_R, 0);
    for (let i = 0; i < VISIBLE_ROWS; i++) if (!rows.has(i)) makeRow(i);
    world.updateMatrixWorld();
    ball.getWorldPosition(_bw);
    camera.position.set(Math.sin(state.t * 0.4) * 3, _bw.y + 3.8, _bw.z + 8);
    camera.lookAt(0, _bw.y - 4, _bw.z - 12);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const keys = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (keys[e.code]) { state[keys[e.code]] = true; e.preventDefault(); }
  if ((e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter') && state.mode !== 'play') { e.preventDefault(); reset(); }
});
addEventListener('keyup', (e) => { if (keys[e.code]) state[keys[e.code]] = false; });
addEventListener('blur', () => { state.left = state.right = false; });
const touch = (e) => {
  const side = e.clientX < innerWidth / 2 ? 'left' : 'right';
  state.left = side === 'left';
  state.right = side === 'right';
};
canvas.addEventListener('pointerdown', (e) => { if (state.mode === 'play') touch(e); });
canvas.addEventListener('pointermove', (e) => { if (state.mode === 'play' && e.buttons) touch(e); });
const release = () => { state.left = state.right = false; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
$('go').onclick = reset;

// Test hook so automated QA can inspect state without reading pixels.
window.__slope = state;
window.__slopeRows = rows;
requestAnimationFrame(frame);
