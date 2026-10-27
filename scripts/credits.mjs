// Regenerates CREDITS.md from the catalog and the pinned import data.
import fs from 'node:fs';
import { GAMES } from '../public/catalog.js';

const pins = Object.fromEntries(JSON.parse(fs.readFileSync('data/import-research.json', 'utf8')).map((p) => [p.id, p]));
const rows = GAMES.filter((g) => g.status !== 'unavailable').map((g) => {
  const pin = pins[g.id];
  const commit = pin ? `[\`${pin.commit.slice(0, 7)}\`](https://github.com/${pin.repo}/commit/${pin.commit})` : '—';
  const stars = g.source.stars ? g.source.stars.toLocaleString('en-US') : '—';
  return `| ${g.title} | [${g.source.label}](${g.source.url}) | ${g.source.license} | ${stars} | ${commit} |`;
});

fs.writeFileSync('CREDITS.md', `# Credits

Every bundled game is the work of its original authors and stays under its original license (a copy sits in each
\`public/games/<id>/\` folder). Star counts were read from GitHub on 2026-10-27 and are only a rough signal of how
established a project is. "Pinned commit" is the exact upstream revision that was copied.

| Game | Source | License | Stars | Pinned commit |
| --- | --- | --- | ---: | --- |
${rows.join('\n')}

Games marked "Original" are written for this repository and are MIT licensed. *Slope (remake)* and *1v1 Build Fight* are
from-scratch remakes of the public gameplay of Slope (Y8, closed source, <https://www.y8.com/games/slope>) and 1v1.LOL
(permanently shut down by its publisher on 3 Nov 2025, [announcement](https://1v1lol.statuspage.io/)). They share no code or
assets with those games and are not affiliated with their publishers or with Epic Games.

## Console emulation

[EmulatorJS](https://github.com/EmulatorJS/EmulatorJS) v4.2.3 (GPL-3.0) with the snes9x, mGBA and Mupen64Plus-Next cores,
pinned in \`public/games/console/emulator/MANIFEST.json\` with SHA-256 hashes; core licenses are in
\`CORE-LICENSES/\`. **No ROMs or BIOS files are included.** Mario Kart (and anything else) only runs if you supply a
file you legally own; it is read locally by your browser and never uploaded.

## Libraries built into \`public/vendor\` at build time

[Trystero](https://github.com/dmotz/trystero) (MIT, peer-to-peer rooms), [chess.js](https://github.com/jhlywa/chess.js)
(BSD-2-Clause), and [three.js](https://github.com/mrdoob/three.js) (MIT). Their license files are copied next to the
bundles by \`npm run build\`.

## Local patches to upstream copies

Only what was needed to run offline inside the hub; game logic is untouched.

- **pacman** – replaced the author's website chrome (remote CSS/JS, analytics, a redirect to the author's site, ads of
  their other projects) with a minimal offline page. The in-game "© passer-by.com" credit is kept.
- **invaderz** – removed the obsolete ApplicationCache and the service-worker registration (wrong scope off the
  author's site).
- **asteroids** – CSS only: white-on-black via \`filter: invert(1)\`, centered.
- **racer** – only the final chapter (\`v4.final.html\`) is exposed; the tutorial stages were dropped.
- **snake, breakout** – the packaged Chrome-app copies (tens of MB) were removed.
- **tetris, tabletop** – a "← Library" link is added when opened standalone (e.g. from an invite link).
`);
console.log('CREDITS.md written');
