import { GAMES, CATEGORIES, MODES, byId } from './catalog.js';

const $ = (sel, root = document) => root.querySelector(sel);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};

const state = { q: '', mode: '', cat: '', sort: 'featured', favOnly: false };
let favs = new Set(store.get('rgl.favs', []));
let recent = store.get('rgl.recent', []);

const modeLabel = Object.fromEntries(MODES.map((m) => [m.id, m]));
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const k of kids.flat()) if (k != null) node.append(k);
  return node;
};

function playUrl(game) {
  if (game.link) return game.link;
  return `play.html?g=${encodeURIComponent(game.id)}`;
}

function matches(game) {
  if (state.mode && !game.modes.includes(state.mode)) return false;
  if (state.cat && game.category !== state.cat) return false;
  if (state.favOnly && !favs.has(game.id)) return false;
  if (state.q) {
    const hay = [game.title, game.tagline, game.category, game.modes.join(' '), game.source.label].join(' ').toLowerCase();
    return state.q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
  }
  return true;
}

function sorted(list) {
  const out = [...list];
  const unplayable = (g) => (g.status === 'unavailable' ? 2 : g.status === 'external' ? 1 : 0);
  if (state.sort === 'az') out.sort((a, b) => a.title.localeCompare(b.title));
  else if (state.sort === 'stars') out.sort((a, b) => (b.source.stars ?? -1) - (a.source.stars ?? -1));
  else out.sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
  return out.sort((a, b) => unplayable(a) - unplayable(b));
}

function thumb(game, className = 'thumb') {
  const t = el('div', { className });
  t.style.setProperty('--h', game.hue ?? 220);
  t.append(el('span', { className: 'emoji', textContent: game.emoji, ariaHidden: 'true' }));
  const img = el('img', { alt: '', loading: 'lazy', src: `thumbs/${game.id}.jpg` });
  img.onerror = () => img.remove();
  t.append(img);
  return t;
}

function badgesFor(game) {
  const box = el('div', { className: 'badges' });
  if (game.status === 'rom') box.append(el('span', { className: 'badge rom', textContent: 'Bring ROM' }));
  if (game.status === 'external') box.append(el('span', { className: 'badge ext', textContent: 'External site' }));
  if (game.status === 'unavailable') box.append(el('span', { className: 'badge off', textContent: 'Shut down' }));
  return box;
}

function card(game) {
  const open = () => openDetail(game.id);
  const wrap = el('div', { className: `card${game.status === 'unavailable' ? ' disabled' : ''}`, tabIndex: 0, role: 'listitem' });
  wrap.setAttribute('aria-label', `${game.title}. ${game.tagline}`);
  const th = thumb(game);
  th.append(badgesFor(game));
  const fav = el('button', { className: 'fav', type: 'button', textContent: '♥', title: 'Favorite' });
  fav.setAttribute('aria-pressed', String(favs.has(game.id)));
  fav.setAttribute('aria-label', `Favorite ${game.title}`);
  fav.onclick = (e) => { e.stopPropagation(); toggleFav(game.id); };
  fav.onkeydown = (e) => e.stopPropagation();
  th.append(fav);
  wrap.append(
    th,
    el('div', { className: 'body' },
      el('h3', { textContent: game.title }),
      el('p', { textContent: game.tagline }),
      el('div', { className: 'modes' }, game.modes.map((m) => el('span', { textContent: `${modeLabel[m].icon} ${modeLabel[m].label}` }))),
    ),
  );
  wrap.onclick = open;
  wrap.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  return wrap;
}

function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  store.set('rgl.favs', [...favs]);
  render();
  const d = $('#detail');
  if (d.open) $('.d-fav', d)?.setAttribute('aria-pressed', String(favs.has(id)));
}

function chip(label, pressed, onClick, count) {
  const b = el('button', { className: 'chip', type: 'button' }, label, count != null ? el('span', { className: 'n', textContent: count }) : null);
  b.setAttribute('aria-pressed', String(pressed));
  b.onclick = onClick;
  return b;
}

