/**
 * Bir ayın (dönemin) tüm hesaplarını uçtan uca yapar:
 * günlük kayıtlar -> Aşama 1 (kurum) -> Aşama 2 girişi (otomatik aktarım + elle alanlar) -> Aşama 2 (firma).
 * Arayüz ve Excel çıktıları bu tek fonksiyonun sonucunu kullanır.
 */
import { Params } from './params';
import { Tatil, ayTakvimi, AyTakvimi } from './calendar';
import { ayGunSayisi, parseAy, tarihStr } from './excel';
import { kurumHakedis, KurumHakedisSatiri } from './kurum';
import { firmaHakedis, FirmaGirisSatiri, FirmaSonuc } from './firma';
import { AracKart, AracSefer, SurucuGun, SurucuKart } from './types';
import { etkinParams, gunlerineUygula } from './ozellik';

export interface SurucuKartTam extends SurucuKart {
  iseGiris: string;
}

export interface AracAyGirdisi {
  oncekiKm: number | null;
  hizmetDisiGun: number;
  kmDuzeltme: number;
  kmDuzeltmeAciklama: string;
  kiraBedeli: number | null;
  tuketimOrani: number | null;
  yakitYansitmaCarpani: number | null;
}

export interface SurucuAyGirdisi {
  hizmetDisiGun: number;
  fazlaMesaiDuzeltme: number;
  konaklamaBirimFiyat: number | null;
  kumulatifGvm: number | null;
  calismaAyi: number | null;
  ozelSigorta: number;
}

export interface DonemVerisi {
  ay: string; // YYYY-MM
  params: Params;
  tatiller: Tatil[];
  suruculer: SurucuKartTam[];
  araclar: (AracKart & { baslangicKm: number | null })[];
  surucuGunleri: SurucuGun[];
  seferler: AracSefer[];
  aracAylari: Record<number, AracAyGirdisi>;
  surucuAylari: Record<number, SurucuAyGirdisi>;
  /** Araçların bu aydan önceki en büyük KM değeri (önceki ay kapanış otomatik) */
  oncekiKmOtomatik: Record<number, number>;
  /** Önceki ayın kapanış kümülatif GV matrahı (otomatik) */
  oncekiKumulatifOtomatik: Record<number, number>;
}

export type UyariSeviye = 'hata' | 'uyari' | 'bilgi';
export interface Uyari {
  seviye: UyariSeviye;
  mesaj: string;
  driverId?: number | null;
  vehicleId?: number | null;
  tarih?: string;
}

export interface DonemSonucu {
  ay: string;
  takvim: AyTakvimi;
  gunler: string[];
  kurum: KurumHakedisSatiri[];
  giris: FirmaGirisSatiri[];
  firma: FirmaSonuc;
  uyarilar: Uyari[];
  /** Bu ay için hiç puantaj / sefer / aylık giriş yok: tüm tutarlar sıfırdır, satır üretilmez */
  veriYok: boolean;
}

export function ayinGunleri(ay: string): string[] {
  const { yil, ay: m } = parseAy(ay);
  return Array.from({ length: ayGunSayisi(yil, m) }, (_, i) => tarihStr(yil, m, i + 1));
}

export function varsayilanCalismaAyi(ay: string, iseGiris: string): number {
  const { yil, ay: m } = parseAy(ay);
  if (iseGiris && iseGiris.length >= 7) {
    const gy = Number(iseGiris.slice(0, 4));
    const gm = Number(iseGiris.slice(5, 7));
    if (gy === yil && gm <= m) return m - gm + 1;
  }
  return m;
}

