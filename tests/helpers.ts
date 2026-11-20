import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';

export const ORNEK_DIR = path.resolve(__dirname, '..', 'örnek exceller');
export const KURUM_DOSYA = path.join(ORNEK_DIR, 'Ağustos 2026.xlsx');
export const FIRMA_DOSYA = path.join(ORNEK_DIR, 'Enzel İnşaat Ağustos 2026 Hakediş.xlsx');
export const ornekVar = fs.existsSync(KURUM_DOSYA) && fs.existsSync(FIRMA_DOSYA);
if (!ornekVar) {
  const m = `UYARI: Örnek Excel dosyaları bulunamadı (${ORNEK_DIR}). Excel ile kuruşu kuruşuna doğrulama testleri ATLANIYOR; hesap doğruluğu bu çalıştırmada doğrulanmadı.`;
  console.warn(m);
  if (process.env.HAKEDIS_ORNEK_ZORUNLU) throw new Error(m); // CI / kurulum öncesi kontrol: HAKEDIS_ORNEK_ZORUNLU=1
}

const cache = new Map<string, Promise<ExcelJS.Workbook>>();
export function oku(p: string): Promise<ExcelJS.Workbook> {
  if (!cache.has(p)) {
    cache.set(p, (async () => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(p); return wb; })());
  }
  return cache.get(p)!;
}

/** Kuruşu kuruşuna karşılaştırma: 2 hanede eşit ve fark < 1e-6 */
export class Karsilastirici {
  hatalar: string[] = [];
  sayi = 0;
  esit(etiket: string, beklenen: any, bulunan: number) {
    this.sayi++;
    const b = typeof beklenen === 'number' ? beklenen : beklenen == null || beklenen === '' ? 0 : Number(beklenen);
    if (!Number.isFinite(b)) { this.hatalar.push(`${etiket}: beklenen sayı değil (${beklenen})`); return; }
    if (!Number.isFinite(bulunan)) { this.hatalar.push(`${etiket}: Uygulama değeri sayı değil (${bulunan})`); return; }
    if (Math.abs(b - bulunan) > 1e-6) this.hatalar.push(`${etiket}: Excel=${b} Uygulama=${bulunan} (fark ${(bulunan - b).toFixed(6)})`);
  }
}
