// Uygulama ikonunu üretir: node_modules/.bin/electron scripts/ikon-uret.cjs  -> build/icon.png + build/icon.ico
const { app, BrowserWindow } = require('electron');
const fs = require('fs'); const path = require('path');
const R = path.resolve(__dirname, '..');

function disli(cx, cy, rd, rt, n, ic) { // dişli yolu: dış (diş ucu) rt, diş dibi rd
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI, w = (2 * Math.PI) / n;
    const p = (r, t) => `${(cx + r * Math.cos(a + t * w)).toFixed(1)} ${(cy + r * Math.sin(a + t * w)).toFixed(1)}`;
    d += `${i ? 'L' : 'M'}${p(rd, 0.0)} L${p(rt, 0.14)} L${p(rt, 0.36)} L${p(rd, 0.50)} `;
  }
  d += 'Z';
  d += ` M${cx + ic} ${cy} A${ic} ${ic} 0 1 0 ${cx - ic} ${cy} A${ic} ${ic} 0 1 0 ${cx + ic} ${cy} Z`;
  return d;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e40af"/><stop offset="1" stop-color="#0b1e4a"/></linearGradient>
 <linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0d9488"/></linearGradient>
 <linearGradient id="tr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>
</defs>
<rect width="512" height="512" rx="112" fill="url(#bg)"/>
<path d="${disli(330, 190, 112, 148, 10, 50)}" fill="url(#gr)" fill-rule="evenodd"/>
<circle cx="330" cy="190" r="26" fill="#0b1e4a" opacity=".35"/>
<rect x="64" y="262" width="222" height="124" rx="16" fill="url(#tr)"/>
<path d="M298 296 h74 q14 0 24 10 l34 40 q8 10 8 22 v18 h-140 z" fill="url(#tr)"/>
<path d="M318 312 h50 q6 0 10 4 l22 26 h-82 z" fill="#1e40af"/>
<rect x="64" y="378" width="378" height="14" rx="7" fill="#e2e8f0"/>
<g><circle cx="150" cy="394" r="40" fill="#0b1e4a"/><circle cx="150" cy="394" r="30" fill="#f1f5f9"/><circle cx="150" cy="394" r="12" fill="#0b1e4a"/></g>
<g><circle cx="374" cy="394" r="40" fill="#0b1e4a"/><circle cx="374" cy="394" r="30" fill="#f1f5f9"/><circle cx="374" cy="394" r="12" fill="#0b1e4a"/></g>
</svg>`;
fs.writeFileSync(path.join(R, 'build', 'icon.svg'), svg);

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 512, height: 512, useContentSize: true, frame: false, transparent: true, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`));
  await new Promise((r) => setTimeout(r, 500));
  const img = await w.webContents.capturePage();
  const pngBuf = (s) => img.resize({ width: s, height: s, quality: 'best' }).toPNG();
  fs.writeFileSync(path.join(R, 'build', 'icon.png'), pngBuf(512));
  fs.mkdirSync(path.join(R, 'src', 'renderer', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(R, 'src', 'renderer', 'assets', 'ikon.png'), pngBuf(128)); // arayüzdeki logo
  const boy = [16, 24, 32, 48, 64, 128, 256];
  const bufs = boy.map(pngBuf);
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(boy.length, 4);
  let off = 6 + 16 * boy.length; const dir = [];
  boy.forEach((s, i) => { const e = Buffer.alloc(16); e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(bufs[i].length, 8); e.writeUInt32LE(off, 12); off += bufs[i].length; dir.push(e); });
  fs.writeFileSync(path.join(R, 'build', 'icon.ico'), Buffer.concat([head, ...dir, ...bufs]));
  app.quit();
});
