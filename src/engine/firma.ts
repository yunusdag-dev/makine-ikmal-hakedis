/**
 * AŞAMA 2 — Firma hakedişi (Enzel ... Hakediş.xlsx mantığı, RULES.md bölüm 3).
 * Formüller Excel'deki hücre sırası ve ROUND noktalarıyla birebir uygulanır.
 * Hücre adları yorumlarda verilmiştir (plaka formu / ÖN TABLO / Sürücü Faaliyet).
 */
import { xround } from './excel';
import { Params, UcretTablosu } from './params';
import { UcretGrubu } from './types';

/** Firma "Giriş" sayfasının bir satırı + satıra özel düzeltmeler */
export interface FirmaGirisSatiri {
  key: string;
  driverId: number | null;
  vehicleId: number | null;
  plaka: string;
  surucu: string;
  markaModel: string;
  modelYili: number | null;
  aracTipi: string;
  gorevYeri: string;
  /** G: yakıt tüketim oranı (lt/km) */
  tuketimOrani: number;
  /** H: araç kira bedeli */
  kiraBedeli: number;
  /** I: önceki ay kapanış KM */
  oncekiKm: number;
  /** J: hizmet dışı gün (sürücü) */
  hizmetDisiGunSurucu: number;
  /** K: hizmet dışı gün (araç) */
  hizmetDisiGunArac: number;
  // L..W (Aşama 1'den)
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
  // Satır düzeltmeleri / sürücü bilgileri
  /** Hizmet içi KM elle düzeltmesi (plaka formu G17 = P + düzeltme) */
  kmDuzeltme: number;
  /** Akaryakıt yansıtma çarpanı (I15 = ROUND(çarpan × G19×L7×L8; 2)) */
  yakitYansitmaCarpani: number;
  /** Konaklama günlük birim fiyatı (null = ücret tablosundaki standart fiyat) */
  konaklamaBirimFiyat: number | null;
  ucretGrubu: UcretGrubu;
  /** Sürücü yoksa sürücü kalemleri hesaplanmaz */
  surucuVar: boolean;
  /** Araç kalemleri bu satırda mı (aynı aracı paylaşan ikinci sürücüde false) */
  aracVar: boolean;
  emekli: boolean;
  /** Y: önceki aylar kümülatif gelir vergisi matrahı */
  kumulatifGvm: number;
  /** AK: çalışma ayı (vergi indirimi tablosu satırı) */
  calismaAyi: number;
  /** AM: özel sigorta */
  ozelSigorta: number;
}

export interface PlakaFormu {
  key: string;
  // Araç
  G15_oncekiKm: number; G16_kapanisKm: number; G17_hizmetIciKm: number; G19_hizmetDisiKm: number;
  I15_yakitYansitma: number; I17_hizmetDisiGun: number; I18_kesinti: number;
  L7_tuketim: number; L8_epdk: number; L9_kira: number;
  M19_pn: number; M20_aracFiyatFarki: number;
  K35_aracKiralama: number; K36_aracKdv: number; K37_aracTevkifat: number; K38_aracToplam: number;
  // Sürücü
  B26: number; D26: number; E26: number; F26: number; G26: number; H26: number; I26: number;
  B27: number; D27: number; E27: number; F27: number; G27: number; H27: number; I27: number;
  B28: number; D28: number; E28: number; F28: number; G28: number; H28: number; I28: number;
  K26_surucuUcreti: number; L26_fiyatFarki: number; M26_asgariFark: number; K28_toplamSurucu: number;
  K31: number; K32: number; K33: number; K34: number;
  K39: number; K40: number; K41: number; K42: number; K43: number;
  K44: number; K45: number; K46: number;
}

export interface OnTabloSatiri {
  key: string;
  no: number;
  surucu: string; gorevYeri: string; aracTipi: string; plaka: string;
  F_surucuUcreti: number; G_iscilikFF: number; H_asgariFark: number; I_iscilikToplam: number;
  J_iscilikKdv: number; K_iscilikGenel: number;
  L_kira: number; M_aracFF: number; N_aracToplam: number; O_aracKdv: number; P_aracGenel: number;
  Q_konaklama: number; R_konaklamaKdv: number; S_konaklamaGenel: number;
  T_disGorev: number; U_akaryakit: number; V_kdvHaric: number; W_kdvDahil: number;
}

