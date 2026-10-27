import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const out = path.resolve('public/vendor');
fs.mkdirSync(out, { recursive: true });

const bundle = (name, contents) =>
  build({
    stdin: { contents, resolveDir: process.cwd() },
    bundle: true,
    format: 'esm',
    minify: true,
    legalComments: 'eof',
    target: ['es2020'],
    outfile: path.join(out, name),
  });

await bundle('trystero.js', "export { joinRoom } from 'trystero';");
await bundle('chess.js', "export { Chess } from 'chess.js';");

const licenses = {
  'TRYSTERO-LICENSE.txt': 'node_modules/trystero/LICENSE',
  'NOSTR-LICENSE.txt': 'node_modules/@trystero-p2p/nostr/LICENSE',
  'CORE-LICENSE.txt': 'node_modules/@trystero-p2p/core/LICENSE',
  'SECP256K1-LICENSE.txt': 'node_modules/@noble/secp256k1/LICENSE',
  'CHESSJS-LICENSE.txt': 'node_modules/chess.js/LICENSE',
  'THREE-LICENSE.txt': 'node_modules/three/LICENSE',
};
for (const [name, src] of Object.entries(licenses)) {
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(out, name));
  else console.warn('missing license', src);
}
fs.copyFileSync('node_modules/three/build/three.module.min.js', path.join(out, 'three.module.min.js'));
if (fs.existsSync('node_modules/three/build/three.core.min.js'))
  fs.copyFileSync('node_modules/three/build/three.core.min.js', path.join(out, 'three.core.min.js'));
console.log('vendor ready');
