import * as THREE from '../../vendor/three.module.min.js';

// Build Fight 1v1: an original third-person build-and-shoot duel in the style of 1v1.LOL / Fortnite building fights.
// Mechanics (walls, floors, ramps, cones, pickaxe/shotgun/rifle, three lives) follow public descriptions of those games.
// No code or assets from them are used.

const S = 4;                 // build grid size
const THK = 0.3, FLOOR_T = 0.25;
const PH = 1.8, PR = 0.4, EYE = 1.55, STEP = 0.6;
const GRAV = 28, JUMP = 9.2, WALK = 6.5, SPRINT = 8.6;
const ARENA = 34;
const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
const HP_MAX = 100, LIVES = 3;
const COL = { me: 0x3aa0ff, foe: 0xff8a3a };

const WEAPONS = {
  pick: { name: 'Pickaxe', cd: 0.45, range: 3.2, dmg: 25, sdmg: 60, pellets: 1, spread: 0, auto: true },
  shotgun: { name: 'Shotgun', cd: 0.85, range: 40, dmg: 11, sdmg: 14, pellets: 8, spread: 0.06, auto: false },
  ar: { name: 'Rifle', cd: 0.11, range: 90, dmg: 9, sdmg: 10, pellets: 1, spread: 0.012, auto: true },
};
const PIECE_HP = { w: 150, f: 140, r: 140, c: 120 };

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const NOLOCK = params.has('nolock');