export interface OnTabloToplam {
  F: number; G: number; H: number; I: number; J: number; K: number; L: number; M: number; N: number; O: number; P: number;
  Q: number; R: number; S: number; T: number; U: number; V: number; W: number; X: number;
}

export interface FaturaOzeti {
  iscilik: number; arac: number; konaklama: number;
  iscilikKdv: number; aracKdv: number; konaklamaKdv: number;
  iscilikTevkifat: number; aracTevkifat: number; konaklamaTevkifat: number;
  faturaToplami: number; damgaVergisi: number;
}

export interface SurucuFaaliyetSatiri {
  key: string;
  plaka: string; surucu: string;
  C: number; D: number; E: number; F: number; G: number; H: number; I: number; J: number; K: number; L: number;
  P_temel: number; Q_resmiTatil: number; R_fazlaMesai: number; S_konaklama: number; T_disGorev: number;
  U_yemek: number; V_yol: number; W_brut: number;
  X_emekli: boolean; Y_kumulatif: number; Z_sgkIstisna: number; AA_sgkMatrah: number;
  AB_gvmAylik: number; AC_gvmYillik: number; AD_sgk: number; AE_issizlik: number;
  AF_gelirVergisi: number; AG_hGelirVergisi: number; AH_damga: number; AI_hDamga: number;
  AJ_odenecek: number; AK_calismaAyi: number; AL_vergiIndirimi: number; AM_ozelSigorta: number;
  AO_ayGunu: number; AP_raporIzin: number; AQ_calismaGunu: number; AR_kesinti: number;
}

export interface AracFaaliyetSatiri {
  key: string; plaka: string; surucu: string;
  C_km: number; D_kira: number; E_surucuUcreti: number; F_hizmetDisi: number; G_kapanisKm: number; H_kumulatif: number;
}

export interface BordroSatiri { key: string; surucu: string; plaka: string; tutar: number }

export interface FirmaSonuc {
  formlar: PlakaFormu[];
  onTablo: OnTabloSatiri[];
  onTabloToplam: OnTabloToplam;
  fatura: FaturaOzeti;
  surucuFaaliyet: SurucuFaaliyetSatiri[];
  surucuFaaliyetToplam: number;
  aracFaaliyet: AracFaaliyetSatiri[];
  bordro: BordroSatiri[];
  bordroToplam: number;
  vergiIndirimTablosu: { ay: number; tutar: number; aylikMatrah: number; kumulatif: number }[];
}

const r2 = (x: number) => xround(x, 2);

function ucretTablosu(p: Params, g: UcretGrubu): UcretTablosu {
  return g === 'operator' ? p.ucret.operator : p.ucret.surucu;
}
function ffTablosu(p: Params, g: UcretGrubu): UcretTablosu {
  if (g === 'operator' && !p.fiyatFarki.operatorSurucuTablosunuKullan) return p.ucret.ffOperator;
  return p.ucret.ffSurucu;
}

/** M19: Pn = ROUND(a1 + ROUND(a2·İn/İo;5) + ROUND(b3·Gn/Go;5) + ROUND(c·Mn/Mo;5); 5) */
export function fiyatFarkiKatsayisi(p: Params): number {
  const f = p.fiyatFarki;
  let s = f.a1;
  if (f.a2) s += xround(f.a2 * (f.In / f.Io), 5);
  s += xround(f.b3 * (f.Gn / f.Go), 5);
  s += xround(f.c * (f.Mn / f.Mo), 5);
  return xround(s, 5);
}