function renderChips() {
  const base = (g) => (state.cat ? g.category === state.cat : true);
  const baseCat = (g) => (state.mode ? g.modes.includes(state.mode) : true);
  const modeBox = $('#modeChips'); modeBox.replaceChildren(
    chip('All', !state.mode, () => setState({ mode: '' })),
    ...MODES.map((m) => chip(`${m.icon} ${m.label}`, state.mode === m.id, () => setState({ mode: state.mode === m.id ? '' : m.id }), GAMES.filter((g) => base(g) && g.modes.includes(m.id) && g.status !== 'unavailable').length)),
  );
  const catBox = $('#catChips'); catBox.replaceChildren(
    chip('All', !state.cat, () => setState({ cat: '' })),
    ...CATEGORIES.map((c) => chip(c.label, state.cat === c.id, () => setState({ cat: state.cat === c.id ? '' : c.id }), GAMES.filter((g) => baseCat(g) && g.category === c.id && g.status !== 'unavailable').length)),
  );
}

function render() {
  renderChips();
  const list = sorted(GAMES.filter(matches));
  $('#grid').replaceChildren(...list.map(card));
  $('#empty').hidden = list.length > 0;
  const active = state.q || state.mode || state.cat || state.favOnly;
  $('#clear').hidden = !active;
  const playable = GAMES.filter((g) => g.status === 'playable').length;
  const online = GAMES.filter((g) => g.modes.includes('online') && g.status === 'playable').length;
  const local = GAMES.filter((g) => g.modes.includes('local') && g.status !== 'unavailable').length;
  $('#stats').replaceChildren(
    ...[[playable, 'games ready offline'], [local, 'with local multiplayer'], [online, 'with online rooms'], [list.length, 'shown']].map(([n, t]) => el('span', { className: 'stat' }, el('b', { textContent: n }), ` ${t}`)),
  );
  const recents = recent.map((id) => byId[id]).filter((g) => g && g.status !== 'unavailable').slice(0, 8);
  $('#recentWrap').hidden = recents.length === 0 || !!active;
  $('#recent').replaceChildren(...recents.map(card));
}

function syncUrl() {
  const p = new URLSearchParams();
  for (const k of ['q', 'mode', 'cat']) if (state[k]) p.set(k, state[k]);
  if (state.sort !== 'featured') p.set('sort', state.sort);
  if (state.favOnly) p.set('fav', '1');
  const s = p.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname);
}

function setState(patch) {
  Object.assign(state, patch);
  syncUrl();
  render();
}

