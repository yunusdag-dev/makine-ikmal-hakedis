/**
 * AŞAMA 1 — Kurum puantajı (Ağustos 2026.xlsx mantığı, RULES.md bölüm 2).
 * Günlük kayıtlar (tarih + sürücü + araç) aylık sürücü ve araç toplamlarına dönüştürülür.
 * Sürücüye bağlı her şey sürücüden, KM ve araç çalışma günü araçtan toplanır.
 */
import { AracKart, AracSefer, SurucuGun, SurucuKart } from './types';

/** Excel plaka L sütunu: =AP*IF(OR(S="x",T="x"),0,1); AP = IF(OR(K="X",K="B"),1,0) */
/**
 * disGorevdeVar = true : çalışılan (X / B) her gün yemek ve yol "var" (dış görev ve konaklama günleri dahil)
 * disGorevdeVar = false: Excel kuralı, dış görev (tam) ve konaklama günlerinde yok
 */
export function yemekOtomatik(g: SurucuGun, disGorevdeVar: boolean): boolean {
  const ap = g.durum === 'X' || g.durum === 'B';
  return ap && (disGorevdeVar || !(g.disGorev === 1 || g.konaklama));
}

export function yemekHakki(g: SurucuGun, disGorevdeVar: boolean): boolean {
  return g.yemekOverride ?? yemekOtomatik(g, disGorevdeVar);
}

/** Yol: Excel'de yemek ile aynı formül; sürücü kartında "yol hakkı yok" ise varsayılan 0, gün bazında elle değiştirilebilir. */
export function yolHakki(g: SurucuGun, kart: Pick<SurucuKart, 'yolHakki'> | undefined, disGorevdeVar: boolean): boolean {
  if (g.yolOverride !== null && g.yolOverride !== undefined) return g.yolOverride;
  return (kart?.yolHakki ?? true) && yemekOtomatik(g, disGorevdeVar);
}

export interface SurucuAylik {
  driverId: number;
  /** HAKEDİŞ!E / plaka G41: 'X' sayısı */
  surucuCalisma: number;
  /** EK-4 AH: X + B */
  calisilanGun: number;
  raporlu: number;
  izin: number;
  calisilmayan: number;
  toplamGun: number;
  fazlaMesai: number;
  haftaTatili: number;
  resmiTatil: number;
  disGorev: number;
  konaklama: number;
  yemek: number;
  yol: number;
  /** EK-4 AM: fazla mesai + hafta tatili × 7.5 */
  fazlaCalismaSaati: number;
}

/** gunler: ayın tüm günleri (YYYY-MM-DD, sıralı); kayitlar: o sürücünün o aydaki günleri */
export function surucuAylik(
  driverId: number,
  gunler: string[],
  kayitlar: SurucuGun[],
  kart: Pick<SurucuKart, 'yolHakki'> | undefined,
  haftaTatiliSaat: number,
  disGorevdeVar = false,
): SurucuAylik {
  const byDate = new Map(kayitlar.map((k) => [k.tarih, k]));
  let X = 0, B = 0, R = 0, izin = 0, sifir = 0;
  let fm = 0, ht = 0, rt = 0, dgSayisal = 0, dgTam = 0, kon = 0, yemek = 0, yol = 0;
  for (const t of gunler) {
    const g = byDate.get(t);
    if (!g || g.durum === '' || g.durum === '0') { sifir++; }
    if (!g) continue;
    switch (g.durum) {
      case 'X': X++; break;
      case 'B': B++; break;
      case 'R': R++; break;
      case 'Sİ': case 'Üİ': case 'Mİ': case 'İİ': izin++; break;
    }
    if (g.fazlaMesai) fm += g.fazlaMesai;
    if (g.haftaTatili) ht++;
    if (g.resmiTatil) rt += g.resmiTatil;
    if (g.disGorev === 1) dgTam++;
    else if (g.disGorev) dgSayisal += g.disGorev;
    if (g.konaklama) kon++;
    if (yemekHakki(g, disGorevdeVar)) yemek++;
    if (yolHakki(g, kart, disGorevdeVar)) yol++;
  }
  return {
    driverId,
    surucuCalisma: X,
    calisilanGun: X + B,
    raporlu: R,
    izin,
    calisilmayan: sifir,
    toplamGun: gunler.length,
    fazlaMesai: fm,
    haftaTatili: ht,
    resmiTatil: rt,
    disGorev: dgSayisal + dgTam,
    konaklama: kon,
    yemek,
    yol,
    fazlaCalismaSaati: fm + ht * haftaTatiliSaat,
  };
}

export interface AracAylik {
  vehicleId: number;
  ig: number;
  igd: number;
  /** F41: İG + İGD */
  aracCalisma: number;
  kapanisKm: number;
  /** H41: MAX − MIN */
  toplamKm: number;
  /** I41: Σ(dönüş − çıkış) */
  hizmetIciKm: number;
  /** J41 */
  hariciKm: number;
  kmGirisSayisi: number;
}