export function plakaFormu(r: FirmaGirisSatiri, p: Params, pn: number): Omit<PlakaFormu, 'K40' | 'K41' | 'K43'> {
  const K20 = p.fiyatFarki.B;
  const gun = p.ucret.ayBolenGun;
  // --- Araç ---
  const G15 = r.oncekiKm, G16 = r.kapanisKm, G17 = r.hizmetIciKm + r.kmDuzeltme;
  const G19 = G16 - G15 - G17;
  const L7 = r.tuketimOrani, L8 = p.epdkYakitFiyati, L9 = r.aracVar ? r.kiraBedeli : 0;
  const I15 = r.aracVar ? r2(r.yakitYansitmaCarpani * (G19 * L7 * L8)) : 0;
  const I17 = r.hizmetDisiGunArac;
  const I18 = (I17 * L9) / gun;
  const M20 = r2((L9 - I18) * (pn - 1) * K20);
  const K35 = r2(L9 - I18 + M20);
  const K36 = r2(K35 * p.vergi.kdv);
  const K37 = r2(K36 * p.vergi.aracTevkifat);
  const K38 = r2(K35 + K36 - K37);
  // --- Sürücü ---
  const u = ucretTablosu(p, r.ucretGrubu);
  const ff = ffTablosu(p, r.ucretGrubu);
  const sv = r.surucuVar;
  const B26 = u.fazlaCalisma, D26 = u.haftaTatili, E26 = u.resmiTatil, F26 = u.disGorev;
  const G26 = r.konaklamaBirimFiyat ?? u.konaklama;
  const H26 = u.yemek, I26 = u.yol;
  const B27 = sv ? r.fazlaMesai : 0;
  const D27 = sv ? p.puantaj.haftaTatiliSaat * r.haftaTatili : 0;
  const E27 = sv ? r.resmiTatil : 0;
  const F27 = sv ? r.disGorev : 0;
  const G27 = sv ? r.konaklama : 0;
  const H27 = sv ? r.yemek : 0;
  const I27 = sv ? r.yol : 0;
  const B28 = r2(B26 * B27), D28 = r2(D26 * D27), E28 = r2(E26 * E27), F28 = r2(F26 * F27);
  const G28 = r2(G26 * G27), H28 = r2(H26 * H27), I28 = r2(I26 * I27);
  const ucret = u.ucretBrut - u.ucretKesinti;
  const ffUcret = ff.ucretBrut - ff.ucretKesinti;
  const dusum = p.ucret.yemekYolDusumGun;
  const K26 = sv ? ucret - (u.yemek * dusum + u.yol * dusum) : 0;
  const L26 = sv
    ? (K20 * (pn - 1)) *
      (ffUcret + B27 * ff.fazlaCalisma + D27 * ff.haftaTatili + E27 * ff.resmiTatil + H27 * ff.yemek + I27 * ff.yol - (ffUcret / gun) * r.hizmetDisiGunSurucu)
    : 0;
  const M26 = sv ? p.fiyatFarki.asgariUcretFarki : 0;
  const K28 = r2(K26 + L26 + M26 + B28 + D28 + E28 + F28 + H28 + I28);
  const K31 = r2(K28);
  const K32 = r2(K31 * p.vergi.kdv);
  const K33 = r2(K32 * p.vergi.iscilikTevkifat);
  const K34 = r2(K31 + (K32 - K33));
  const K39 = G28;
  const K42 = r2(K31 + K35 + K39);
  const K44 = r2(I15);
  const K45 = r2(K44 * p.vergi.kdv);
  const K46 = r2(K44 + K45);
  return {
    key: r.key,
    G15_oncekiKm: G15, G16_kapanisKm: G16, G17_hizmetIciKm: G17, G19_hizmetDisiKm: G19,
    I15_yakitYansitma: I15, I17_hizmetDisiGun: I17, I18_kesinti: I18,
    L7_tuketim: L7, L8_epdk: L8, L9_kira: L9, M19_pn: pn, M20_aracFiyatFarki: M20,
    K35_aracKiralama: K35, K36_aracKdv: K36, K37_aracTevkifat: K37, K38_aracToplam: K38,
    B26, D26, E26, F26, G26, H26, I26, B27, D27, E27, F27, G27, H27, I27, B28, D28, E28, F28, G28, H28, I28,
    K26_surucuUcreti: K26, L26_fiyatFarki: L26, M26_asgariFark: M26, K28_toplamSurucu: K28,
    K31, K32, K33, K34, K39, K42, K44, K45, K46,
  };
}

