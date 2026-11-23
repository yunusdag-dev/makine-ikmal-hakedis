import { AY_ADLARI } from '../../engine/excel';

const tlF = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const tl = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '' : tlF.format(x));
export const tlS = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '' : tlF.format(x) + ' ₺');
export const sayi = (x: number | null | undefined, d = 2) =>
  x == null || !Number.isFinite(x) ? '' : x.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: d });
export const sayiBos = (x: number | null | undefined, d = 2) => (!x ? '' : sayi(x, d));
export function ayAdi(ay: string) {
  const [y, m] = ay.split('-').map(Number);
  return `${AY_ADLARI[m - 1]} ${y}`;
}
export function ayKaydir(ay: string, n: number) {
  const [y, m] = ay.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
/** Yerel saate göre bugünün tarihi (YYYY-AA-GG). toISOString() UTC verdiği için 00:00-03:00 arası dünü gösterirdi. */
export function bugunTarih(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function buAy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cts'];
export function tarihTR(t: string) {
  if (!t) return '';
  const [y, m, d] = t.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}
export function zamanTR(t: string) {
  if (!t) return '';
  const d = new Date(t.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString('tr-TR');
}
/** Türkçe ondalık girişini sayıya çevirir ("1.234,5" / "1234.5" / "12,5") */
export function sayiOku(s: string): number | null {
  const t = String(s ?? '').trim().replace(/\s/g, '');
  if (!t) return null;
  let x = t;
  if (x.includes(',') && x.includes('.')) x = x.replace(/\./g, '').replace(',', '.');
  else if (x.includes(',')) x = x.replace(',', '.');
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
export const basHarf = (ad: string) => ad.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toLocaleUpperCase('tr-TR');
export function dosyaAdiAy(ay: string) { return ayAdi(ay).replace(' ', '_'); }
