/** Günlük kayıt (tarih + sürücü + araç) için ortak tipler ve yardımcılar */
import { api } from './api';

export type GunRow = {
  durum: string; fazla_mesai: number; hafta_tatili: number; resmi_tatil: number; dis_gorev: number; konaklama: number;
  yemek_override: number | null; yol_override: number | null; cikis_saat: string; donus_saat: string; notlar: string;
};
export type SeferRow = { arac_id: number | null; km_cikis: number | null; km_donus: number | null; arac_ig: number; arac_igd: number; gorevli: string; gorev_yeri: string };
export type GunVeri = { gun: GunRow; seferler: SeferRow[] };

export const BOS_GUN: GunRow = { durum: '', fazla_mesai: 0, hafta_tatili: 0, resmi_tatil: 0, dis_gorev: 0, konaklama: 0, yemek_override: null, yol_override: null, cikis_saat: '', donus_saat: '', notlar: '' };
export const bosSefer = (arac_id: number | null, ig: boolean): SeferRow => ({ arac_id, km_cikis: null, km_donus: null, arac_ig: ig ? 1 : 0, arac_igd: 0, gorevli: '', gorev_yeri: '' });

/** Bir sürücünün bir ayındaki tüm günlerini tarih -> GunVeri olarak yükler */
export async function surucuAyiYukle(surucuId: number, ay: string): Promise<Record<string, GunVeri>> {
  const r = await api<{ gunler: any[]; seferler: any[] }>('surucuAyi', surucuId, ay);
  const m: Record<string, GunVeri> = {};
  for (const g of r.gunler) m[g.tarih] = { gun: { ...BOS_GUN, ...g }, seferler: [] };
  for (const s of r.seferler) {
    if (!m[s.tarih]) m[s.tarih] = { gun: { ...BOS_GUN }, seferler: [] };
    m[s.tarih].seferler.push({ arac_id: s.arac_id, km_cikis: s.km_cikis, km_donus: s.km_donus, arac_ig: s.arac_ig, arac_igd: s.arac_igd, gorevli: s.gorevli, gorev_yeri: s.gorev_yeri });
  }
  return m;
}

export function gunKaydet(surucuId: number, tarih: string, v: GunVeri) {
  return api('gunKaydet', surucuId, tarih, v.gun, v.seferler.filter((s) => s.arac_id));
}

/** "08:30" -> dakika */
export function saatDk(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Çıkış/dönüş saatine göre fazla mesai önerisi (günlük çalışma saatini aşan kısım, 0,5 saate yuvarlanır) */
export function mesaiOnerisi(cikis: string, donus: string, gunlukSaat: number): number | null {
  const a = saatDk(cikis), b = saatDk(donus);
  if (a == null || b == null) return null;
  let sure = b - a;
  if (sure <= 0) sure += 24 * 60;
  const fazla = sure / 60 - gunlukSaat;
  return fazla > 0 ? Math.floor(fazla * 2) / 2 : 0;
}

export function tarihKaydir(t: string, n: number): string {
  const [y, m, d] = t.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const DURUM_SECENEK: { kod: string; ad: string; tus: string }[] = [
  { kod: 'X', ad: 'Çalıştı', tus: 'X' },
  { kod: 'B', ad: 'Bayram/genel tatil', tus: 'B' },
  { kod: 'R', ad: 'Raporlu', tus: 'R' },
  { kod: 'Sİ', ad: 'Senelik izin', tus: 'S' },
  { kod: 'Üİ', ad: 'Ücretsiz izin', tus: 'U' },
  { kod: 'Mİ', ad: 'Mazeret izni', tus: 'M' },
  { kod: 'İİ', ad: 'İdari izin', tus: 'İ' },
  { kod: '0', ad: 'Çalışmadı', tus: '0' },
];