/** Sürücü Faaliyet AS2:AT13 — asgari ücret gelir vergisi istisnası (aylık) */
export function vergiIndirimTablosu(p: Params): { ay: number; tutar: number; aylikMatrah: number; kumulatif: number }[] {
  const asg = p.bordro.asgariUcretBrut;
  const oran = p.bordro.gvMatrahOrani;
  const AV = r2(asg * oran);
  const dilimler = p.bordro.gvDilimleri;
  const out: { ay: number; tutar: number; aylikMatrah: number; kumulatif: number }[] = [];
  let onceki = 0;
  for (let ay = 1; ay <= 12; ay++) {
    const kum = onceki + AV;
    const i0 = dilimIndex(dilimler, onceki);
    const i1 = dilimIndex(dilimler, kum);
    let tutar: number;
    if (i0 === i1) {
      tutar = r2(asg * oran * dilimler[i0].oran);
    } else {
      tutar = r2(parcaliVergi(dilimler, onceki, kum));
    }
    out.push({ ay, tutar, aylikMatrah: AV, kumulatif: kum });
    onceki = kum;
  }
  return out;
}

function dilimIndex(d: { ust: number | null }[], x: number): number {
  for (let i = 0; i < d.length; i++) {
    const u = d[i].ust;
    if (u === null || x < u) return i;
  }
  return d.length - 1;
}

/** [alt, ust] aralığının dilimlere bölünmüş vergisi (Excel: (AN5−Y)×0.15 + (Y+AB−AN5)×0.2 …) */
function parcaliVergi(d: { ust: number | null; oran: number }[], alt: number, ust: number): number {
  let s = 0;
  let altSinir = 0;
  let ilk = true;
  for (const dl of d) {
    const u = dl.ust ?? Infinity;
    const a = Math.max(alt, altSinir);
    const b = Math.min(ust, u);
    if (b > a) {
      const v = (b - a) * dl.oran;
      s = ilk ? v : s + v;
      ilk = false;
    }
    altSinir = u;
  }
  return s;
}

/** AG: kümülatif matrahla gelir vergisi (Excel iç içe IF yapısının genelleştirilmiş hali) */
export function gelirVergisi(p: Params, Y: number, AB: number, AL: number): number {
  const d = p.bordro.gvDilimleri;
  const K = Y + AB;
  const i0 = dilimIndex(d, Y);
  const i1 = dilimIndex(d, K);
  if (i0 === i1) return r2(AB * d[i1].oran - AL);
  return r2(parcaliVergi(d, Y, K) - AL);
}

export function surucuFaaliyet(
  r: FirmaGirisSatiri,
  f: Omit<PlakaFormu, 'K40' | 'K41' | 'K43'>,
  p: Params,
  ayGunu: number,
  indirim: { ay: number; tutar: number }[],
): SurucuFaaliyetSatiri {
  const b = p.bordro;
  const asg = b.asgariUcretBrut;
  const carpan = r.ucretGrubu === 'operator' ? b.carpanOperator : b.carpanSurucu;
  const u = ucretTablosu(p, r.ucretGrubu);
  const sv = r.surucuVar;
  const C = sv ? r.surucuCalisma : 0, D = sv ? r.resmiTatil : 0, E = sv ? r.haftaTatili : 0;
  const F = p.puantaj.haftaTatiliSaat * E;
  const G = sv ? r.fazlaMesai : 0;
  const H = F + G;
  const I = sv ? r.konaklama : 0, J = sv ? r.disGorev : 0, K = sv ? r.yemek : 0, L = sv ? r.yol : 0;
  const AO = ayGunu;
  const AP = r.hizmetDisiGunSurucu;
  const AQ = AO - AP;
  const AR = AP > 0 ? b.ayGun - AQ : 0;
  const P = sv ? r2(asg * carpan) * ((b.ayGun - AR) / b.ayGun) : 0;
  const Q = r2(((asg * carpan) / b.ayGun) * D);
  const R = r2(((asg * carpan) / b.aylikSaat) * b.fazlaMesaiZam * H);
  const S = f.G26 === u.konaklama ? f.G28 * b.konaklamaCarpanStandart : f.G28 * b.konaklamaCarpanDiger;
  const T = J * u.disGorev;
  const U = r2(b.yemekGunluk * K);
  const V = r2(b.yolGunluk * L);
  const W = r2(P + Q + R + S + T + U + V);
  const Z = r2(b.yemekIstisnaGunluk * K);
  const AA = r2(W - S - Z);
  const AD = r2(r.emekli ? AA * b.sgdpIsci : AA * b.sgkIsci);
  const AE = r2(r.emekli ? AA * b.issizlikEmekli : AA * b.issizlikIsci);
  const AM = r.ozelSigorta;
  const AB = r2(W - S - Z - AD - AE) - AM;
  const Y = r.kumulatifGvm;
  const AC = r2(Y + AB);
  const AL = indirim.find((x) => x.ay === r.calismaAyi)?.tutar ?? 0;
  const AG = sv ? gelirVergisi(p, Y, AB, AL) : 0;
  const AF = AG < 0 ? 0 : AG;
  const AI = sv ? r2((W - Z - asg) * b.damga) : 0;
  const AH = AI < 0 ? 0 : AI;
  const AJ = W - AD - AE - AF - AH;
  return {
    key: r.key, plaka: r.plaka, surucu: r.surucu,
    C, D, E, F, G, H, I, J, K, L,
    P_temel: P, Q_resmiTatil: Q, R_fazlaMesai: R, S_konaklama: S, T_disGorev: T, U_yemek: U, V_yol: V, W_brut: W,
    X_emekli: r.emekli, Y_kumulatif: Y, Z_sgkIstisna: Z, AA_sgkMatrah: AA, AB_gvmAylik: AB, AC_gvmYillik: AC,
    AD_sgk: AD, AE_issizlik: AE, AF_gelirVergisi: AF, AG_hGelirVergisi: AG, AH_damga: AH, AI_hDamga: AI,
    AJ_odenecek: AJ, AK_calismaAyi: r.calismaAyi, AL_vergiIndirimi: AL, AM_ozelSigorta: AM,
    AO_ayGunu: AO, AP_raporIzin: AP, AQ_calismaGunu: AQ, AR_kesinti: AR,
  };
}

