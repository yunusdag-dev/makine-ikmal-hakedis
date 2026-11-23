/**
 * Mevcut Excel dosyalarından (kurum puantajı + firma hakedişi) veri okuma.
 * - Uygulamada: "Excel'den içe aktar" (sürücü, araç, günlük puantaj, parametreler)
 * - Testlerde: Excel'in kayıtlı değerleriyle karşılaştırma için girdi üretimi
 */
import type ExcelJS from 'exceljs';
import { VARSAYILAN_PARAMS, Params, UcretTablosu } from '../engine/params';
import { AY_ADLARI, ayGunSayisi, tarihStr } from '../engine/excel';
import type { Durum } from '../engine/types';

type WS = ExcelJS.Worksheet;

export function cv(ws: WS, addr: string): any {
  const v: any = ws.getCell(addr).value;
  if (v && typeof v === 'object') {
    if ('result' in v) return v.result;
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('');
    if ('formula' in v || 'sharedFormula' in v) return v.result;
    if ('error' in v) return null;
  }
  return v;
}

export function formulaOf(ws: WS, addr: string): string | null {
  const c = ws.getCell(addr);
  const v: any = c.value;
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
    try {
      return (c as any).formula ?? v.formula ?? null;
    } catch {
      return v.formula ?? null;
    }
  }
  return null;
}

const num = (x: any): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const numOrNull = (x: any): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const str = (x: any): string => (x === null || x === undefined ? '' : String(x));
const isX = (x: any) => typeof x === 'string' && x.trim().toUpperCase() === 'X';
export const plakaKey = (p: string) => p.replace(/\s+/g, '').toUpperCase();

function tarihISO(v: any): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.slice(0, 10);
  return '';
}

// ------------------------------------------------------------------ KURUM

export interface KurumGunKaydi {
  gun: number;
  tarih: string;
  kmCikis: number | null;
  kmDonus: number | null;
  aracIG: boolean;
  aracIGD: number;
  durum: Durum;
  fazlaMesai: number;
  haftaTatili: boolean;
  resmiTatil: number;
  disGorev: number;
  konaklama: boolean;
  /** Formül yerine elle yazılmış yemek/yol (null = formül) */
  yemekElle: number | null;
  yolElle: number | null;
  gorevli: string;
  gorevYeri: string;
  cikisSaat: string;
  donusSaat: string;
  not: string;
}

export interface KurumPlaka {
  plaka: string;
  sayfa: string;
  surucu: string;
  gorevYeri: string;
  aracTipi: string;
  modelYili: number | null;
  gunler: KurumGunKaydi[];
}

export interface KurumVeri {
  firmaAdi: string;
  yil: number;
  ay: number;
  plakalar: KurumPlaka[];
}

