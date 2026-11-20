// Örnek Excel dosyalarından biçim (layout) şablonu çıkarır.
// Kişisel veri İÇERMEZ: veri hücrelerinin değerleri silinir, yalnız stil/başlık/formül saklanır.
// Kullanım: node scripts/extract-layout.mjs "<kurum.xlsx>" "<firma.xlsx>"
import ExcelJS from 'exceljs';
import fs from 'node:fs';

const [kurumYol, firmaYol] = process.argv.slice(2);
if (!kurumYol || !firmaYol) { console.error('kullanım: node scripts/extract-layout.mjs kurum.xlsx firma.xlsx'); process.exit(1); }

const colNum = (s) => s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
function parseAddr(a) { const m = a.match(/^([A-Z]+)(\d+)$/); return { c: colNum(m[1]), r: Number(m[2]) }; }

/**
 * opts.keep(addr, r, c, value) -> 'all' | 'style' | 'formula'
 */
function dumpSheet(ws, { rows, cols, keep, rowOk = () => true }) {
  const out = { name: ws.name, columns: [], rows: {}, cells: {}, merges: [], pageSetup: ws.pageSetup, views: ws.views, headerFooter: ws.headerFooter, state: ws.state };
  for (let c = 1; c <= cols; c++) {
    const col = ws.getColumn(c);
    out.columns.push({ width: col.width ?? null, hidden: !!col.hidden, style: col.style && Object.keys(col.style).length ? col.style : undefined });
  }
  for (let r = 1; r <= rows; r++) {
    if (!rowOk(r)) continue;
    const row = ws.getRow(r);
    if (row.height || row.hidden) out.rows[r] = { height: row.height ?? null, hidden: !!row.hidden };
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      const hasStyle = cell.style && Object.keys(cell.style).length > 0;
      if (v === null && !hasStyle) continue;
      let k = keep(cell.address, r, c, v);
      if (cell.isMerged && cell.master && cell.master.address !== cell.address && k !== 'skip') k = 'style';
      if (k === 'skip') continue;
      const e = { s: hasStyle ? cell.style : undefined };
      if (k === 'all' && v !== null && v !== undefined) {
        if (typeof v === 'object' && v && ('formula' in v || 'sharedFormula' in v)) e.f = cell.formula;
        else if (v instanceof Date) e.d = v.toISOString();
        else if (typeof v === 'object' && v.richText) e.v = v.richText.map((t) => t.text).join('');
        else e.v = v;
      } else if (k === 'formula' && v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
        e.f = cell.formula;
      }
      out.cells[cell.address] = e;
    }
  }
  const merges = ws.model.merges ?? [];
  for (const m of merges) {
    const [a, b] = m.split(':');
    if (parseAddr(a).r <= rows && rowOk(parseAddr(a).r)) out.merges.push(m);
  }
  return out;
}

const firmaWb = new ExcelJS.Workbook(); await firmaWb.xlsx.readFile(firmaYol);
const kurumWb = new ExcelJS.Workbook(); await kurumWb.xlsx.readFile(kurumYol);

const layout = { kaynak: 'Ağustos 2026 örnek dosyaları (veri hücreleri temizlendi)', firma: {}, kurum: {} };

// ---- FİRMA
const fg = firmaWb.getWorksheet('Giriş');
layout.firma.giris = dumpSheet(fg, { rows: 55, cols: 38, keep: (a, r, c) => (a === 'Z7' || a === 'AA7' || /ENZEL/i.test(String(fg.getCell(a).value ?? '')) ? 'style' : r === 1 ? 'all' : c >= 24 && c <= 30 && typeof fg.getCell(a).value === 'string' && !/^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+ [A-ZÇĞİÖŞÜ]/.test(fg.getCell(a).value) ? 'all' : 'style') });
layout.firma.onTablo = dumpSheet(firmaWb.getWorksheet('ÖN TABLO'), { rows: 66, cols: 28, rowOk: (r) => r <= 6 || r >= 46, keep: (a, r, c) => (r <= 5 || (r >= 47 && c === 1) || (r >= 61 && c !== 8 && c !== 15 && c !== 20) ? 'all' : 'style') });
// plaka formu: formülü olan, kişisel veri içermeyen 2. plaka sayfası
const pf = firmaWb.getWorksheet('06CZR334');
layout.firma.plakaFormu = dumpSheet(pf, { rows: 59, cols: 23, keep: () => 'all' });
layout.firma.plakaFormu.kaynakSatir = 3;
layout.firma.plakaFormu.kaynakAd = '06CZR334';
layout.firma.surucuFaaliyet = dumpSheet(firmaWb.getWorksheet('Sürücü Faaliyet'), { rows: 48, cols: 52, rowOk: (r) => r <= 2 || r === 43, keep: (a, r, c) => (r === 1 ? 'all' : 'style') });
layout.firma.aracFaaliyet = dumpSheet(firmaWb.getWorksheet('Araç Faaliyet'), { rows: 45, cols: 8, rowOk: (r) => r <= 2, keep: (a, r) => (r === 1 ? 'all' : 'style') });
layout.firma.bordroTutar = dumpSheet(firmaWb.getWorksheet('Bordro Tutar'), { rows: 45, cols: 8, rowOk: (r) => r <= 1 || r === 42 || r === 43, keep: () => 'style' });

// ---- KURUM
const kg = kurumWb.getWorksheet('Giriş');
layout.kurum.giris = dumpSheet(kg, { rows: 45, cols: 5, rowOk: (r) => r <= 3, keep: (a, r) => (r === 2 || a === 'A1' ? 'all' : 'style') });
layout.kurum.plaka = dumpSheet(kurumWb.getWorksheet('06CZR334'), {
  rows: 68, cols: 48, rowOk: (r) => r <= 8 || r >= 38,
  keep: (a, r, c) => {
    if (r >= 8 && r <= 38) return c >= 22 ? 'skip' : 'style'; // günlük satırlar: sadece stil
    if (c >= 30) return 'skip'; // sağdaki yardımcı listeler
    if (r === 3 || r === 4 || r === 5 || r === 6) return c <= 4 || (c >= 22) ? 'all' : 'style';
    return 'all';
  },
});
layout.kurum.surucuPuantaj = dumpSheet(kurumWb.getWorksheet('Sürücü Puantaj'), {
  rows: 110, cols: 46, rowOk: (r) => r <= 11 || r >= 92,
  keep: (a, r, c) => (r <= 9 || r >= 92 ? 'all' : 'style'),
});
layout.kurum.hakedis = dumpSheet(kurumWb.getWorksheet('HAKEDİŞ'), { rows: 44, cols: 14, rowOk: (r) => r <= 2 || r === 43, keep: (a, r) => (r === 1 ? 'all' : 'style') });

if (layout.firma.onTablo.cells.A3) layout.firma.onTablo.cells.A3.v = '';
fs.mkdirSync('templates', { recursive: true });
fs.writeFileSync('templates/layout.json', JSON.stringify(layout));
console.log('templates/layout.json yazıldı', (fs.statSync('templates/layout.json').size / 1024).toFixed(0), 'KB');
