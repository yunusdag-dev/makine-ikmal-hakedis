import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const watch = process.argv.includes('--watch');
fs.mkdirSync('dist-electron', { recursive: true });
const ortak = { bundle: true, platform: 'node', target: 'node20', format: 'cjs', sourcemap: false, external: ['electron'], logLevel: 'info', legalComments: 'none' };
await build({ ...ortak, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.cjs' });
await build({ ...ortak, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs' });
fs.copyFileSync(path.join('node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), path.join('dist-electron', 'sql-wasm.wasm'));
console.log('main + preload derlendi');
