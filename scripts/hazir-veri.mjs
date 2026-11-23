// Kullanım: node scripts/hazir-veri.mjs "<kurum.xlsx>" "<firma.xlsx>"
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const [kurum, firma] = process.argv.slice(2);
if (!kurum || !firma) { console.error('kullanım: node scripts/hazir-veri.mjs kurum.xlsx firma.xlsx'); process.exit(1); }
await build({ entryPoints: ['scripts/hazir-veri-olustur.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'dist-electron/_hazir.cjs', logLevel: 'error' });
const r = spawnSync(process.execPath, ['dist-electron/_hazir.cjs', kurum, firma, path.resolve('node_modules/sql.js/dist'), path.resolve('hazir-veri/hakedis.db')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
