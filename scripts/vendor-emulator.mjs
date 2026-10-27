import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('public/games/console/emulator');
const version='4.2.3';
const raw=`https://raw.githubusercontent.com/EmulatorJS/EmulatorJS/v${version}/`;
const cdn=`https://cdn.emulatorjs.org/${version}/`;
const files=[
 ['LICENSE',raw+'LICENSE'],['README.md',raw+'README.md'],
 ...['loader.js','emulator.css','version.json','src/emulator.js','src/nipplejs.js','src/shaders.js','src/storage.js','src/gamepad.js','src/GameManager.js','src/socket.io.min.js','src/compression.js','compression/README.md','compression/extract7z.js','compression/extractzip.js','compression/libunrar.js','compression/libunrar.wasm'].map(p=>['data/'+p,raw+'data/'+p]),
 ...['mgba','snes9x','mupen64plus_next'].flatMap(core=>[
  [`data/cores/${core}-wasm.data`,`${cdn}data/cores/${core}-wasm.data`],
  [`data/cores/${core}-legacy-wasm.data`,`${cdn}data/cores/${core}-legacy-wasm.data`],
  [`data/cores/reports/${core}.json`,`${cdn}data/cores/reports/${core}.json`]
 ])
];
const manifest=[];
for(const [file,url] of files){
 const response=await fetch(url);if(!response.ok)throw Error(`${response.status} ${url}`);
 const bytes=Buffer.from(await response.arrayBuffer());await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),bytes);
 manifest.push({file,url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 console.log(`${file} (${(bytes.length/1024).toFixed(0)} KiB)`);
}
await fs.writeFile(path.join(root,'MANIFEST.json'),JSON.stringify({repository:'https://github.com/EmulatorJS/EmulatorJS',version,commit:'e150dc0491ae747028919fb82d6598954976ede6',fetchedAt:'2026-10-27',files:manifest},null,2)+'\n');
