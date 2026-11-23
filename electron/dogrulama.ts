import { gorevCakismasi } from '../src/engine/mesai';
/**
 * Sunucu (ana süreç) tarafı girdi doğrulaması. Arayüz kontrolleri kullanıcı kolaylığıdır;
 * veritabanına yazılan her değer burada ayrıca doğrulanır (hesap doğruluğu bunlara dayanır).
 */
const DURUMLAR = new Set(['', '0', 'X', 'B', 'R', 'Sİ', 'Üİ', 'Mİ', 'İİ']);

export function tarihKontrol(t: any, ad = 'Tarih'): string {
  const s = String(t ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (y >= 2000 && y <= 2100 && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return s;
  }
  throw new Error(`${ad} geçersiz (YYYY-AA-GG biçiminde ve gerçek bir tarih olmalı): "${s.slice(0, 20)}"`);
}

export function ayKontrol(a: any, ad = 'Ay'): string {
  const s = String(a ?? '');
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (m && +m[1] >= 2000 && +m[1] <= 2100 && +m[2] >= 1 && +m[2] <= 12) return s;
  throw new Error(`${ad} geçersiz (YYYY-AA biçiminde olmalı): "${s.slice(0, 20)}"`);
}

/** Boş (null/''/undefined) serbestse null döner; doluysa sayı ve aralık kontrolü yapar */
export function sayiKontrol(v: any, ad: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`${ad} sayı olmalı.`);
  if (n < min || n > max) throw new Error(`${ad} ${min} ile ${max} arasında olmalı (girilen: ${n}).`);
  return n;
}

export function metinKontrol(v: any, ad: string, azami: number): string {
  const s = String(v ?? '');
  if (s.length > azami) throw new Error(`${ad} en fazla ${azami} karakter olabilir.`);
  return s;
}

export function saatKontrol(v: any, ad: string): string {
  const s = String(v ?? '');
  if (s !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new Error(`${ad} saat biçiminde (SS:DD) olmalı: "${s.slice(0, 10)}"`);
  return s;
}

/** T.C. kimlik no gösterimi/kaydı için maske: son 2 hane görünür */
export function tcMaske(tc: any): string {
  const s = String(tc ?? '');
  return s ? '*'.repeat(Math.max(s.length - 2, 0)) + s.slice(-2) : '';
}
/** JSON.stringify için: değişiklik kaydına T.C. numaraları asla açık yazılmaz */
export function tcMaskeleyici(k: string, v: any) {
  return k === 'tc_no' ? tcMaske(v) : v;
}

/** Sürücü günü + araç seferleri */
export function gunKontrol(tarih: any, gun: any, seferler: any[]) {
  tarihKontrol(tarih);
  if (gun) {
    if (!DURUMLAR.has(String(gun.durum ?? ''))) throw new Error(`Geçersiz çalışma durumu: "${String(gun.durum).slice(0, 10)}"`);
    sayiKontrol(gun.fazla_mesai ?? 0, 'Fazla mesai', 0, 24);
    sayiKontrol(gun.resmi_tatil ?? 0, 'Resmi tatil', 0, 1);
    sayiKontrol(gun.dis_gorev ?? 0, 'Dış görev', 0, 1);
    saatKontrol(gun.cikis_saat, 'Çıkış saati');
    saatKontrol(gun.donus_saat, 'Dönüş saati');
    metinKontrol(gun.notlar, 'Not', 1000);
  }
  for (const x of seferler ?? []) {
    if (!x?.arac_id) continue;
    const c = sayiKontrol(x.km_cikis, 'Çıkış KM', 0, 9_999_999);
    const d = sayiKontrol(x.km_donus, 'Dönüş KM', 0, 9_999_999);
    if (c != null && d != null && d < c) throw new Error("Dönüş KM çıkış KM'den küçük olamaz.");
    sayiKontrol(x.arac_igd ?? 0, 'Araç çalışma (İGD)', 0, 1);
    metinKontrol(x.gorevli, 'Görevli personel', 600);
    metinKontrol(x.gorev_yeri, 'Gidilen yer', 600);
    saatKontrol(x.cikis_saat, 'Görev başlangıç saati');
    saatKontrol(x.donus_saat, 'Görev bitiş saati');
    sayiKontrol(x.fazla_mesai ?? 0, 'Görev fazla mesaisi', 0, 24);
    if (x.mesai_mod != null && !['oto', 'asagi', 'yukari', 'elle'].includes(String(x.mesai_mod))) throw new Error('Geçersiz fazla mesai yuvarlama seçimi.');
  }
  const aktif = (seferler ?? []).filter((x) => x?.arac_id);
  const cakisma = gorevCakismasi(aktif.map((x) => ({ cikis_saat: String(x.cikis_saat ?? ''), donus_saat: String(x.donus_saat ?? '') })));
  if (cakisma) throw new Error(`${cakisma[0] + 1}. ve ${cakisma[1] + 1}. görevin saatleri çakışıyor; aynı saat iki kez sayılamaz.`);
}

export { adNorm, adlaraBol } from '../src/engine/ad';
