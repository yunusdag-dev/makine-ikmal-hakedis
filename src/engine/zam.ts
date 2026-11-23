/**
 * Toplu zam: seçilen tutar parametrelerine yüzde uygular (Ayarlar > Hızlı Ayar).
 * Yalnızca TUTAR alanlarına dokunur (oran, çarpan, gün sayısı, vergi oranı vb. asla değişmez); sonuç kuruşa (2 hane; EPDK fiyatı 5 hane) yuvarlanır.
 */
import type { Params, UcretTablosu } from './params';
import { xround } from './excel';

const TABLOLAR: [keyof Params['ucret'] & ('surucu' | 'operator' | 'ffSurucu' | 'ffOperator'), string][] = [
  ['surucu', 'Sürücü'], ['operator', 'Operatör'], ['ffSurucu', 'Sürücü (fiyat farkı)'], ['ffOperator', 'Operatör (fiyat farkı)'],
];
const UCRET_ETIKET: Record<keyof UcretTablosu, string> = {
  ucretBrut: 'Aylık ücret (brüt)', ucretKesinti: 'Ücretten düşülen', resmiTatil: 'Resmi/genel tatil (gün)', haftaTatili: 'Hafta tatili (saat)',
  fazlaCalisma: 'Fazla çalışma (saat)', konaklama: 'Konaklama (gün)', disGorev: 'Dış görev (gün)', yemek: 'Yemek (gün)', yol: 'Yol (gün)',
};

export interface ZamGrubu { anahtar: string; ad: string; aciklama: string; varsayilan: boolean; yollar: { yol: string; etiket: string; ondalik?: number }[] }

const ucretYollari = (alanlar: (keyof UcretTablosu)[]) =>
  TABLOLAR.flatMap(([t, tAd]) => alanlar.map((a) => ({ yol: `ucret.${t}.${a}`, etiket: `${tAd} — ${UCRET_ETIKET[a]}` })));

export const ZAM_GRUPLARI: ZamGrubu[] = [
  { anahtar: 'ucret', ad: 'Aylık ücretler (brüt)', aciklama: 'Sürücü / operatör aylık brüt ücreti (hakediş ve fiyat farkı tabloları)', varsayilan: true, yollar: ucretYollari(['ucretBrut']) },
  { anahtar: 'mesai', ad: 'Tatil ve fazla çalışma ücretleri', aciklama: 'Resmi tatil, hafta tatili, fazla çalışma birim ücretleri', varsayilan: true, yollar: ucretYollari(['resmiTatil', 'haftaTatili', 'fazlaCalisma']) },
  { anahtar: 'yemekyol', ad: 'Yemek ve yol', aciklama: 'Günlük yemek/yol ücretleri (hakediş) ve bordro yemek, yol, yemek istisnası', varsayilan: true,
    yollar: [...ucretYollari(['yemek', 'yol']), { yol: 'bordro.yemekGunluk', etiket: 'Bordro — yemek (günlük)' }, { yol: 'bordro.yolGunluk', etiket: 'Bordro — yol (günlük)' }, { yol: 'bordro.yemekIstisnaGunluk', etiket: 'Bordro — yemek istisnası (günlük)' }] },
  { anahtar: 'konaklama', ad: 'Konaklama ve dış görev', aciklama: 'Konaklama ve dış görev günlük ücretleri', varsayilan: true, yollar: ucretYollari(['konaklama', 'disGorev']) },
  { anahtar: 'asgari', ad: 'Asgari ücret', aciklama: 'Bordro brüt asgari ücret ve fiyat farkındaki güncel asgari ücret (İn)', varsayilan: true,
    yollar: [{ yol: 'bordro.asgariUcretBrut', etiket: 'Bordro — brüt asgari ücret' }, { yol: 'fiyatFarki.In', etiket: 'Fiyat farkı — güncel asgari ücret (İn)' }] },
  { anahtar: 'endeks', ad: 'Endeks ve yakıt', aciklama: 'Yi-ÜFE güncel (Gn), malzeme-ekipman güncel (Mn), EPDK motorin fiyatı', varsayilan: false,
    yollar: [{ yol: 'fiyatFarki.Gn', etiket: 'Yi-ÜFE güncel (Gn)' }, { yol: 'fiyatFarki.Mn', etiket: 'Malzeme-ekipman güncel (Mn)' }, { yol: 'epdkYakitFiyati', etiket: 'EPDK motorin fiyatı', ondalik: 5 }] },
];

const al = (o: any, yol: string): number => yol.split('.').reduce((x, k) => x[k], o);
function koy(o: any, yol: string, v: number) {
  const ks = yol.split('.');
  let x = o;
  for (const k of ks.slice(0, -1)) x = x[k];
  x[ks[ks.length - 1]] = v;
}

export interface ZamDegisimi { yol: string; etiket: string; eski: number; yeni: number }

/** @param yuzde örn. 35 → %35 artış (negatif değer indirim). Girdi değiştirilmez. */
export function zamUygula(p: Params, yuzde: number, gruplar: string[]): { params: Params; degisimler: ZamDegisimi[] } {
  if (!Number.isFinite(yuzde) || yuzde <= -100 || yuzde > 1000) throw new Error('Zam oranı -99 ile 1000 arasında olmalı.');
  const params: Params = JSON.parse(JSON.stringify(p));
  const degisimler: ZamDegisimi[] = [];
  const secili = new Set(gruplar);
  for (const g of ZAM_GRUPLARI) {
    if (!secili.has(g.anahtar)) continue;
    for (const { yol, etiket, ondalik } of g.yollar) {
      const eski = al(params, yol);
      if (typeof eski !== 'number') continue;
      const yeni = xround(eski * (1 + yuzde / 100), ondalik ?? 2);
      if (yeni !== eski) { koy(params, yol, yeni); degisimler.push({ yol, etiket, eski, yeni }); }
    }
  }
  return { params, degisimler };
}