export function aracAylik(vehicleId: number, seferler: AracSefer[]): AracAylik {
  const s = seferler.filter((x) => x.vehicleId === vehicleId).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const igGun = new Set<string>();
  const igdGun = new Map<string, number>();
  const kms: number[] = [];
  let hizmetIci = 0;
  let giris = 0;
  for (const x of s) {
    if (x.aracIG) igGun.add(x.tarih);
    if (x.aracIGD) igdGun.set(x.tarih, Math.max(igdGun.get(x.tarih) ?? 0, x.aracIGD));
    if (x.kmCikis != null) kms.push(x.kmCikis);
    if (x.kmDonus != null) kms.push(x.kmDonus);
    if (x.kmCikis != null && x.kmDonus != null) { hizmetIci += x.kmDonus - x.kmCikis; giris++; }
  }
  let igd = 0;
  for (const t of [...igdGun.keys()].sort()) igd += igdGun.get(t)!;
  const max = kms.length ? Math.max(...kms) : 0;
  const min = kms.length ? Math.min(...kms) : 0;
  return {
    vehicleId,
    ig: igGun.size,
    igd,
    aracCalisma: igGun.size + igd,
    kapanisKm: max,
    toplamKm: max - min,
    hizmetIciKm: hizmetIci,
    hariciKm: max - min - hizmetIci,
    kmGirisSayisi: giris,
  };
}

/** HAKEDİŞ sayfası satırı (Aşama 2'ye aktarılan veri) */
export interface KurumHakedisSatiri {
  driverId: number | null;
  vehicleId: number | null;
  plaka: string;
  surucu: string;
  /** Bu satır aracın birincil satırı mı (araç kalemleri yalnız birincil satırda) */
  aracBirincil: boolean;
  ig: number;
  igd: number;
  surucuCalisma: number;
  kapanisKm: number;
  hizmetIciKm: number;
  fazlaMesai: number;
  haftaTatili: number;
  resmiTatil: number;
  disGorev: number;
  konaklama: number;
  yemek: number;
  yol: number;
  surucuAy?: SurucuAylik;
  aracAy?: AracAylik;
}

/**
 * Sürücü bazlı satırlar: her aktif sürücü + varsayılan aracı. Aynı varsayılan aracı paylaşan
 * sürücülerde araç kalemleri ilk sürücünün satırına yazılır. Sürücüsü olmayan aktif araçlar
 * ayrıca (sürücüsüz) satır olarak eklenir.
 */
export function kurumHakedis(
  gunler: string[],
  suruculer: SurucuKart[],
  araclar: AracKart[],
  surucuGunleri: SurucuGun[],
  seferler: AracSefer[],
  haftaTatiliSaat: number,
  disGorevdeVar = false,
): KurumHakedisSatiri[] {
  const aracById = new Map(araclar.map((a) => [a.id, a]));
  const satirlar: KurumHakedisSatiri[] = [];
  const kullanilanArac = new Set<number>();
  const aktifSurucu = suruculer.filter((s) => s.aktif || surucuGunleri.some((g) => g.driverId === s.id)).sort((a, b) => a.sira - b.sira || a.id - b.id);
  for (const s of aktifSurucu) {
    const sa = surucuAylik(s.id, gunler, surucuGunleri.filter((g) => g.driverId === s.id), s, haftaTatiliSaat, disGorevdeVar);
    const arac = s.varsayilanAracId != null ? aracById.get(s.varsayilanAracId) : undefined;
    const birincil = !!arac && !kullanilanArac.has(arac.id);
    if (arac) kullanilanArac.add(arac.id);
    const aa = arac && birincil ? aracAylik(arac.id, seferler) : undefined;
    satirlar.push(satirOlustur(s.id, arac ?? null, s.adSoyad, birincil, sa, aa));
  }
  const kalanAraclar = araclar
    .filter((a) => !kullanilanArac.has(a.id) && (a.aktif || seferler.some((x) => x.vehicleId === a.id)))
    .sort((a, b) => a.sira - b.sira || a.id - b.id);
  for (const a of kalanAraclar) {
    satirlar.push(satirOlustur(null, a, '', true, undefined, aracAylik(a.id, seferler)));
  }
  return satirlar;
}

function satirOlustur(
  driverId: number | null,
  arac: AracKart | null,
  surucu: string,
  birincil: boolean,
  sa: SurucuAylik | undefined,
  aa: AracAylik | undefined,
): KurumHakedisSatiri {
  return {
    driverId,
    vehicleId: arac?.id ?? null,
    plaka: arac?.plaka ?? '',
    surucu,
    aracBirincil: birincil,
    ig: aa?.ig ?? 0,
    igd: aa?.igd ?? 0,
    surucuCalisma: sa?.surucuCalisma ?? 0,
    kapanisKm: aa?.kapanisKm ?? 0,
    hizmetIciKm: aa?.hizmetIciKm ?? 0,
    fazlaMesai: sa?.fazlaMesai ?? 0,
    haftaTatili: sa?.haftaTatili ?? 0,
    resmiTatil: sa?.resmiTatil ?? 0,
    disGorev: sa?.disGorev ?? 0,
    konaklama: sa?.konaklama ?? 0,
    yemek: sa?.yemek ?? 0,
    yol: sa?.yol ?? 0,
    surucuAy: sa,
    aracAy: aa,
  };
}
