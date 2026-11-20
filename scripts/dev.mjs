// Geliştirme: Vite sunucusu + Electron
import { createServer } from 'vite';
import { spawn, execSync } from 'node:child_process';
import electronPath from 'electron';

execSync('node scripts/build-main.mjs', { stdio: 'inherit' });
const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls.local[0];
const env = { ...process.env, VITE_DEV_SERVER_URL: url };
delete env.ELECTRON_RUN_AS_NODE;
const p = spawn(electronPath, ['.'], { stdio: 'inherit', env });
p.on('exit', () => { server.close(); process.exit(0); });
