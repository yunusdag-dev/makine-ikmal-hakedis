/**
 * Özellik anahtarları: bir ödeme kalemi dönem için tümüyle kapatılabilir (ör. yemek artık verilmiyor).
 * Kapalıyken saklanan birim ücretler SİLİNMEZ; hesaplamada sıfır kabul edilir, yeniden açılınca geri gelir.
 *  - etkinParams: kapalı kalemlerin birim ücretlerini sıfırlar (tüm hesap ve Excel çıktıları bunu kullanır)
 *  - ozellikVeriUygula: kapalı kalemlerin günlük girişlerini sıfır sayar (günlük kayıtlar silinmez)
 */
import type { Params, UcretTablosu } from './params';
import type { SurucuGun, SurucuKart } from './types';
import { yemekOtomatik, yolHakki } from './kurum';

export type OzellikAnahtari = keyof Params['ozellikler'];

export const OZELLIKLER: { anahtar: OzellikAnahtari; ad: string; ipucu: string }[] = [
  { anahtar: 'fazlaMesai', ad: 'Fazla mesai', ipucu: 'Kapalıyken girilen fazla mesai saatleri hesaba katılmaz.' },
  { anahtar: 'haftaTatili', ad: 'Hafta tatili çalışma ücreti', ipucu: 'Hafta tatilinde çalışma ücreti ödenmez.' },
  { anahtar: 'resmiTatil', ad: 'Resmi / genel tatil çalışma ücreti', ipucu: 'Resmi tatilde çalışma ücreti ödenmez.' },
  { anahtar: 'disGorev', ad: 'Dış görev ücreti', ipucu: 'Dış görev ücreti ödenmez.' },
  { anahtar: 'konaklama', ad: 'Konaklama', ipucu: 'Konaklama ücreti ödenmez.' },
  { anahtar: 'yemek', ad: 'Yemek', ipucu: 'Yemek ücreti ve sürücü ücretinden yemek düşümü sıfırlanır; sözleşme ücretini ayrıca güncellemeniz gerekebilir.' },
  { anahtar: 'yol', ad: 'Yol', ipucu: 'Yol ücreti ve sürücü ücretinden yol düşümü sıfırlanır; sözleşme ücretini ayrıca güncellemeniz gerekebilir.' },
];

const ORAN_ALANI: Record<OzellikAnahtari, (keyof UcretTablosu)[]> = {
  fazlaMesai: ['fazlaCalisma'], haftaTatili: ['haftaTatili'], resmiTatil: ['resmiTatil'], disGorev: ['disGorev'],
  konaklama: ['konaklama'], yemek: ['yemek'], yol: ['yol'],
};

export function etkinParams(p: Params): Params {
  const k: Params = JSON.parse(JSON.stringify(p));
  const o = k.ozellikler;
  for (const t of [k.ucret.surucu, k.ucret.operator, k.ucret.ffSurucu, k.ucret.ffOperator]) {
    for (const a of Object.keys(ORAN_ALANI) as OzellikAnahtari[]) if (o[a] === false) for (const f of ORAN_ALANI[a]) t[f] = 0;
  }
  if (o.yemek === false) { k.bordro.yemekGunluk = 0; k.bordro.yemekIstisnaGunluk = 0; }
  if (o.yol === false) k.bordro.yolGunluk = 0;
  return k;
}

/**
 * Günlük giriş verisi (sürücü günleri): kapalı kalemler sıfır sayılır. Girdi değiştirilmez, kopya döner.
 * Excel kuralında dış görev (tam) / konaklama günlerinde yemek ve yol verilmez. Bu kalemlerden biri kapatılınca
 * yemek/yol hakkı kendiliğinden değişmesin diye, kapatmadan ÖNCEKİ hak durumu dondurulur (bir kalemi kapatmak yalnız onu etkiler).
 */
export function gunlerineUygula(gunler: SurucuGun[], o: Params['ozellikler'], kartlar: Pick<SurucuKart, 'id' | 'yolHakki'>[] = [], disGorevdeVar = false): SurucuGun[] {
  if (Object.values(o).every((x) => x !== false)) return gunler;
  const kart = new Map(kartlar.map((k) => [k.id, k]));
  // Dış görev / konaklama günlerinde yemek-yol verilmiyorsa (Excel kuralı) bu kalemler kapanınca hak durumu dondurulur;
  // çalışılan her gün yemek-yol veriliyorsa kalemler birbirine bağlı değildir.
  const bagKapali = !disGorevdeVar && (o.disGorev === false || o.konaklama === false);
  return gunler.map((g) => {
    let yemekOv = g.yemekOverride, yolOv = g.yolOverride;
    if (bagKapali) {
      if (yemekOv === null || yemekOv === undefined) yemekOv = yemekOtomatik(g, disGorevdeVar);
      if (yolOv === null || yolOv === undefined) yolOv = yolHakki(g, kart.get(g.driverId), disGorevdeVar);
    }
    return {
      ...g,
      fazlaMesai: o.fazlaMesai === false ? 0 : g.fazlaMesai,
      haftaTatili: o.haftaTatili === false ? false : g.haftaTatili,
      resmiTatil: o.resmiTatil === false ? 0 : g.resmiTatil,
      disGorev: o.disGorev === false ? 0 : g.disGorev,
      konaklama: o.konaklama === false ? false : g.konaklama,
      yemekOverride: o.yemek === false ? false : yemekOv,
      yolOverride: o.yol === false ? false : yolOv,
    };
  });
}

/** Excel kurum çıktısı için veritabanı satırı (surucu_gunleri) üzerinde aynı kural */
export function gunSatiriUygula<T extends Record<string, any>>(r: T, o: Params['ozellikler'], yolHakkiVar = true, disGorevdeVar = false): T {
  const c: any = { ...r };
  if (!disGorevdeVar && (o.disGorev === false || o.konaklama === false)) {
    const oto = (r.durum === 'X' || r.durum === 'B') && !(Number(r.dis_gorev) === 1 || Number(r.konaklama) === 1);
    if (r.yemek_override == null) c.yemek_override = oto ? 1 : 0;
    if (r.yol_override == null) c.yol_override = yolHakkiVar && oto ? 1 : 0;
  }
  if (o.fazlaMesai === false) c.fazla_mesai = 0;
  if (o.haftaTatili === false) c.hafta_tatili = 0;
  if (o.resmiTatil === false) c.resmi_tatil = 0;
  if (o.disGorev === false) c.dis_gorev = 0;
  if (o.konaklama === false) c.konaklama = 0;
  if (o.yemek === false) c.yemek_override = 0;
  if (o.yol === false) c.yol_override = 0;
  return c;
}
