import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { Store } from '../electron/store';
import { Api } from '../electron/api';
import { excelIceAktar } from '../electron/importDb';
import { layoutYukle, firmaHakedisExcel, kurumPuantajExcel, tekilExcel, plakaFormlariExcel } from '../electron/excelExport';
import { ornekVar, KURUM_DOSYA, FIRMA_DOSYA } from './helpers';
import { cv } from '../src/importer/excelImport';

const WASM = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const d = ornekVar ? describe : describe.skip;

d('Excel çıktıları', () => {
  it('firma + kurum çalışma kitapları üretilir, sonuçlar doğru', async () => {
    layoutYukle(path.resolve(__dirname, '..', 'templates', 'layout.json'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-cikti-'));
    const store = new Store(path.join(dir, 'h.db'));
    await store.ac(WASM, { kullanici: 't', saltOkunur: false });
    const api = new Api(store);
    await excelIceAktar(store, KURUM_DOSYA, FIRMA_DOSYA, api.parametreler('2026-08'));
    const son = api.hesapla('2026-08');
    const p = api.parametreler('2026-08');
    const f1 = path.join(dir, 'firma.xlsx');
    await firmaHakedisExcel(son, p, f1);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f1);
    expect(wb.worksheets.map((w) => w.name).slice(0, 3)).toEqual(['Giriş', 'ÖN TABLO', '34GDY157']);
    const O = wb.getWorksheet('ÖN TABLO')!;
    expect(cv(O, 'W47')).toBeCloseTo(6728986.13, 2);
    expect(cv(O, 'V57')).toBeCloseTo(6728986.13, 2);
    expect(O.getCell('W47').formula).toBe('P47+K47+S47');
    expect(cv(wb.getWorksheet('Sürücü Faaliyet')!, 'AJ44')).toBeCloseTo(2234797.22, 2);
    const k1 = path.join(dir, 'kurum.xlsx');
    const ay = '2026-08';
    await kurumPuantajExcel(son, p, {
      tatiller: api.tatiller(2026), surucuGunleri: store.all('SELECT * FROM surucu_gunleri WHERE tarih LIKE ?', [`${ay}-%`]),
      seferler: store.all('SELECT * FROM seferler WHERE tarih LIKE ?', [`${ay}-%`]), suruculer: store.all('SELECT id, ad_soyad, yol_hakki FROM suruculer'),
    }, k1);
    const kw = new ExcelJS.Workbook(); await kw.xlsx.readFile(k1);
    expect(kw.getWorksheet('HAKEDİŞ')).toBeTruthy();
    expect(cv(kw.getWorksheet('06CZR334')!, 'I41')).toBe(2557);
    for (const t of ['surucuFaaliyet', 'aracFaaliyet', 'bordro'] as const) await tekilExcel(t, son, p, path.join(dir, `${t}.xlsx`));
    await plakaFormlariExcel(son, p, [0, 1], path.join(dir, 'formlar.xlsx'));
    console.log('çıktılar:', dir);
    store.kapat();
  });
});
