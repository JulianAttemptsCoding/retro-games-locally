import express from 'express';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const app = express();
app.disable('x-powered-by');
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use(
  express.static(root, {
    extensions: ['html'],
    setHeaders(res, file) {
      if (file.endsWith('.wasm')) res.type('application/wasm');
      // EmulatorJS threaded cores want cross-origin isolation; harmless for the rest.
    },
  }),
);
const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Retro Arcade: http://localhost:${port}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list ?? [])
      if (i.family === 'IPv4' && !i.internal) console.log(`  on your network: http://${i.address}:${port}`);
});