function openDetail(id) {
  const g = byId[id];
  const d = $('#detail');
  const th = thumb(g, 'thumb d-thumb');
  th.append(badgesFor(g));
  const close = el('button', { className: 'btn close', type: 'button', textContent: '✕', ariaLabel: 'Close' });
  close.onclick = () => d.close();

  const actions = el('div', { className: 'd-actions' });
  if (g.status === 'unavailable') {
    if (g.alternative) {
      const alt = byId[g.alternative];
      actions.append(el('button', { className: 'btn primary big', type: 'button', textContent: `Play ${alt.title} instead`, onclick: () => { d.close(); openDetail(alt.id); } }));
    }
    if (g.link) actions.append(el('a', { className: 'btn', href: g.link, target: '_blank', rel: 'noopener', textContent: g.linkLabel }));
  } else if (g.status === 'external') {
    actions.append(el('a', { className: 'btn primary big', href: g.link, target: '_blank', rel: 'noopener', textContent: `${g.linkLabel} ↗` }));
    if (g.alternative) {
      const alt = byId[g.alternative];
      actions.append(el('button', { className: 'btn', type: 'button', textContent: `Offline: ${alt.title}`, onclick: () => { d.close(); openDetail(alt.id); } }));
    }
  } else {
    actions.append(el('a', { className: 'btn primary big', href: playUrl(g), textContent: g.status === 'rom' ? '▶ Open emulator' : '▶ Play now' }));
    if (g.modes.includes('online')) actions.append(el('span', { className: 'note', textContent: 'Open the game, then use its room panel to invite friends.' }));
  }
  const fav = el('button', { className: 'btn d-fav', type: 'button', textContent: '♥ Favorite', onclick: () => toggleFav(g.id) });
  fav.setAttribute('aria-pressed', String(favs.has(g.id)));
  actions.append(fav);

  const stars = g.source.stars ? `${g.source.stars.toLocaleString()} ★` : '—';
  const body = el('div', { className: 'd-body' },
    el('h2', { id: 'dTitle', textContent: g.title }),
    el('p', { className: 'tag', textContent: g.tagline }),
    actions,
    g.notes ? el('div', { className: 'note', textContent: g.notes }) : null,
    g.controls?.length ? el('div', {},
      el('h3', { textContent: 'Controls' }),
      el('table', { className: 'controls' }, el('tbody', {}, g.controls.map(([k, v]) => el('tr', {}, el('td', {}, el('kbd', { textContent: k })), el('td', { textContent: v })))))) : null,
    el('div', { className: 'meta' },
      el('div', {}, el('small', { textContent: 'Players' }), g.modes.map((m) => modeLabel[m].label).join(', ')),
      el('div', {}, el('small', { textContent: 'Input' }), g.input.join(', ')),
      el('div', {}, el('small', { textContent: 'License' }), g.source.license),
      el('div', {}, el('small', { textContent: 'Source' }), el('a', { href: g.source.url, target: '_blank', rel: 'noopener', textContent: `${g.source.label} · ${stars}` })),
    ),
  );
  d.replaceChildren(close, th, body);
  d.dataset.id = g.id;
  if (!d.open) d.showModal();
  history.replaceState(null, '', `#${g.id}`);
}

function setup() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') ?? '';
  state.mode = MODES.some((m) => m.id === p.get('mode')) ? p.get('mode') : '';
  state.cat = CATEGORIES.some((c) => c.id === p.get('cat')) ? p.get('cat') : '';
  state.sort = ['az', 'stars'].includes(p.get('sort')) ? p.get('sort') : 'featured';
  state.favOnly = p.get('fav') === '1';
  $('#q').value = state.q; $('#sort').value = state.sort; $('#favOnly').checked = state.favOnly;

  $('#q').oninput = (e) => setState({ q: e.target.value.trim() });
  $('#sort').onchange = (e) => setState({ sort: e.target.value });
  $('#favOnly').onchange = (e) => setState({ favOnly: e.target.checked });
  const clear = () => { $('#q').value = ''; $('#favOnly').checked = false; setState({ q: '', mode: '', cat: '', favOnly: false }); };
  $('#clear').onclick = clear; $('#emptyClear').onclick = clear;
  const random = () => {
    const pool = sorted(GAMES.filter((g) => g.status === 'playable' || g.status === 'rom')).filter((g) => g.status === 'playable');
    openDetail(pool[Math.floor(Math.random() * pool.length)].id);
  };
  $('#random').onclick = random;
  $('#help').onclick = () => $('#helpDlg').showModal();
  const root = document.documentElement;
  root.dataset.theme = store.get('rgl.theme', matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  $('#theme').onclick = () => { root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light'; store.set('rgl.theme', root.dataset.theme); };

  for (const dlg of document.querySelectorAll('dialog')) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }
  $('#detail').addEventListener('close', () => history.replaceState(null, '', location.pathname + location.search));

  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); $('#q').focus(); $('#q').select(); }
    else if (e.key === 'Escape' && typing) document.activeElement.blur();
    else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]')) {
      if (e.key.toLowerCase() === 'r') random();
      if (e.key.toLowerCase() === 'f') { $('#favOnly').checked = !state.favOnly; setState({ favOnly: !state.favOnly }); }
    }
  });
  render();
  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const d = $('#detail');
    if (byId[id]) { if (!d.open || d.dataset.id !== id) openDetail(id); }
    else if (d.open) d.close();
  };
  addEventListener('hashchange', fromHash);
  fromHash();
}

setup();