/** Tüm firma hakedişini hesaplar. ayGunu: hakediş ayının gün sayısı (Sürücü Faaliyet AO). */
export function firmaHakedis(satirlar: FirmaGirisSatiri[], p: Params, ayGunu: number): FirmaSonuc {
  const pn = fiyatFarkiKatsayisi(p);
  const ara = satirlar.map((r) => plakaFormu(r, p, pn));
  // ÖN TABLO Q47 ve konaklama KDV kuralı (R sütunu)
  const Q47 = r2(ara.reduce((s, f) => s + f.K39, 0));
  const esik = r2(p.vergi.konaklamaEsik / p.vergi.konaklamaEsikBolen);
  const tevkifatli = Q47 >= esik;
  const formlar: PlakaFormu[] = ara.map((f) => {
    const K40 = tevkifatli ? r2(f.K39 * p.vergi.konaklamaKdvTevkifatliNet) : r2(f.K39 * p.vergi.konaklamaKdv);
    const K41 = r2(f.K39 + K40);
    const K43 = r2(f.K34 + f.K38_aracToplam + K41);
    return { ...f, K40, K41, K43 };
  });
  const onTablo: OnTabloSatiri[] = formlar.map((f, i) => {
    const r = satirlar[i];
    return {
      key: r.key, no: i + 1, surucu: r.surucu, gorevYeri: r.gorevYeri, aracTipi: r.aracTipi, plaka: r.plaka,
      F_surucuUcreti: r2(f.K28_toplamSurucu - f.L26_fiyatFarki - f.M26_asgariFark - f.F28),
      G_iscilikFF: r2(f.L26_fiyatFarki),
      H_asgariFark: r2(f.M26_asgariFark),
      I_iscilikToplam: f.K28_toplamSurucu,
      J_iscilikKdv: f.K32 - f.K33,
      K_iscilikGenel: f.K34,
      L_kira: f.L9_kira - f.I18_kesinti,
      M_aracFF: f.M20_aracFiyatFarki,
      N_aracToplam: f.K35_aracKiralama,
      O_aracKdv: f.K36_aracKdv - f.K37_aracTevkifat,
      P_aracGenel: f.K38_aracToplam,
      Q_konaklama: f.K39,
      R_konaklamaKdv: f.K40,
      S_konaklamaGenel: f.K41,
      T_disGorev: f.F28,
      U_akaryakit: f.I15_yakitYansitma,
      V_kdvHaric: f.K42,
      W_kdvDahil: f.K43,
    };
  });
  const sum = (k: keyof OnTabloSatiri) => onTablo.reduce((s, x) => s + (x[k] as number), 0);
  const I47 = r2(sum('I_iscilikToplam'));
  const J47 = r2(I47 * p.vergi.kdv) - r2(I47 * p.vergi.kdv * p.vergi.iscilikTevkifat);
  const N47 = r2(sum('N_aracToplam'));
  const O47 = r2(N47 * p.vergi.kdv) - r2(N47 * p.vergi.kdv * p.vergi.aracTevkifat);
  const K47 = r2(I47 + J47);
  const P47 = r2(N47 + O47);
  // R47 satır toplamı değil, toplam konaklama üzerinden hesaplanır (Excel ÖN TABLO!R47)
  const R47 = tevkifatli ? r2(Q47 * p.vergi.konaklamaKdvTevkifatliNet) : r2(Q47 * p.vergi.konaklamaKdv);
  const S47 = r2(Q47 + R47);
  const V47 = sum('V_kdvHaric');
  const T47 = sum('T_disGorev');
  const onTabloToplam: OnTabloToplam = {
    F: sum('F_surucuUcreti'), G: sum('G_iscilikFF'), H: sum('H_asgariFark'), I: I47, J: J47, K: K47,
    L: sum('L_kira'), M: sum('M_aracFF'), N: N47, O: O47, P: P47, Q: Q47, R: R47, S: S47,
    T: T47, U: sum('U_akaryakit'), V: V47, W: P47 + K47 + S47, X: V47 - T47 - Q47,
  };
  const v = p.vergi;
  const V48 = I47, V49 = N47, V50 = Q47;
  const V51 = r2(V48 * v.kdv), V52 = r2(V49 * v.kdv), V53 = r2(V50 * v.konaklamaKdv);
  const V54 = r2(V51 * v.iscilikTevkifat), V55 = r2(V52 * v.aracTevkifat);
  const V56 = tevkifatli ? r2(V53 * v.konaklamaTevkifat) : 0;
  const fatura: FaturaOzeti = {
    iscilik: V48, arac: V49, konaklama: V50, iscilikKdv: V51, aracKdv: V52, konaklamaKdv: V53,
    iscilikTevkifat: V54, aracTevkifat: V55, konaklamaTevkifat: V56,
    faturaToplami: V48 + V51 - V54 + V49 + V52 - V55 + V50 + V53 - V56,
    damgaVergisi: r2((onTabloToplam.G + onTabloToplam.H + onTabloToplam.M + Q47 + T47) * v.damgaHakedis),
  };
  const indirim = vergiIndirimTablosu(p);
  const surucuFaaliyetSatir = satirlar.map((r, i) => surucuFaaliyet(r, formlar[i], p, ayGunu, indirim));
  const aracFaaliyet: AracFaaliyetSatiri[] = satirlar.map((r, i) => ({
    key: r.key, plaka: r.plaka, surucu: r.surucu,
    C_km: formlar[i].G16_kapanisKm - formlar[i].G15_oncekiKm,
    D_kira: onTablo[i].N_aracToplam,
    E_surucuUcreti: onTablo[i].F_surucuUcreti,
    F_hizmetDisi: onTablo[i].U_akaryakit,
    G_kapanisKm: formlar[i].G16_kapanisKm,
    H_kumulatif: surucuFaaliyetSatir[i].AC_gvmYillik,
  }));
  const bordro: BordroSatiri[] = surucuFaaliyetSatir
    .filter((s, i) => satirlar[i].surucuVar)
    .map((s) => ({ key: s.key, surucu: s.surucu, plaka: s.plaka, tutar: s.AJ_odenecek }))
    .sort((a, b) => a.surucu.localeCompare(b.surucu, 'tr'));
  return {
    formlar, onTablo, onTabloToplam, fatura,
    surucuFaaliyet: surucuFaaliyetSatir,
    surucuFaaliyetToplam: r2(surucuFaaliyetSatir.reduce((s, x) => s + x.AJ_odenecek, 0)),
    aracFaaliyet, bordro,
    bordroToplam: bordro.reduce((s, x) => s + x.tutar, 0),
    vergiIndirimTablosu: indirim,
  };
}