export function donemHesapla(v0: DonemVerisi): DonemSonucu {
  // Kapalı ödeme kalemleri (Ayarlar > Özellikler): birim ücretler ve günlük girişler sıfır sayılır
  const p = etkinParams(v0.params);
  const oz = p.ozellikler;
  const v: DonemVerisi = {
    ...v0,
    params: p,
    surucuGunleri: gunlerineUygula(v0.surucuGunleri, oz, v0.suruculer),
    surucuAylari: oz.fazlaMesai === false
      ? Object.fromEntries(Object.entries(v0.surucuAylari).map(([k, a]) => [k, { ...a, fazlaMesaiDuzeltme: 0 }]))
      : v0.surucuAylari,
  };
  const { yil, ay: m } = parseAy(v.ay);
  const gunler = ayinGunleri(v.ay);
  const takvim = ayTakvimi(yil, m, v.tatiller, p);
  const ayBas = gunler[0], aySon = gunler[gunler.length - 1];
  const sg = v.surucuGunleri.filter((g) => g.tarih >= ayBas && g.tarih <= aySon);
  const sf = v.seferler.filter((s) => s.tarih >= ayBas && s.tarih <= aySon);
  const veriYok = sg.length === 0 && sf.length === 0 && Object.keys(v.aracAylari).length === 0 && Object.keys(v.surucuAylari).length === 0;
  if (veriYok) {
    // Henüz girilmemiş ay: sabit sürücü ücreti / araç kirası faturalanmaz, her şey sıfır.
    return { ay: v.ay, takvim, gunler, kurum: [], giris: [], firma: firmaHakedis([], p, gunler.length), uyarilar: [], veriYok: true };
  }
  const kurum = kurumHakedis(gunler, v.suruculer, v.araclar, sg, sf, p.puantaj.haftaTatiliSaat);
  const aracById = new Map(v.araclar.map((a) => [a.id, a]));
  const surucuById = new Map(v.suruculer.map((s) => [s.id, s]));
  const uyarilar: Uyari[] = [];

  const giris: FirmaGirisSatiri[] = kurum.map((k, i) => {
    const a = k.vehicleId != null ? aracById.get(k.vehicleId) : undefined;
    const s = k.driverId != null ? surucuById.get(k.driverId) : undefined;
    const aa = k.vehicleId != null ? v.aracAylari[k.vehicleId] : undefined;
    const sa = k.driverId != null ? v.surucuAylari[k.driverId] : undefined;
    const oncekiOto = k.vehicleId != null ? v.oncekiKmOtomatik[k.vehicleId] ?? a?.baslangicKm ?? null : null;
    const oncekiKm = aa?.oncekiKm ?? oncekiOto ?? 0;
    const kapanis = k.kapanisKm || (k.aracAy && k.aracAy.kmGirisSayisi === 0 ? oncekiKm : k.kapanisKm);
    let kum = sa?.kumulatifGvm ?? null;
    if (kum == null) kum = m === 1 ? 0 : k.driverId != null ? v.oncekiKumulatifOtomatik[k.driverId] ?? 0 : 0;
    return {
      key: `${k.driverId ?? 'x'}-${k.vehicleId ?? 'x'}`,
      driverId: k.driverId,
      vehicleId: k.vehicleId,
      plaka: k.plaka,
      surucu: k.surucu,
      markaModel: a?.markaModel ?? '',
      modelYili: a?.modelYili ?? null,
      aracTipi: a?.aracTipi ?? '',
      gorevYeri: a?.gorevYeri ?? '',
      tuketimOrani: aa?.tuketimOrani ?? a?.tuketimOrani ?? 0,
      kiraBedeli: aa?.kiraBedeli ?? a?.kiraBedeli ?? 0,
      oncekiKm,
      hizmetDisiGunSurucu: sa?.hizmetDisiGun ?? 0,
      hizmetDisiGunArac: aa?.hizmetDisiGun ?? 0,
      ig: k.ig,
      igd: k.igd,
      surucuCalisma: k.surucuCalisma,
      kapanisKm: kapanis,
      hizmetIciKm: k.hizmetIciKm,
      fazlaMesai: k.fazlaMesai + (sa?.fazlaMesaiDuzeltme ?? 0),
      haftaTatili: k.haftaTatili,
      resmiTatil: k.resmiTatil,
      disGorev: k.disGorev,
      konaklama: k.konaklama,
      yemek: k.yemek,
      yol: k.yol,
      kmDuzeltme: aa?.kmDuzeltme ?? 0,
      yakitYansitmaCarpani: aa?.yakitYansitmaCarpani ?? a?.yakitYansitmaCarpani ?? 1,
      konaklamaBirimFiyat: sa?.konaklamaBirimFiyat ?? null,
      ucretGrubu: s?.ucretGrubu ?? 'surucu',
      surucuVar: k.driverId != null,
      aracVar: k.vehicleId != null && k.aracBirincil,
      emekli: s?.emekli ?? false,
      kumulatifGvm: kum,
      calismaAyi: sa?.calismaAyi ?? varsayilanCalismaAyi(v.ay, s?.iseGiris ?? ''),
      ozelSigorta: sa?.ozelSigorta ?? 0,
    };
  });

  // ---- Doğrulama / uyarılar
  const atanmisAraclar = new Set(v.suruculer.filter((s) => s.aktif && s.varsayilanAracId != null).map((s) => s.varsayilanAracId));
  for (const a of v.araclar) {
    if (a.aktif && !atanmisAraclar.has(a.id)) uyarilar.push({ seviye: 'bilgi', mesaj: `${a.plaka}: bu ay hiçbir sürücüye atanmamış (Sürücüler ekranından atama yapabilirsiniz).`, vehicleId: a.id });
  }
  for (const g of giris) {
    const ad = g.surucu || g.plaka;
    if (g.vehicleId != null && g.aracVar) {
      if (g.kapanisKm < g.oncekiKm)
        uyarilar.push({ seviye: 'hata', mesaj: `${g.plaka}: kapanış KM (${g.kapanisKm}) önceki ay kapanışından (${g.oncekiKm}) küçük.`, vehicleId: g.vehicleId });
      const hd = g.kapanisKm - g.oncekiKm - (g.hizmetIciKm + g.kmDuzeltme);
      if (hd < 0)
        uyarilar.push({ seviye: 'uyari', mesaj: `${g.plaka}: hizmet dışı KM negatif (${hd}). KM girişlerini kontrol edin.`, vehicleId: g.vehicleId });
      if (!g.kiraBedeli) uyarilar.push({ seviye: 'uyari', mesaj: `${g.plaka}: araç kira bedeli girilmemiş.`, vehicleId: g.vehicleId });
      if (!g.tuketimOrani) uyarilar.push({ seviye: 'bilgi', mesaj: `${g.plaka}: yakıt tüketim oranı girilmemiş.`, vehicleId: g.vehicleId });
    }
    if (g.driverId != null && g.vehicleId == null)
      uyarilar.push({ seviye: 'uyari', mesaj: `${ad}: varsayılan araç atanmamış.`, driverId: g.driverId });
    if (g.driverId != null && g.surucuCalisma === 0 && g.hizmetDisiGunSurucu === 0)
      uyarilar.push({ seviye: 'bilgi', mesaj: `${ad}: bu ay hiç çalışma günü girilmemiş.`, driverId: g.driverId });
  }
  for (const s of sf) {
    if (s.kmCikis != null && s.kmDonus != null && s.kmDonus < s.kmCikis)
      uyarilar.push({ seviye: 'hata', mesaj: `${aracById.get(s.vehicleId)?.plaka ?? ''} ${s.tarih}: dönüş KM çıkış KM'den küçük.`, vehicleId: s.vehicleId, driverId: s.driverId, tarih: s.tarih });
    if ((s.kmCikis == null) !== (s.kmDonus == null))
      uyarilar.push({ seviye: 'uyari', mesaj: `${aracById.get(s.vehicleId)?.plaka ?? ''} ${s.tarih}: çıkış veya dönüş KM eksik.`, vehicleId: s.vehicleId, driverId: s.driverId, tarih: s.tarih });
  }
  // KM sürekliliği (araç bazında ardışık seferler)
  const byArac = new Map<number, AracSefer[]>();
  for (const s of sf) { const a = byArac.get(s.vehicleId) ?? []; a.push(s); byArac.set(s.vehicleId, a); }
  for (const [vid, list] of byArac) {
    const sirali = list.filter((x) => x.kmCikis != null).sort((a, b) => a.tarih.localeCompare(b.tarih) || (a.kmCikis! - b.kmCikis!));
    for (let i = 1; i < sirali.length; i++) {
      const once = sirali[i - 1], simdi = sirali[i];
      if (once.kmDonus != null && simdi.kmCikis! < once.kmDonus)
        uyarilar.push({ seviye: 'uyari', mesaj: `${aracById.get(vid)?.plaka}: ${simdi.tarih} çıkış KM (${simdi.kmCikis}) bir önceki dönüş KM'den (${once.kmDonus}) küçük.`, vehicleId: vid, tarih: simdi.tarih });
    }
  }
  for (const g of sg) {
    if (g.durum !== 'X' && g.durum !== 'B' && (g.fazlaMesai || g.disGorev || g.konaklama))
      uyarilar.push({ seviye: 'uyari', mesaj: `${surucuById.get(g.driverId)?.adSoyad ?? ''} ${g.tarih}: çalışma kodu "X" değil ama mesai/dış görev/konaklama girilmiş.`, driverId: g.driverId, tarih: g.tarih });
    if (g.fazlaMesai > 24) uyarilar.push({ seviye: 'hata', mesaj: `${surucuById.get(g.driverId)?.adSoyad ?? ''} ${g.tarih}: fazla mesai 24 saati aşıyor.`, driverId: g.driverId, tarih: g.tarih });
  }

  const firma = firmaHakedis(giris, p, gunler.length);
  return { ay: v.ay, takvim, gunler, kurum, giris, firma, uyarilar, veriYok: false };
}