function saatStr(v: any): string {
  if (v instanceof Date) return v.toISOString().slice(11, 16);
  if (typeof v === 'number') {
    const m = Math.round(v * 24 * 60);
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  return str(v);
}

function durumOf(v: any): Durum {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v === 0 ? '0' : '';
  const s = String(v).trim().toLocaleUpperCase('tr-TR');
  const map: Record<string, Durum> = { X: 'X', B: 'B', R: 'R', 'Sİ': 'Sİ', 'SI': 'Sİ', 'Üİ': 'Üİ', 'ÜI': 'Üİ', 'Mİ': 'Mİ', 'MI': 'Mİ', 'İİ': 'İİ', 'II': 'İİ', '0': '0' };
  return map[s] ?? '';
}

export function parseKurum(wb: ExcelJS.Workbook): KurumVeri {
  const giris = wb.getWorksheet('Giriş');
  if (!giris) throw new Error("Kurum dosyasında 'Giriş' sayfası bulunamadı");
  const firmaAdi = str(cv(giris, 'B1')).trim();
  const satirlar: { plaka: string; surucu: string; gorevYeri: string; aracTipi: string; modelYili: number | null }[] = [];
  for (let r = 3; r < 500; r++) {
    const plaka = str(cv(giris, `A${r}`)).trim();
    if (!plaka) break;
    satirlar.push({
      plaka,
      surucu: str(cv(giris, `B${r}`)).trim(),
      gorevYeri: str(cv(giris, `C${r}`)).trim(),
      aracTipi: str(cv(giris, `D${r}`)).trim(),
      modelYili: numOrNull(cv(giris, `E${r}`)),
    });
  }
  const sayfalar = new Map<string, WS>();
  wb.eachSheet((ws) => sayfalar.set(plakaKey(ws.name), ws));
  // Ay / yıl: ilk plaka sayfasının P5 / S5 seçimi (AyS / YılS)
  const ilk = sayfalar.get(plakaKey(satirlar[0]?.plaka ?? ''));
  const ayAdi = str(ilk ? cv(ilk, 'P5') : '').trim();
  const ay = AY_ADLARI.findIndex((a) => a.toLocaleUpperCase('tr-TR') === ayAdi.toLocaleUpperCase('tr-TR')) + 1;
  const yil = num(ilk ? Number(cv(ilk, 'S5')) : 0);
  if (!ay || !yil) throw new Error('Kurum dosyasında ay/yıl (ilk plaka sayfası P5/S5) okunamadı');
  const n = ayGunSayisi(yil, ay);
  const plakalar: KurumPlaka[] = [];
  for (const s of satirlar) {
    const ws = sayfalar.get(plakaKey(s.plaka));
    if (!ws) continue;
    const gunler: KurumGunKaydi[] = [];
    for (let g = 1; g <= n; g++) {
      const r = 7 + g;
      const S = cv(ws, `S${r}`);
      const lF = formulaOf(ws, `L${r}`);
      const mF = formulaOf(ws, `M${r}`);
      const L = cv(ws, `L${r}`);
      const M = cv(ws, `M${r}`);
      gunler.push({
        gun: g,
        tarih: tarihStr(yil, ay, g),
        kmCikis: numOrNull(cv(ws, `F${r}`)),
        kmDonus: numOrNull(cv(ws, `G${r}`)),
        aracIG: isX(cv(ws, `I${r}`)),
        aracIGD: num(cv(ws, `J${r}`)),
        durum: durumOf(cv(ws, `K${r}`)),
        fazlaMesai: num(cv(ws, `P${r}`)),
        haftaTatili: isX(cv(ws, `Q${r}`)),
        resmiTatil: num(cv(ws, `R${r}`)),
        disGorev: isX(S) ? 1 : num(S),
        konaklama: isX(cv(ws, `T${r}`)),
        yemekElle: lF ? null : L === null || L === undefined ? null : num(L),
        yolElle: mF ? null : M === null || M === undefined ? null : num(M),
        gorevli: str(cv(ws, `D${r}`)).trim(),
        gorevYeri: str(cv(ws, `E${r}`)).trim(),
        cikisSaat: saatStr(cv(ws, `N${r}`)),
        donusSaat: saatStr(cv(ws, `O${r}`)),
        not: str(cv(ws, `AR${r}`)).trim(),
      });
    }
    plakalar.push({ ...s, sayfa: ws.name, gunler });
  }
  return { firmaAdi, yil, ay, plakalar };
}

// ------------------------------------------------------------------ FİRMA

export interface FirmaGirisHam {
  plaka: string;
  surucu: string;
  markaModel: string;
  modelYili: number | null;
  aracTipi: string;
  gorevYeri: string;
  tuketimOrani: number;
  kiraBedeli: number;
  oncekiKm: number;
  hizmetDisiGunSurucu: number;
  hizmetDisiGunArac: number;
  ig: number; igd: number; surucuCalisma: number; kapanisKm: number; hizmetIciKm: number;
  fazlaMesai: number; haftaTatili: number; resmiTatil: number; disGorev: number; konaklama: number; yemek: number; yol: number;
  // plaka formu / sürücü faaliyet satır ayarları
  kmDuzeltme: number;
  yakitYansitmaCarpani: number;
  konaklamaBirimFiyat: number | null;
  ucretGrubu: 'surucu' | 'operator';
  emekli: boolean;
  kumulatifGvm: number;
  calismaAyi: number;
  ozelSigorta: number;
}

export interface FirmaVeri {
  params: Params;
  hakedisTarihi: string;
  satirlar: FirmaGirisHam[];
}

function ucretBloku(ws: WS, baslik: string, konaklamaVar: boolean): UcretTablosu | null {
  let h = 0;
  for (let r = 1; r < 200; r++) {
    if (str(cv(ws, `X${r}`)).trim().toLocaleUpperCase('tr-TR') === baslik) { h = r; break; }
  }
  if (!h) return null;
  const val = (r: number) => num(cv(ws, `AD${r}`));
  const f = formulaOf(ws, `AD${h + 1}`);
  let brut = val(h + 1), kesinti = 0;
  const m = f?.match(/^=?\s*([\d.]+)\s*-\s*([\d.]+)\s*$/);
  if (m) { brut = Number(m[1]); kesinti = Number(m[2]); }
  let r = h + 2;
  const resmiTatil = val(r++), haftaTatili = val(r++), fazlaCalisma = val(r++);
  const konaklama = konaklamaVar ? val(r++) : 0;
  const disGorev = val(r++), yemek = val(r++), yol = val(r++);
  return { ucretBrut: brut, ucretKesinti: kesinti, resmiTatil, haftaTatili, fazlaCalisma, konaklama, disGorev, yemek, yol };
}

export function parseFirma(wb: ExcelJS.Workbook): FirmaVeri {
  const g = wb.getWorksheet('Giriş');
  if (!g) throw new Error("Firma dosyasında 'Giriş' sayfası bulunamadı");
  const p: Params = JSON.parse(JSON.stringify(VARSAYILAN_PARAMS));
  // İmzacılar / ihale bilgileri
  p.imzacilar = [2, 3, 4].map((r) => ({ ad: str(cv(g, `X${r}`)).trim(), unvan: str(cv(g, `Z${r}`)).trim() }));
  p.kurum.firmaKisaAdi = str(cv(g, 'Z7')).trim();
  p.sozlesme.ihaleTarihi = tarihISO(cv(g, 'Z8')) || p.sozlesme.ihaleTarihi;
  p.sozlesme.sozlesmeTarihi = tarihISO(cv(g, 'Z9')) || p.sozlesme.sozlesmeTarihi;
  p.sozlesme.iseBaslamaTarihi = tarihISO(cv(g, 'Z10')) || p.sozlesme.iseBaslamaTarihi;
  const hakedisTarihi = tarihISO(cv(g, 'Z11'));
  const ff = p.fiyatFarki;
  [ff.a1, ff.a2, ff.b1, ff.b2, ff.b3, ff.c, ff.B] = ['X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD'].map((c) => num(cv(g, `${c}16`)));
  [ff.Go, ff.Gn, ff.Io, ff.In, ff.Mo, ff.Mn] = ['X', 'Y', 'Z', 'AA', 'AB', 'AC'].map((c) => num(cv(g, `${c}18`)));
  ff.asgariUcretFarki = num(cv(g, 'AD18'));
  p.epdkYakitFiyati = num(cv(g, 'AD19'));
  const su = ucretBloku(g, 'SÜRÜCÜ ÜCRETLERİ', true);
  const op = ucretBloku(g, 'OPERATÖR ÜCRETLERİ', true);
  const sff = ucretBloku(g, 'SÜRÜCÜ ÜCRETLERİ FİYAT FARKI HESABI', false);
  const off = ucretBloku(g, 'OPERATÖR ÜCRETLERİ FİYAT FARKI HESABI', false);
  if (su) p.ucret.surucu = su;
  if (op) p.ucret.operator = op;
  if (sff) p.ucret.ffSurucu = { ...sff, konaklama: su?.konaklama ?? 0 };
  if (off) p.ucret.ffOperator = { ...off, konaklama: op?.konaklama ?? 0 };
  // konaklama eşiği
  for (let r = 1; r < 60; r++) {
    if (str(cv(g, `X${r}`)).toLocaleUpperCase('tr-TR').startsWith('KONAKLAMA KDV')) {
      p.vergi.konaklamaEsik = num(cv(g, `AD${r}`)) || p.vergi.konaklamaEsik;
      break;
    }
  }
  // Bordro parametreleri (Sürücü Faaliyet)
  const sf = wb.getWorksheet('Sürücü Faaliyet');
  p.bordro.asgariUcretBrut = num(cv(g, 'AA18')) || p.bordro.asgariUcretBrut;
  if (sf) {
    const an5 = numOrNull(cv(sf, 'AN5')), an6 = numOrNull(cv(sf, 'AN6'));
    if (an5 && an6) p.bordro.gvDilimleri = [{ ust: an5, oran: 0.15 }, { ust: an6, oran: 0.2 }, { ust: null, oran: 0.27 }];
    const u2 = formulaOf(sf, 'U2')?.match(/ROUND\(\(([\d.]+)\*/);
    if (u2) { p.bordro.yemekGunluk = Number(u2[1]); }
    const v2 = formulaOf(sf, 'V2')?.match(/ROUND\(\(([\d.]+)\*/);
    if (v2) { p.bordro.yolGunluk = Number(v2[1]); }
    const z2 = formulaOf(sf, 'Z2')?.match(/ROUND\(\(([\d.]+)\*/);
    if (z2) { p.bordro.yemekIstisnaGunluk = Number(z2[1]); }
  }
  // Plaka formu sabitleri
  const satirlar: FirmaGirisHam[] = [];
  const sayfalar = new Map<string, WS>();
  wb.eachSheet((ws) => sayfalar.set(plakaKey(ws.name), ws));
  for (let r = 2; r < 500; r++) {
    const plaka = str(cv(g, `A${r}`)).trim();
    if (!plaka) break;
    const ps = sayfalar.get(plakaKey(plaka));
    let kmDuzeltme = 0, yakit = 1, kon: number | null = null, grup: 'surucu' | 'operator' = 'surucu';
    if (ps) {
      const g17 = formulaOf(ps, 'G17');
      const m = g17?.match(/Giriş!\$?P\$?\d+\s*([+-]\s*[\d.]+)?/);
      if (m && m[1]) kmDuzeltme = Number(m[1].replace(/\s/g, ''));
      const i15 = formulaOf(ps, 'I15')?.match(/ROUND\(\(([\d.]+)\*/);
      if (i15) yakit = Number(i15[1]);
      const k26 = formulaOf(ps, 'K26') ?? '';
      if (/AD39/.test(k26)) grup = 'operator';
      if (!formulaOf(ps, 'G26')) {
        const v = numOrNull(cv(ps, 'G26'));
        const std = grup === 'operator' ? p.ucret.operator.konaklama : p.ucret.surucu.konaklama;
        if (v !== null && v !== std) kon = v;
      }
      const i8 = numOrNull(cv(ps, 'I8'));
      if (i8) p.sozlesme.gunlukCalismaSaati = i8;
      const i9 = str(cv(ps, 'I9')).trim();
      if (i9) p.sozlesme.yakitCinsi = i9;
    }
    let emekli = false, kum = 0, calAy = Number(hakedisTarihi.slice(5, 7)) || 1, ozel = 0;
    if (sf) {
      emekli = str(cv(sf, `X${r}`)).trim().toLocaleUpperCase('tr-TR') === 'EVET';
      kum = num(cv(sf, `Y${r}`));
      calAy = num(cv(sf, `AK${r}`)) || calAy;
      ozel = num(cv(sf, `AM${r}`));
      if (grup === 'operator') {
        const pf = formulaOf(sf, `P${r}`)?.match(/\*([\d.]+)\),2\)/);
        if (pf) p.bordro.carpanOperator = Number(pf[1]);
      } else if (r === 2) {
        const pf = formulaOf(sf, `P${r}`)?.match(/\*([\d.]+)\),2\)/);
        if (pf) p.bordro.carpanSurucu = Number(pf[1]);
      }
    }
    satirlar.push({
      plaka,
      surucu: str(cv(g, `B${r}`)).trim(),
      markaModel: str(cv(g, `C${r}`)).trim(),
      modelYili: numOrNull(cv(g, `D${r}`)),
      aracTipi: str(cv(g, `E${r}`)).trim(),
      gorevYeri: str(cv(g, `F${r}`)).trim(),
      tuketimOrani: num(cv(g, `G${r}`)),
      kiraBedeli: num(cv(g, `H${r}`)),
      oncekiKm: num(cv(g, `I${r}`)),
      hizmetDisiGunSurucu: num(cv(g, `J${r}`)),
      hizmetDisiGunArac: num(cv(g, `K${r}`)),
      ig: num(cv(g, `L${r}`)), igd: num(cv(g, `M${r}`)), surucuCalisma: num(cv(g, `N${r}`)),
      kapanisKm: num(cv(g, `O${r}`)), hizmetIciKm: num(cv(g, `P${r}`)), fazlaMesai: num(cv(g, `Q${r}`)),
      haftaTatili: num(cv(g, `R${r}`)), resmiTatil: num(cv(g, `S${r}`)), disGorev: num(cv(g, `T${r}`)),
      konaklama: num(cv(g, `U${r}`)), yemek: num(cv(g, `V${r}`)), yol: num(cv(g, `W${r}`)),
      kmDuzeltme, yakitYansitmaCarpani: yakit, konaklamaBirimFiyat: kon, ucretGrubu: grup,
      emekli, kumulatifGvm: kum, calismaAyi: calAy, ozelSigorta: ozel,
    });
  }
  return { params: p, hakedisTarihi, satirlar };
}