// ---------- three.js scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc8ff);
scene.fog = new THREE.Fog(0x8fc8ff, 60, 170);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 300);
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8a5a, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(30, 50, 20);
scene.add(sun);

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5fae5a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${40 + Math.random() * 50 | 0},${110 + Math.random() * 60 | 0},50,.25)`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ARENA * 2 / S, ARENA * 2 / S);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const arena = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
arena.rotation.x = -Math.PI / 2;
scene.add(arena);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x3f7f4a, roughness: 1 }));
outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05;
scene.add(outer);
// Border posts and trees outside the playable island, purely decorative.
{
  const trunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2b }), leaf = new THREE.MeshStandardMaterial({ color: 0x2f8f4a });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, r = ARENA + 5 + (i % 3) * 4;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 6), trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 7), leaf);
    const grp = new THREE.Group();
    tr.position.y = 1.5; top.position.y = 5;
    grp.add(tr, top);
    grp.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(grp);
  }
  const edge = new THREE.Mesh(new THREE.BoxGeometry(ARENA * 2, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffd23a }));
  for (const [x, z, ry] of [[0, -ARENA, 0], [0, ARENA, 0], [-ARENA, 0, Math.PI / 2], [ARENA, 0, Math.PI / 2]]) {
    const e = edge.clone(); e.position.set(x, 0.2, z); e.rotation.y = ry; scene.add(e);
  }
}

// ---------- audio ----------
let actx;
function tone(freq, dur, type = 'square', vol = 0.05) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.4), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur);
  } catch { /* audio blocked */ }
}

// ---------- building ----------
const pieces = new Map();   // key -> piece
let pieceMeshes = [];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dirIndex = (yaw) => ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;

const specKey = (sp) => (sp.t === 'w' ? `w${sp.ax}${sp.i}_${sp.j}_${sp.gy}` : `${sp.t}_${sp.gx}_${sp.gy}_${sp.gz}`);
function rampT(r, x, z) { return ((x - r.cx) * r.dx + (z - r.cz) * r.dz) / S + 0.5; }

function planBuild(type, a) {
  const d = dirIndex(a.yaw), [dx, dz] = DIRS[d];
  const gx = Math.floor(a.x / S), gz = Math.floor(a.z / S);
  const sup = a.support && a.support.t === 'r' ? a.support : null;
  let L = Math.floor((a.y + 0.5) / S);
  if (type === 'w') {
    if (sup) L = sup.gy + (rampT(sup.ramp, a.x, a.z) >= 0.5 ? 1 : 0);
    if (dx !== 0) return { t: 'w', ax: 'x', i: dx > 0 ? gx + 1 : gx, j: gz, gy: L };
    return { t: 'w', ax: 'z', i: dz > 0 ? gz + 1 : gz, j: gx, gy: L };
  }
  if (sup && (type === 'f' || type === 'r')) L = sup.gy + 1;
  if (type === 'f') return { t: 'f', gx: gx + dx, gy: L, gz: gz + dz };
  if (type === 'r') return { t: 'r', gx: gx + dx, gy: L, gz: gz + dz, d };
  return { t: 'c', gx, gy: L + 1, gz };
}

function pieceMaterial(owner) {
  return new THREE.MeshStandardMaterial({ color: owner === 'me' ? 0x6fb6ff : 0xffb070, roughness: 0.7, metalness: 0.05 });
}

function addPiece(sp, owner) {
  const key = specKey(sp);
  if (pieces.has(key)) return null;
  if (sp.t === 'f' && pieces.has(`r_${sp.gx}_${sp.gy}_${sp.gz}`)) return null;
  if (sp.t === 'r' && pieces.has(`f_${sp.gx}_${sp.gy}_${sp.gz}`)) return null;
  if (sp.gy < 0 || sp.gy > 8) return null;
  const mat = pieceMaterial(owner);
  const pc = { key, t: sp.t, gy: sp.gy, owner, hp: PIECE_HP[sp.t], maxHp: PIECE_HP[sp.t], mat, box: null, ramp: null, mesh: null };
  let mesh;
  if (sp.t === 'w') {
    const horiz = sp.ax === 'z';
    const cx = horiz ? (sp.j + 0.5) * S : sp.i * S, cz = horiz ? sp.i * S : (sp.j + 0.5) * S, cy = sp.gy * S + S / 2;
    if (Math.abs(cx) > ARENA + S || Math.abs(cz) > ARENA + S) return null;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(horiz ? S : THK, S, horiz ? THK : S), mat);
    mesh.position.set(cx, cy, cz);
    pc.box = { x0: cx - (horiz ? S / 2 : THK / 2), x1: cx + (horiz ? S / 2 : THK / 2), z0: cz - (horiz ? THK / 2 : S / 2), z1: cz + (horiz ? THK / 2 : S / 2), y0: cy - S / 2, y1: cy + S / 2 };
  } else if (sp.t === 'f') {
    const cx = (sp.gx + 0.5) * S, cz = (sp.gz + 0.5) * S, cy = sp.gy * S + FLOOR_T / 2;
    if (Math.abs(cx) > ARENA + S || Math.abs(cz) > ARENA + S) return null;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(S, FLOOR_T, S), mat);
    mesh.position.set(cx, cy, cz);
    pc.box = { x0: cx - S / 2, x1: cx + S / 2, z0: cz - S / 2, z1: cz + S / 2, y0: sp.gy * S, y1: sp.gy * S + FLOOR_T };
  } else if (sp.t === 'c') {
    const cx = (sp.gx + 0.5) * S, cz = (sp.gz + 0.5) * S, base = sp.gy * S;
    if (Math.abs(cx) > ARENA + S || Math.abs(cz) > ARENA + S) return null;
    mesh = new THREE.Mesh(new THREE.ConeGeometry(S / Math.SQRT2, 2.4, 4), mat);
    mesh.rotation.y = Math.PI / 4;
    mesh.position.set(cx, base + 1.2, cz);
    pc.box = { x0: cx - S / 2, x1: cx + S / 2, z0: cz - S / 2, z1: cz + S / 2, y0: base, y1: base + 1.6 };
  } else {
    const cx = (sp.gx + 0.5) * S, cz = (sp.gz + 0.5) * S, y0 = sp.gy * S + FLOOR_T;
    if (Math.abs(cx) > ARENA + S || Math.abs(cz) > ARENA + S) return null;
    const [dx, dz] = DIRS[sp.d];
    const grp = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(S, 0.25, Math.hypot(S, S)), mat);
    slab.rotation.x = Math.PI / 4;
    slab.position.y = S / 2 - 0.18;
    grp.add(slab);
    grp.rotation.y = sp.d * Math.PI / 2;
    grp.position.set(cx, y0, cz);
    mesh = grp;
    pc.ramp = { cx, cz, dx, dz, y0, x0: cx - S / 2, x1: cx + S / 2, z0: cz - S / 2, z1: cz + S / 2 };
    pc.gy = sp.gy;
  }
  pc.mesh = mesh;
  scene.add(mesh);
  mesh.updateMatrixWorld(true);
  mesh.traverse((o) => { if (o.isMesh) o.userData.piece = pc; });
  pieces.set(key, pc);
  rebuildMeshList();
  return pc;
}

function rebuildMeshList() {
  pieceMeshes = [];
  for (const pc of pieces.values()) pc.mesh.traverse((o) => { if (o.isMesh) pieceMeshes.push(o); });
}

function removePiece(pc) {
  scene.remove(pc.mesh);
  pc.mesh.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  pc.mat.dispose();
  pieces.delete(pc.key);
  rebuildMeshList();
}

function clearPieces() { for (const pc of [...pieces.values()]) removePiece(pc); }

function damagePiece(key, dmg) {
  const pc = pieces.get(key);
  if (!pc) return;
  pc.hp -= dmg;
  if (pc.hp <= 0) { removePiece(pc); tone(120, 0.18, 'sawtooth', 0.04); return; }
  const k = pc.hp / pc.maxHp;
  pc.mat.color.setHex(pc.owner === 'me' ? 0x6fb6ff : 0xffb070).lerp(new THREE.Color(0x333333), 1 - k);
}

// ---------- entities ----------
function makeModel(color) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd7b0, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2238, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), body); torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin); head.position.y = 1.75;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.3), dark), legR = legL.clone();
  legL.geometry.translate(0, -0.375, 0); legR.geometry = legL.geometry;
  legL.position.set(-0.17, 0.75, 0); legR.position.set(0.17, 0.75, 0);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.7), dark); gun.position.set(0.3, 1.25, -0.4);
  const gunTip = new THREE.Object3D(); gunTip.position.set(0.3, 1.25, -0.8);
  g.add(torso, head, legL, legR, gun, gunTip);
  g.userData = { legL, legR, gun, head, gunTip };
  scene.add(g);
  return g;
}

function makeEntity(kind, name) {
  const e = { kind, name, x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, hp: HP_MAX, lives: LIVES, weapon: 'ar', cd: 0, grounded: true, support: null, walk: 0 };
  e.model = makeModel(kind === 'me' ? COL.me : COL.foe);
  return e;
}

let me = null, foe = null;

// ---------- physics ----------
function groundAt(e) {
  let h = 0, sup = null;
  for (const pc of pieces.values()) {
    if (pc.ramp) {
      const r = pc.ramp;
      if (e.x >= r.x0 - 0.15 && e.x <= r.x1 + 0.15 && e.z >= r.z0 - 0.15 && e.z <= r.z1 + 0.15) {
        const hh = r.y0 + clamp(rampT(r, e.x, e.z), 0, 1) * S;
        if (hh <= e.y + STEP && hh > h) { h = hh; sup = pc; }
      }
    } else {
      const b = pc.box;
      if (e.x >= b.x0 - 0.2 && e.x <= b.x1 + 0.2 && e.z >= b.z0 - 0.2 && e.z <= b.z1 + 0.2 && b.y1 <= e.y + STEP && b.y1 > h) { h = b.y1; sup = pc; }
    }
  }
  return { h, sup };
}

function resolveXZ(e) {
  for (let pass = 0; pass < 2; pass++) {
    for (const pc of pieces.values()) {
      const b = pc.box;
      if (!b) continue;
      if (!(e.y < b.y1 - STEP && e.y + PH > b.y0)) continue;
      const nx = clamp(e.x, b.x0, b.x1), nz = clamp(e.z, b.z0, b.z1);
      let dx = e.x - nx, dz = e.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= PR * PR) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * PR; e.z = nz + (dz / d) * PR;
      } else {
        const pushes = [[e.x - b.x0, -1, 0], [b.x1 - e.x, 1, 0], [e.z - b.z0, 0, -1], [b.z1 - e.z, 0, 1]].sort((p, q) => p[0] - q[0])[0];
        e.x += pushes[1] * (pushes[0] + PR); e.z += pushes[2] * (pushes[0] + PR);
      }
    }
  }
  e.x = clamp(e.x, -ARENA + PR, ARENA - PR);
  e.z = clamp(e.z, -ARENA + PR, ARENA - PR);
}

function stepPhysics(e, dt, wishX, wishZ, speed, jump) {
  const accel = e.grounded ? 14 : 5;
  e.vx += (wishX * speed - e.vx) * Math.min(1, accel * dt);
  e.vz += (wishZ * speed - e.vz) * Math.min(1, accel * dt);
  e.x += e.vx * dt; e.z += e.vz * dt;
  resolveXZ(e);
  const g = groundAt(e);
  if (jump && e.grounded) { e.vy = JUMP; e.grounded = false; }
  const prevHead = e.y + PH;
  e.vy -= GRAV * dt;
  e.y += e.vy * dt;
  if (e.vy > 0) {
    for (const pc of pieces.values()) {
      const b = pc.box;
      if (!b) continue;
      if (e.x > b.x0 - PR && e.x < b.x1 + PR && e.z > b.z0 - PR && e.z < b.z1 + PR && b.y0 >= prevHead - 0.02 && b.y0 < e.y + PH) {
        e.y = b.y0 - PH - 0.001; e.vy = 0;
      }
    }
  }
  if (e.vy <= 0 && e.y <= g.h) { e.y = g.h; e.vy = 0; e.grounded = true; }
  else if (e.grounded && e.vy <= 0 && e.y - g.h <= STEP) { e.y = g.h; e.vy = 0; }
  else e.grounded = e.y <= g.h + 0.02 && e.vy <= 0;
  e.support = e.grounded ? g.sup : null;
  e.walk += Math.hypot(e.vx, e.vz) * dt;
}

function separate(a, b) {
  if (!a || !b) return;
  if (Math.abs(a.y - b.y) > PH) return;
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
  if (d < PR * 2 && d > 1e-6) {
    const push = (PR * 2 - d) / 2;
    a.x -= (dx / d) * push; a.z -= (dz / d) * push;
    b.x += (dx / d) * push; b.z += (dz / d) * push;
  }
}

// ---------- shooting ----------
const raycaster = new THREE.Raycaster();
const _o = new THREE.Vector3(), _d = new THREE.Vector3();

function rayEntity(o, d, e, maxT) {
  // Capsule approximated by three body spheres plus a head sphere.
  let best = null;
  const tests = [[0.45, 0.45, false], [1.0, 0.45, false], [1.45, 0.4, false], [1.78, 0.28, true]];
  for (const [oy, r, head] of tests) {
    const cx = e.x - o.x, cy = e.y + oy - o.y, cz = e.z - o.z;
    const tc = cx * d.x + cy * d.y + cz * d.z;
    if (tc < 0 || tc > maxT) continue;
    const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
    if (d2 > r * r) continue;
    const t = tc - Math.sqrt(r * r - d2);
    if (!best || t < best.t) best = { t: Math.max(0, t), head };
  }
  return best;
}

function castShot(origin, dir, maxT, target, minT = 0) {
  raycaster.set(origin, dir);
  raycaster.near = minT; raycaster.far = maxT;
  const hits = raycaster.intersectObjects(pieceMeshes, false);
  const ph = hits[0] ? { t: hits[0].distance, piece: hits[0].object.userData.piece, point: hits[0].point } : null;
  const eh = target && target.hp > 0 ? rayEntity(origin, dir, target, maxT) : null;
  if (eh && (!ph || eh.t < ph.t)) return { kind: 'entity', t: eh.t, head: eh.head };
  if (ph) return { kind: 'piece', t: ph.t, piece: ph.piece };
  return { kind: 'none', t: maxT };
}

const tracers = [];
function tracer(from, to, color = 0xfff2a0) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  scene.add(line);
  tracers.push({ line, life: 0.07 });
}

function jitter(dir, spread, out) {
  out.copy(dir);
  if (spread) {
    out.x += (Math.random() - 0.5) * spread * 2; out.y += (Math.random() - 0.5) * spread * 2; out.z += (Math.random() - 0.5) * spread * 2;
    out.normalize();
  }
  return out;
}

const state = { phase: 'menu', mode: 'bot', timer: 0, round: 1, bot: null, online: null, paused: false };
let lastBanner = '';
function banner(text, sub = '') {
  const html = text ? `${text}${sub ? `<small>${sub}</small>` : ''}` : '';
  if (html !== lastBanner) { $('banner').innerHTML = html; lastBanner = html; }
}

// Fires for `shooter`; `origin`/`dir` are the aim ray. Returns true if it fired.
function fireWeapon(shooter, target, origin, dir, minT = 0) {
  const w = WEAPONS[shooter.weapon];
  if (shooter.cd > 0) return false;
  shooter.cd = w.cd;
  const range = w.range;
  const muzzle = new THREE.Vector3();
  const tip = shooter.model.userData.gunTip;
  tip.getWorldPosition(muzzle);
  if (w === WEAPONS.pick) { shooter.swing = 0.25; tone(180, 0.08, 'triangle'); }
  else tone(shooter.weapon === 'shotgun' ? 140 : 320, 0.1, 'square', 0.04);
  const local = shooter === me;
  const pellet = new THREE.Vector3();
  let entityDamage = 0, headshot = false;
  const ends = [];
  for (let i = 0; i < w.pellets; i++) {
    jitter(dir, w.spread, pellet);
    const hit = castShot(origin, pellet, range, target, minT);
    const point = origin.clone().addScaledVector(pellet, hit.t);
    ends.push(point);
    if (hit.kind === 'entity') {
      const fall = shooter.weapon === 'shotgun' ? clamp(1.2 - hit.t / 40, 0.35, 1) : 1;
      entityDamage += w.dmg * fall * (hit.head ? 1.5 : 1);
      headshot ||= hit.head;
    } else if (hit.kind === 'piece') {
      damagePiece(hit.piece.key, w.sdmg);
      if (local && state.online) state.online.send.ph({ k: hit.piece.key, d: w.sdmg });
    }
  }
  if (w !== WEAPONS.pick) for (const p of ends.slice(0, 3)) tracer(muzzle, p);
  if (local && state.online && w !== WEAPONS.pick) state.online.send.sh({ o: [muzzle.x, muzzle.y, muzzle.z], e: ends.slice(0, 3).map((p) => [p.x, p.y, p.z]) });
  if (entityDamage > 0 && target) {
    entityDamage = Math.round(entityDamage);
    if (local) {
      $('crosshair').classList.add('hit');
      setTimeout(() => $('crosshair').classList.remove('hit'), 90);
      tone(headshot ? 900 : 600, 0.06, 'sine', 0.05);
    }
    if (target.kind === 'remote') state.online.send.ht({ d: entityDamage });
    else hurt(target, entityDamage);
  }
  return true;
}

function hurt(e, dmg) {
  if (state.phase !== 'fight' || e.hp <= 0) return;
  e.hp = Math.max(0, e.hp - dmg);
  e.lastHurt = performance.now();
  if (e === me) {
    $('damage').classList.add('on');
    setTimeout(() => $('damage').classList.remove('on'), 160);
    if (e.hp <= 0) { if (state.online) state.online.send.dd({}); roundOver(e); }
  } else if (e.hp <= 0) roundOver(e);
}

// ---------- round flow ----------
const spawns = () => {
  const aFirst = state.mode !== 'online' || state.online?.seatA;
  return aFirst ? [{ x: -22, z: 0, yaw: -Math.PI / 2 }, { x: 22, z: 0, yaw: Math.PI / 2 }] : [{ x: 22, z: 0, yaw: Math.PI / 2 }, { x: -22, z: 0, yaw: -Math.PI / 2 }];
};

function place(e, s) {
  Object.assign(e, { x: s.x, z: s.z, y: 0, vx: 0, vz: 0, vy: 0, yaw: s.yaw, pitch: 0, hp: HP_MAX, cd: 0, grounded: true, support: null, weapon: e === me ? me.weapon : 'ar' });
  e.model.visible = true;
}

function startRound() {
  clearPieces();
  const [a, b] = spawns();
  place(me, a);
  aim.yaw = a.yaw; aim.pitch = 0;
  if (foe) { place(foe, b); foe.tx = null; }
  state.phase = 'countdown';
  state.timer = 3;
  if (state.bot) state.bot.reset();
}

function newMatch() {
  me.lives = LIVES;
  if (foe) foe.lives = LIVES;
  state.round = 1;
  startRound();
}

function roundOver(loser) {
  if (state.phase !== 'fight') return;
  loser.lives--;
  state.phase = 'roundEnd';
  state.timer = 2.6;
  loser.model.visible = loser === me ? true : false;
  const iWon = loser !== me;
  tone(iWon ? 700 : 200, 0.3, 'triangle', 0.06);
  banner(iWon ? 'ELIMINATED' : 'YOU WERE ELIMINATED', loser.lives > 0 ? `${loser.lives} ${loser.lives === 1 ? 'life' : 'lives'} left` : 'Final blow');
}

function afterRoundEnd() {
  if (me.lives <= 0 || (foe && foe.lives <= 0)) {
    state.phase = 'matchEnd';
    const won = me.lives > 0;
    banner(won ? 'VICTORY' : 'DEFEAT', 'Press Enter for a rematch');
    return;
  }
  state.round++;
  startRound();
}

// ---------- bot ----------
const LEVELS = {
  easy: { turn: 4, err: 0.09, burst: 0.7, range: 15, build: 0.5 },
  normal: { turn: 7, err: 0.045, burst: 0.45, range: 14, build: 0.9 },
  hard: { turn: 11, err: 0.02, burst: 0.25, range: 12, build: 1.4 },
};
function makeBot(level) {
  const L = LEVELS[level] ?? LEVELS.normal;
  const bot = {
    L, strafe: 1, strafeT: 1, burst: 0, rest: 0.6, buildCd: 1.5, lastHp: HP_MAX, jump: false,
    reset() { this.burst = 0; this.rest = 1.0; this.buildCd = 1.5; this.lastHp = HP_MAX; },
    update(b, dt) {
      const t = me;
      const dx = t.x - b.x, dz = t.z - b.z, dist = Math.hypot(dx, dz);
      const wantYaw = Math.atan2(-dx, -dz);
      const wantPitch = Math.atan2((t.y + 1.1) - (b.y + EYE), Math.max(1, dist));
      let dy = wantYaw - b.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      b.yaw += dy * Math.min(1, dt * L.turn);
      b.pitch += (wantPitch - b.pitch) * Math.min(1, dt * L.turn);
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.7 + Math.random() * 1.5; if (Math.random() < 0.4) this.jump = true; }
      const want = state.phase !== 'fight' ? 0 : dist > L.range ? 1 : dist < L.range * 0.45 ? -1 : 0.2;
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
      const sx = (fx * want + rx * this.strafe * 0.7), sz = (fz * want + rz * this.strafe * 0.7);
      const n = Math.hypot(sx, sz) || 1;
      const jump = this.jump && b.grounded; this.jump = false;
      stepPhysics(b, dt, state.phase === 'fight' ? sx / n * Math.min(1, n) : 0, state.phase === 'fight' ? sz / n * Math.min(1, n) : 0, WALK * 0.95, jump);
      if (state.phase !== 'fight') return;
      // Build to defend after taking damage, and ramp up when the player is higher.
      this.buildCd -= dt * L.build;
      if (b.hp < this.lastHp - 1 && this.buildCd <= 0) { this.place('w', b); this.buildCd = 1.6; }
      else if (t.y - b.y > 2.6 && this.buildCd <= 0 && dist < 18) { this.place('r', b); this.buildCd = 0.8; }
      else if (this.buildCd <= -4 && dist > 8) { this.place('w', b); this.buildCd = 2.5; }
      this.lastHp = b.hp;
      // Shooting.
      b.weapon = dist < 8.5 ? 'shotgun' : 'ar';
      if (this.rest > 0) { this.rest -= dt; return; }
      const aim = Math.abs(dy);
      if (aim < 0.12 && dist < 60) {
        _o.set(b.x, b.y + EYE, b.z);
        _d.set(t.x - b.x, (t.y + 1.0) - (b.y + EYE), t.z - b.z).normalize();
        _d.x += (Math.random() - 0.5) * L.err; _d.y += (Math.random() - 0.5) * L.err; _d.z += (Math.random() - 0.5) * L.err;
        _d.normalize();
        if (fireWeapon(b, t, _o.clone(), _d.clone())) {
          this.burst += b.weapon === 'ar' ? 1 : 6;
          if (this.burst >= 6) { this.burst = 0; this.rest = L.burst + Math.random() * 0.5; }
        }
      }
    },
    place(type, b) {
      const sp = planBuild(type, { x: b.x, y: b.y, z: b.z, yaw: b.yaw, support: b.support });
      addPiece(sp, 'foe');
    },
  };
  return bot;
}

// ---------- input ----------
const keys = new Set();
let wantFire = false;
const aim = { yaw: 0, pitch: 0 };
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  keys.add(e.code);
  if (/^(Space|Arrow)/.test(e.code)) e.preventDefault();
  if (state.phase === 'matchEnd' && e.code === 'Escape') quitToMenu();
  if (state.phase === 'matchEnd' && e.code === 'Enter' && (!state.online || state.online.peer)) { if (state.online) state.online.send.rm({}); newMatch(); }
  if (!e.repeat && me && state.phase !== 'menu') {
    if (e.code === 'Digit1') selectWeapon('pick');
    if (e.code === 'Digit2') selectWeapon('shotgun');
    if (e.code === 'Digit3') selectWeapon('ar');
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); wantFire = false; });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || !me) return;
  aim.yaw -= e.movementX * 0.0022;
  aim.pitch = clamp(aim.pitch - e.movementY * 0.0022, -1.3, 1.3);
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (state.phase !== 'menu' && !NOLOCK && document.pointerLockElement !== canvas) { lock(); return; }
  wantFire = true;
});
addEventListener('mouseup', () => { wantFire = false; });
addEventListener('wheel', (e) => {
  if (!me || state.phase === 'menu') return;
  const order = ['pick', 'shotgun', 'ar'];
  selectWeapon(order[(order.indexOf(me.weapon) + (e.deltaY > 0 ? 1 : 2)) % 3]);
});
function selectWeapon(w) {
  me.weapon = w;
  for (const s of document.querySelectorAll('.slot')) s.classList.toggle('on', s.dataset.w === w);
}
function lock() { if (!NOLOCK) canvas.requestPointerLock?.(); }
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && state.phase !== 'menu' && state.phase !== 'matchEnd') { state.paused = true; $('pause').hidden = false; }
  if (locked) { state.paused = false; $('pause').hidden = true; }
});
$('resume').onclick = () => { state.paused = false; $('pause').hidden = true; lock(); };
$('quit').onclick = () => { $('pause').hidden = true; quitToMenu(); };

let buildCd = 0;
const buildKeys = { KeyQ: 'w', KeyF: 'f', KeyC: 'r', KeyV: 'c' };
function tryBuild(dt) {
  buildCd -= dt;
  if (buildCd > 0 || state.phase !== 'fight') return;
  for (const [code, type] of Object.entries(buildKeys)) {
    if (!keys.has(code)) continue;
    const sp = planBuild(type, { x: me.x, y: me.y, z: me.z, yaw: aim.yaw, support: me.support });
    if (addPiece(sp, 'me')) {
      tone(type === 'w' ? 260 : 330, 0.05, 'triangle', 0.03);
      if (state.online) state.online.send.bd({ sp });
    }
    buildCd = 0.14;
    return;
  }
}

// ---------- online ----------
const validSpec = (sp) => {
  if (!sp || typeof sp !== 'object' || !['w', 'f', 'r', 'c'].includes(sp.t)) return false;
  const ints = sp.t === 'w' ? [sp.i, sp.j, sp.gy] : sp.t === 'r' ? [sp.gx, sp.gy, sp.gz, sp.d] : [sp.gx, sp.gy, sp.gz];
  return ints.every((n) => Number.isInteger(n) && Math.abs(n) < 100) && (sp.t !== 'w' || sp.ax === 'x' || sp.ax === 'z') && (sp.t !== 'r' || (sp.d >= 0 && sp.d < 4));
};

async function joinOnline(room, name) {
  $('status').textContent = `Connecting to room ${room}…`;
  const lib = await import('../../vendor/trystero.js');
  const r = lib.joinRoom({ appId: 'julianattemptscoding-retro-room-buildfight-v1' }, 'bf-' + room);
  const net = { room: r, room_name: room, peer: null, nonce: Math.random(), seatA: true, send: {}, ready: false, lastSend: 0 };
  const acts = {};
  for (const n of ['st', 'bd', 'ht', 'ph', 'sh', 'dd', 'hi', 'rm']) acts[n] = r.makeAction(n);
  const safe = (n) => (data, opts) => Promise.resolve().then(() => acts[n].send(data, opts)).catch(() => {});
  for (const n of Object.keys(acts)) net.send[n] = safe(n);
  r.onPeerJoin = (id) => {
    if (net.peer && net.peer !== id) return;
    net.peer = id;
    net.send.hi({ name, nonce: net.nonce }, { target: id });
    $('status').textContent = 'Friend found — handshaking…';
  };
  r.onPeerLeave = (id) => {
    if (id !== net.peer) return;
    net.peer = null; net.ready = false;
    if (state.phase !== 'menu') { banner('OPPONENT LEFT', 'Press Esc to return to the menu'); state.phase = 'matchEnd'; }
    else $('status').textContent = 'Friend left the room.';
  };
  acts.hi.onMessage = (d, { peerId }) => {
    if (peerId !== net.peer || !d) return;
    net.seatA = net.nonce > Number(d.nonce);
    if (!net.ready) { net.ready = true; startMatch('online'); }
    foe.name = String(d.name || 'Friend').slice(0, 14);
  };
  acts.st.onMessage = (d, { peerId }) => {
    if (peerId !== net.peer || !foe || !Array.isArray(d)) return;
    foe.tx = { x: +d[0], y: +d[1], z: +d[2], yaw: +d[3], pitch: +d[4] };
    foe.weapon = ['pick', 'shotgun', 'ar'][d[5]] ?? 'ar';
    if (foe.x === 0 && foe.z === 0 || state.phase === 'countdown') Object.assign(foe, foe.tx);
  };
  acts.bd.onMessage = (d, { peerId }) => { if (peerId === net.peer && validSpec(d?.sp)) addPiece(d.sp, 'foe'); };
  acts.ph.onMessage = (d, { peerId }) => { if (peerId === net.peer && d) damagePiece(String(d.k), Number(d.d) || 0); };
  acts.ht.onMessage = (d, { peerId }) => { if (peerId === net.peer && d && state.phase === 'fight') hurt(me, clamp(Number(d.d) || 0, 0, 120)); };
  acts.dd.onMessage = (d, { peerId }) => { if (peerId === net.peer && state.phase === 'fight') { foe.hp = 0; roundOver(foe); } };
  acts.rm.onMessage = (d, { peerId }) => { if (peerId === net.peer && state.phase === 'matchEnd') newMatch(); };
  acts.sh.onMessage = (d, { peerId }) => {
    if (peerId !== net.peer || !d?.o) return;
    const from = new THREE.Vector3(...d.o);
    for (const e of d.e ?? []) tracer(from, new THREE.Vector3(...e), 0xffc080);
    tone(260, 0.08, 'square', 0.03);
  };
  state.online = net;
  $('status').textContent = `Room ${room} ready — share the room code with a friend and wait for them to join.`;
}

function netTick(dt) {
  const net = state.online;
  if (!net || !net.peer || !me) return;
  net.lastSend += dt;
  if (net.lastSend >= 0.05) {
    net.lastSend = 0;
    const r = (v) => Math.round(v * 100) / 100;
    net.send.st([r(me.x), r(me.y), r(me.z), r(me.yaw), r(me.pitch), ['pick', 'shotgun', 'ar'].indexOf(me.weapon), Math.round(me.hp)]);
  }
}

// ---------- game setup ----------
function startMatch(mode) {
  state.mode = mode;
  me ??= makeEntity('me', 'You');
  if (foe) { scene.remove(foe.model); foe = null; }
  if (mode === 'bot') { foe = makeEntity('foe', 'Bot'); state.bot = makeBot($('diff').value); }
  else if (mode === 'online') { foe = makeEntity('remote', 'Friend'); state.bot = null; }
  else { state.bot = null; }
  me.name = $('nameIn').value.trim().slice(0, 14) || 'Player';
  selectWeapon('ar');
  $('menu').hidden = true; $('hud').hidden = false;
  $('net').textContent = mode === 'online' ? `Room ${state.online.room_name} — online` : mode === 'practice' ? 'Practice — no opponent' : `Vs bot (${$('diff').value})`;
  newMatch();
  if (mode === 'practice') { state.phase = 'fight'; banner(''); }
  lock();
}

function quitToMenu() {
  if (document.pointerLockElement) document.exitPointerLock?.();
  if (state.online) { state.online.room.leave(); state.online = null; }
  clearPieces();
  if (foe) { scene.remove(foe.model); foe = null; }
  state.phase = 'menu'; state.paused = false; state.bot = null;
  banner('');
  $('hud').hidden = true; $('menu').hidden = false;
  if (me) me.model.visible = false;
  $('status').textContent = '';
  $('startOnline').disabled = false;
}

$('startBot').onclick = () => startMatch('bot');
$('startPractice').onclick = () => startMatch('practice');
$('startOnline').onclick = async () => {
  const room = ($('roomIn').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || Math.random().toString(36).slice(2, 6).toUpperCase();
  $('roomIn').value = room;
  $('startOnline').disabled = true;
  try {
    me ??= makeEntity('me', 'You'); me.model.visible = false;
    await joinOnline(room, $('nameIn').value.trim().slice(0, 14) || 'Player');
  } catch (err) {
    console.error(err);
    $('status').textContent = 'Could not start online play. Check your connection and try again.';
    $('startOnline').disabled = false;
  }
};
if (params.get('name')) $('nameIn').value = params.get('name').slice(0, 14);
if (params.get('room')) $('roomIn').value = params.get('room');
if (params.get('diff')) $('diff').value = params.get('diff');

// ---------- main loop ----------
const _cam = new THREE.Vector3(), _dir = new THREE.Vector3(), _eye = new THREE.Vector3();
function updateModel(e, dt) {
  const m = e.model, u = m.userData;
  m.position.set(e.x, e.y, e.z);
  m.rotation.y = e.yaw;
  const sw = Math.sin(e.walk * 2.4) * clamp(Math.hypot(e.vx, e.vz) / 6, 0, 1) * 0.7;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  u.head.rotation.x = e.pitch * 0.6;
  u.gun.rotation.x = e.pitch * 0.5 + (e.swing > 0 ? -0.9 : 0);
  if (e.swing > 0) e.swing -= dt;
  u.gun.scale.set(1, 1, e.weapon === 'pick' ? 0.8 : e.weapon === 'shotgun' ? 1 : 1.3);
}

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last ?? now)) / 1000);
  frame.last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function update(dt) {
  for (const t of tracers) t.life -= dt;
  while (tracers.length && tracers[0].life <= 0) { const t = tracers.shift(); scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
  if (state.phase === 'menu' || !me || (state.paused && state.mode !== 'online')) return;

  if (state.phase === 'countdown') {
    state.timer -= dt;
    banner(state.timer > 0 ? String(Math.ceil(state.timer)) : 'FIGHT!', `Round ${state.round}`);
    if (state.timer <= 0) { state.phase = 'fight'; state.timer = 0.6; }
  } else if (state.phase === 'fight' && state.timer > 0) {
    state.timer -= dt;
    if (state.timer <= 0 && state.mode !== 'practice') banner('');
  } else if (state.phase === 'roundEnd') {
    state.timer -= dt;
    if (state.timer <= 0) afterRoundEnd();
  }

  const live = state.phase === 'fight' || state.phase === 'roundEnd' && me.hp > 0;
  // Local player.
  me.yaw = aim.yaw; me.pitch = aim.pitch;
  const fx = -Math.sin(aim.yaw), fz = -Math.cos(aim.yaw), rx = Math.cos(aim.yaw), rz = -Math.sin(aim.yaw);
  let mx = 0, mz = 0;
  if (live) {
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0), s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    mx = fx * f + rx * s; mz = fz * f + rz * s;
    const n = Math.hypot(mx, mz);
    if (n > 1) { mx /= n; mz /= n; }
  }
  me.cd = Math.max(0, me.cd - dt);
  stepPhysics(me, dt, mx, mz, keys.has('ShiftLeft') ? SPRINT : WALK, live && keys.has('Space'));
  if (live && state.phase === 'fight') tryBuild(dt);

  // Camera ray for aiming.
  cameraRig();
  if (live && state.phase === 'fight' && (wantFire || (NOLOCK && keys.has('KeyJ')))) {
    const w = WEAPONS[me.weapon];
    if (w.auto || !fire.held) {
      fire.held = true;
      const eye = _eye.set(me.x, me.y + EYE, me.z);
      if (me.weapon === 'pick') fireWeapon(me, foe, eye.clone(), _dir.clone().normalize(), 0);
      else fireWeapon(me, foe, _cam.clone(), _dir.clone().normalize(), _cam.distanceTo(eye) * 0.85);
    }
  } else fire.held = false;

  // Opponent.
  if (foe) {
    if (state.bot) {
      foe.cd = Math.max(0, foe.cd - dt);
      state.bot.update(foe, dt);
    } else if (foe.kind === 'remote' && foe.tx) {
      const k = Math.min(1, dt * 16);
      foe.x += (foe.tx.x - foe.x) * k; foe.y += (foe.tx.y - foe.y) * k; foe.z += (foe.tx.z - foe.z) * k;
      let dy = foe.tx.yaw - foe.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      foe.yaw += dy * k; foe.pitch += (foe.tx.pitch - foe.pitch) * k;
      foe.vx = (foe.tx.x - foe.x) * 6; foe.vz = (foe.tx.z - foe.z) * 6;
      foe.walk += Math.hypot(foe.vx, foe.vz) * dt;
      foe.model.visible = foe.hp > 0 || state.phase === 'fight';
    }
    if (state.bot) separate(me, foe);
    updateModel(foe, dt);
  }
  updateModel(me, dt);
  netTick(dt);
  hud();
}
const fire = { held: false };

function cameraRig() {
  const cp = Math.cos(aim.pitch);
  _dir.set(-Math.sin(aim.yaw) * cp, Math.sin(aim.pitch), -Math.cos(aim.yaw) * cp);
  _eye.set(me.x, me.y + EYE, me.z);
  const rx = Math.cos(aim.yaw), rz = -Math.sin(aim.yaw);
  const back = 3.6;
  _cam.set(_eye.x - _dir.x * back + rx * 0.8, _eye.y - _dir.y * back + 0.3, _eye.z - _dir.z * back + rz * 0.8);
  // Pull the camera in when something is between it and the player.
  const toCam = _cam.clone().sub(_eye);
  const len = toCam.length();
  raycaster.set(_eye, toCam.clone().normalize());
  raycaster.near = 0; raycaster.far = len;
  const hit = raycaster.intersectObjects(pieceMeshes, false)[0];
  if (hit) _cam.copy(_eye).addScaledVector(toCam.normalize(), Math.max(0.6, hit.distance - 0.3));
  _cam.y = Math.max(0.3, _cam.y);
}

function render() {
  if (me && state.phase !== 'menu') {
    camera.position.copy(_cam);
    camera.lookAt(_cam.clone().addScaledVector(_dir, 30));
  } else {
    camera.position.set(0, 14, 30); camera.lookAt(0, 3, 0);
  }
  renderer.render(scene, camera);
}

function hud() {
  $('hpBar').style.width = `${(me.hp / HP_MAX) * 100}%`;
  $('hpBar').style.background = me.hp > 50 ? 'linear-gradient(90deg,#2fe27a,#8cf56a)' : me.hp > 25 ? 'linear-gradient(90deg,#ffb02f,#ffd45a)' : 'linear-gradient(90deg,#ff3a3a,#ff7a5a)';
  $('hpText').textContent = Math.ceil(me.hp);
  const hearts = (n) => '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, LIVES - n));
  $('meLives').textContent = `${me.name} ${hearts(me.lives)}`;
  $('foeLives').textContent = foe ? `${hearts(foe.lives)} ${foe.name}` : '';
  $('roundTxt').textContent = state.mode === 'practice' ? 'PRACTICE' : `ROUND ${state.round}`;
  if (!NOLOCK && !state.paused && document.pointerLockElement !== canvas) $('net').textContent = 'Click the game to capture the mouse';
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// Test hook so automated QA can drive and inspect the game without reading pixels.
window.__bf = {
  state, pieces, aim, keys, planBuild, addPiece, WEAPONS,
  get me() { return me; }, get foe() { return foe; },
  startMatch, step: update, rampT,
};
requestAnimationFrame(frame);

if (params.get('mode') === 'bot') startMatch('bot');
else if (params.get('mode') === 'practice') startMatch('practice');
else if (params.get('autojoin') && params.get('room')) $('startOnline').click();
