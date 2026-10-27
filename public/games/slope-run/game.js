import * as THREE from '../../vendor/three.module.min.js';

const ROW = 4;            // depth of one track row
const COLS = 5;           // tiles across
const TILE_W = 2.2;
const HALF = (COLS * TILE_W) / 2;
const VISIBLE_ROWS = 46;
const BALL_R = 0.5;
const GRAVITY = 32;

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

const tileGeo = new THREE.BoxGeometry(TILE_W - 0.12, 0.5, ROW - 0.12);
const blockGeo = new THREE.BoxGeometry(TILE_W - 0.3, 1.4, 1.4);
const tileMats = [0x0f8f6b, 0x15c08f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, emissive: c, emissiveIntensity: 0.15 }));
const blockMat = new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff1744, emissiveIntensity: 0.55, roughness: 0.4 });
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7affd7, emissiveIntensity: 0.35, roughness: 0.25 }));
scene.add(ball);

const rows = new Map(); // row index -> { cells: boolean[], blocks: boolean[], group }
let safeCol = 2;      // lane that is always clear
let nextCol = 2;      // lane being moved to (both stay clear during a transition)
let shiftRows = 0;    // rows left in the current transition
let lastShift = -9;
let rng = Math.random;

function makeRow(i) {
  const cells = Array(COLS).fill(true);
  const blocks = Array(COLS).fill(false);
  if (i > 6) {
    const d = Math.min(1, i / 220);
    // Moving one column takes about TILE_W / 13 seconds, so keep both lanes clear for as many rows as that needs
    // at the speed the ball will have here. That keeps every generated track beatable at top speed.
    const speedAt = Math.min(42, 14 + i * ROW * 0.018);
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
  const group = new THREE.Group();
  group.position.z = -i * ROW;
  for (let c = 0; c < COLS; c++) {
    const x = -HALF + TILE_W * (c + 0.5);
    if (cells[c]) {
      const t = new THREE.Mesh(tileGeo, tileMats[(i + c) % 2]);
      t.position.set(x, -0.25, 0);
      group.add(t);
      if (blocks[c]) {
        const b = new THREE.Mesh(blockGeo, blockMat);
        b.position.set(x, 0.7, 0);
        group.add(b);
      }
    }
  }
  scene.add(group);
  rows.set(i, { cells, blocks, group });
}

function clearRows() {
  for (const r of rows.values()) scene.remove(r.group);
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
    camera.position.set(Math.sin(state.t * 0.4) * 3, 4, 8);
    camera.lookAt(0, 0, -20);
    return;
  }
  if (state.mode === 'play') {
    state.speed = Math.min(42, 14 + state.dist * 0.018);
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
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    if (hasTile && state.y <= BALL_R && state.y > -0.35 && state.vy <= 0) { state.y = BALL_R; state.vy = 0; }
    if (hasTile && row.blocks[col] && state.y < 1.4 + BALL_R * 0.8) {
      const localZ = Math.abs(-state.z - rowIdx * ROW); // distance from row centre
      if (localZ < 0.7 + BALL_R) return die('crash');
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
  for (const [i, r] of rows) if (i < head - 8) { scene.remove(r.group); rows.delete(i); }
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last ?? now)) / 1000);
  frame.last = now;
  step(dt);
  if (state.mode !== 'ready') {
    ball.position.set(state.x, state.y, state.z);
    ball.rotation.x -= state.speed * dt * 2;
    camera.position.set(state.x * 0.6, 3.4, state.z + 6.5);
    camera.lookAt(state.x * 0.4, 0.6, state.z - 12);
    $('score').textContent = Math.floor(state.dist);
  } else {
    ball.position.set(0, BALL_R, 0);
    const head = Math.floor(-state.z / ROW);
    for (let i = 0; i < VISIBLE_ROWS; i++) if (!rows.has(i)) makeRow(i);
    void head;
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
