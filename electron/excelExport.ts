/**
 * Excel çıktıları. Biçim, örnek dosyalardan çıkarılmış şablondan (templates/layout.json) alınır:
 * sütun genişlikleri, satır yükseklikleri, birleştirmeler, yazı tipleri, kenarlıklar, sayı biçimleri, başlıklar.
 * Hesap hücrelerine CANLI FORMÜL + uygulamanın hesapladığı sonuç (önbellek) yazılır.
 */
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import { DonemSonucu } from '../src/engine/donem';
import { Params } from '../src/engine/params';
import { AY_ADLARI, parseAy } from '../src/engine/excel';
import { gunSinifla, tatilHaritasi, Tatil } from '../src/engine/calendar';
import { yemekHakki, yolHakki } from '../src/engine/kurum';
import type { FirmaGirisSatiri } from '../src/engine/firma';

type CellL = { s?: any; v?: any; f?: string; d?: string };
type SheetL = {
  name: string; columns: { width: number | null; hidden: boolean; style?: any }[]; rows: Record<string, { height: number | null; hidden: boolean }>;
  cells: Record<string, CellL>; merges: string[]; pageSetup?: any; views?: any; headerFooter?: any; kaynakSatir?: number; kaynakAd?: string;
};
type Layout = { firma: Record<string, SheetL>; kurum: Record<string, SheetL> };

let LAYOUT: Layout | null = null;
export function layoutYukle(yol: string) {
  LAYOUT = JSON.parse(fs.readFileSync(yol, 'utf8'));
}
function L(): Layout {
  if (!LAYOUT) throw new Error('Excel şablonu (layout.json) yüklenemedi.');
  return LAYOUT;
}

// ------------------------------------------------------------------ yardımcılar
export function colLetter(n: number): string {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function colNum(s: string): number { return s.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0); }
function parseAddr(a: string) { const m = a.match(/^([A-Z]+)(\d+)$/)!; return { c: colNum(m[1]), r: Number(m[2]) }; }
const clone = (x: any) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

function sayfaHazirla(ws: ExcelJS.Worksheet, sl: SheetL) {
  sl.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.width) col.width = c.width;
    if (c.hidden) col.hidden = true;
  });
  if (sl.pageSetup) ws.pageSetup = { ...clone(sl.pageSetup), printArea: undefined } as any;
  if (sl.views) ws.views = clone(sl.views);
  if (sl.headerFooter) ws.headerFooter = clone(sl.headerFooter);
}

/** Şablondaki [r1, r2] satır aralığını (stil + değer/formül + birleştirme + yükseklik) hedef satıra kopyalar */
function blokKopyala(ws: ExcelJS.Worksheet, sl: SheetL, r1: number, r2: number, hedef: number, opts: { deger?: boolean } = {}) {
  const fark = hedef - r1;
  for (const [addr, c] of Object.entries(sl.cells)) {
    const { c: col, r } = parseAddr(addr);
    if (r < r1 || r > r2) continue;
    const cell = ws.getCell(r + fark, col);
    if (c.s) cell.style = clone(c.s);
    if (opts.deger !== false) {
      if (c.v !== undefined) cell.value = c.v;
      else if (c.d) cell.value = new Date(c.d);
    }
  }
  for (let r = r1; r <= r2; r++) {
    const h = sl.rows[String(r)];
    if (h?.height) ws.getRow(r + fark).height = h.height;
  }
  for (const m of sl.merges) {
    const [a, b] = m.split(':');
    const pa = parseAddr(a), pb = parseAddr(b);
    if (pa.r >= r1 && pa.r <= r2) {
      try { ws.mergeCells(pa.r + fark, pa.c, pb.r + fark, pb.c); } catch { /* çakışma */ }
    }
  }
}

/** Şablon satırının stillerini hedef satıra uygular (veri satırları için) */
function satirStili(ws: ExcelJS.Worksheet, sl: SheetL, kaynak: number, hedef: number, sonKolon: number) {
  for (let c = 1; c <= sonKolon; c++) {
    const e = sl.cells[`${colLetter(c)}${kaynak}`];
    if (e?.s) ws.getCell(hedef, c).style = clone(e.s);
  }
  const h = sl.rows[String(kaynak)];
  if (h?.height) ws.getRow(hedef).height = h.height;
}

function F(ws: ExcelJS.Worksheet, addr: string, formula: string, result: any) {
  ws.getCell(addr).value = { formula, result: result as any } as any;
}
function V(ws: ExcelJS.Worksheet, addr: string, v: any) {
  ws.getCell(addr).value = v;
}
const n2 = (x: number) => (Number.isFinite(x) ? x : 0);
const sq = (s: string) => `'${s.replace(/'/g, "''")}'`;
export function sayfaAdi(plaka: string, kullanilan: Set<string>): string {
  let ad = plaka.replace(/\s+/g, '').replace(/[\\/*?:[\]]/g, '').slice(0, 28) || 'ARAC';
  let n = 2;
  const kok = ad;
  while (kullanilan.has(ad.toUpperCase())) ad = `${kok}_${n++}`;
  kullanilan.add(ad.toUpperCase());
  return ad;
}
function isoTarih(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1));
}
function ayBaslik(ay: string): string {
  const { yil, ay: m } = parseAy(ay);
  return `${AY_ADLARI[m - 1].toLocaleUpperCase('tr-TR')} ${yil}`;
}

// ================================================================== FİRMA HAKEDİŞ DOSYASI
export interface FirmaDosyaSecenek {
  sayfalar?: ('giris' | 'onTablo' | 'plakalar' | 'surucuFaaliyet' | 'aracFaaliyet' | 'bordro')[];
}

/** Tam firma hakediş çalışma kitabı (Giriş + ÖN TABLO + plaka formları + Sürücü Faaliyet + Araç Faaliyet + Bordro Tutar) */
export async function firmaHakedisExcel(son: DonemSonucu, p: Params, hedef: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Makine İkmal Hakediş';
  wb.calcProperties.fullCalcOnLoad = true;
  const n = son.giris.length;
  const kullanilan = new Set<string>();
  const sayfaAdlari = son.giris.map((g) => sayfaAdi(g.plaka || `SURUCU${g.driverId}`, kullanilan));
  girisSayfasi(wb, son, p);
  onTabloSayfasi(wb, son, p, sayfaAdlari);
  son.giris.forEach((g, i) => plakaFormuSayfasi(wb, son, p, i, sayfaAdlari[i], true));
  surucuFaaliyetSayfasi(wb, son, p, sayfaAdlari, true);
  aracFaaliyetSayfasi(wb, son, sayfaAdlari, true);
  bordroSayfasi(wb, son, true);
  await wb.xlsx.writeFile(hedef);
  return { sayfa: wb.worksheets.length, satir: n };
}

function girisSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, p: Params) {
  const sl = L().firma.giris;
  const ws = wb.addWorksheet('Giriş');
  sayfaHazirla(ws, sl);
  // Parametre bloğu (X:AD) ve başlıklar: şablondaki tüm etiketler
  for (const [addr, c] of Object.entries(sl.cells)) {
    const { c: col, r } = parseAddr(addr);
    if (r === 1 || col >= 24) {
      const cell = ws.getCell(addr);
      if (c.s) cell.style = clone(c.s);
      if (c.v !== undefined && (r === 1 || typeof c.v === 'string')) cell.value = c.v;
    }
  }
  for (const m of sl.merges) {
    const [a] = m.split(':');
    const pa = parseAddr(a);
    if (pa.r === 1 || pa.c >= 24) try { ws.mergeCells(m); } catch { /* */ }
  }
  son.giris.forEach((g, i) => {
    const r = 2 + i;
    satirStili(ws, sl, 2, r, 23);
    const sv = g.surucuVar, av = g.aracVar;
    const vals = [
      g.plaka, g.surucu, g.markaModel, g.modelYili ?? '', g.aracTipi, g.gorevYeri, g.tuketimOrani, av ? g.kiraBedeli : 0, g.oncekiKm,
      g.hizmetDisiGunSurucu, g.hizmetDisiGunArac, g.ig, g.igd, g.surucuCalisma, g.kapanisKm, g.hizmetIciKm,
      sv ? g.fazlaMesai : 0, sv ? g.haftaTatili : 0, sv ? g.resmiTatil : 0, sv ? g.disGorev : 0, sv ? g.konaklama : 0, sv ? g.yemek : 0, sv ? g.yol : 0,
    ];
    vals.forEach((v, c) => V(ws, `${colLetter(c + 1)}${r}`, v));
  });
  // Parametre değerleri (sabit hücreler — plaka formları bu hücrelere bağlıdır)
  p.imzacilar.slice(0, 3).forEach((im, i) => { V(ws, `X${2 + i}`, im.ad); V(ws, `Z${2 + i}`, im.unvan); });
  V(ws, 'X6', 'İHALE BİLGİLERİ');
  V(ws, 'Z7', p.kurum.firmaKisaAdi || p.kurum.firmaAdi);
  V(ws, 'Z8', isoTarih(p.sozlesme.ihaleTarihi));
  V(ws, 'Z9', isoTarih(p.sozlesme.sozlesmeTarihi));
  V(ws, 'Z10', isoTarih(p.sozlesme.iseBaslamaTarihi));
  V(ws, 'Z11', isoTarih(`${son.ay}-01`));
  const ff = p.fiyatFarki;
  ['X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD'].forEach((c, i) => V(ws, `${c}16`, [ff.a1, ff.a2, ff.b1, ff.b2, ff.b3, ff.c, ff.B][i]));
  ['X', 'Y', 'Z', 'AA', 'AB', 'AC'].forEach((c, i) => V(ws, `${c}18`, [ff.Go, ff.Gn, ff.Io, ff.In, ff.Mo, ff.Mn][i]));
  V(ws, 'AD18', ff.asgariUcretFarki);
  V(ws, 'AD19', p.epdkYakitFiyati);
  const blok = (bas: number, u: Params['ucret']['surucu'], konaklama: boolean) => {
    F(ws, `AD${bas}`, `${u.ucretBrut}-${u.ucretKesinti}`, u.ucretBrut - u.ucretKesinti);
    let r = bas + 1;
    V(ws, `AD${r++}`, u.resmiTatil); V(ws, `AD${r++}`, u.haftaTatili); V(ws, `AD${r++}`, u.fazlaCalisma);
    if (konaklama) V(ws, `AD${r++}`, u.konaklama);
    V(ws, `AD${r++}`, u.disGorev); V(ws, `AD${r++}`, u.yemek); V(ws, `AD${r++}`, u.yol);
    if (konaklama) { V(ws, `AC${r}`, Math.round(p.vergi.konaklamaKdv * 100)); V(ws, `AD${r}`, p.vergi.konaklamaEsik); }
  };
  blok(21, p.ucret.surucu, true);
  blok(31, p.ucret.ffSurucu, false);
  blok(39, p.ucret.operator, true);
  blok(49, p.ucret.ffOperator, false);
  const t = 2 + son.giris.length;
  F(ws, `Q${t}`, `SUM(Q2:Q${t - 1})`, son.giris.reduce((s, g) => s + (g.surucuVar ? g.fazlaMesai : 0), 0));
  F(ws, `R${t}`, `SUM(R2:R${t - 1})`, son.giris.reduce((s, g) => s + (g.surucuVar ? g.haftaTatili : 0), 0));
  ws.getCell(`Q${t}`).font = { bold: true };
  ws.getCell(`R${t}`).font = { bold: true };
}

/** Bir plaka formu. canli=true: Giriş/ÖN TABLO'ya bağlı formüller; false: yalnız değerler */
function plakaFormuSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, p: Params, i: number, ad: string, canli: boolean) {
  const sl = L().firma.plakaFormu;
  const ws = wb.addWorksheet(ad);
  sayfaHazirla(ws, sl);
  blokKopyala(ws, sl, 1, 59, 1, { deger: true });
  const g = son.giris[i];
  const f = son.firma.formlar[i];
  const r = 2 + i;
  const G = (col: string) => `Giriş!${col}${r}`;
  const op = g.ucretGrubu === 'operator';
  const ffOp = op && !p.fiyatFarki.operatorSurucuTablosunuKullan;
  // ücret tablosu hücreleri (Giriş parametre bloğu)
  const U = op ? { ucret: 'AD39', rt: 'AD40', ht: 'AD41', fm: 'AD42', kon: 'AD43', dg: 'AD44', yemek: 'AD45', yol: 'AD46' }
    : { ucret: 'AD21', rt: 'AD22', ht: 'AD23', fm: 'AD24', kon: 'AD25', dg: 'AD26', yemek: 'AD27', yol: 'AD28' };
  const FF = ffOp ? { ucret: 'AD49', rt: 'AD50', ht: 'AD51', fm: 'AD52', dg: 'AD53', yemek: 'AD54', yol: 'AD55' }
    : { ucret: 'AD31', rt: 'AD32', ht: 'AD33', fm: 'AD34', dg: 'AD35', yemek: 'AD36', yol: 'AD37' };
  const yaz = (addr: string, formula: string, deger: any) => (canli ? F(ws, addr, formula, deger) : V(ws, addr, deger));
  const ff = p.fiyatFarki;
  // Başlık bilgileri
  yaz('D6', 'Giriş!Z8', isoTarih(p.sozlesme.ihaleTarihi));
  yaz('G6', G('B'), g.surucu);
  yaz('I6', G('E'), g.aracTipi);
  yaz('L6', 'Giriş!Z11', isoTarih(`${son.ay}-01`));
  yaz('D7', 'Giriş!Z9', isoTarih(p.sozlesme.sozlesmeTarihi));
  yaz('G7', G('A'), g.plaka);
  yaz('I7', G('F'), g.gorevYeri);
  yaz('L7', G('G'), f.L7_tuketim);
  yaz('D8', 'Giriş!Z10', isoTarih(p.sozlesme.iseBaslamaTarihi));
  yaz('G8', G('C'), g.markaModel);
  V(ws, 'I8', p.sozlesme.gunlukCalismaSaati);
  yaz('L8', 'Giriş!AD19', p.epdkYakitFiyati);
  yaz('D9', 'Giriş!Z7', p.kurum.firmaKisaAdi || p.kurum.firmaAdi);
  yaz('G9', G('D'), g.modelYili ?? '');
  V(ws, 'I9', p.sozlesme.yakitCinsi);
  yaz('L9', G('H'), f.L9_kira);
  // Fiyat farkı katsayıları
  yaz('C15', 'Giriş!X16', ff.a1); yaz('C16', 'Giriş!Y16', ff.a2); yaz('C17', 'Giriş!Z16', ff.b1);
  yaz('C18', 'Giriş!AA16', ff.b2); yaz('C19', 'Giriş!AB16', ff.b3); yaz('C20', 'Giriş!AC16', ff.c);
  yaz('E15', 'Giriş!X18', ff.Go); yaz('E16', 'Giriş!Y18', ff.Gn); yaz('E17', 'Giriş!Z18', ff.Io);
  yaz('E18', 'Giriş!AA18', ff.In); yaz('E19', 'Giriş!AB18', ff.Mo); yaz('E20', 'Giriş!AC18', ff.Mn);
  yaz('K20', 'Giriş!AD16', ff.B);
  // KM
  yaz('G15', G('I'), f.G15_oncekiKm);
  yaz('G16', G('O'), f.G16_kapanisKm);
  yaz('G17', g.kmDuzeltme ? `${G('P')}${g.kmDuzeltme > 0 ? '+' : ''}${g.kmDuzeltme}` : G('P'), f.G17_hizmetIciKm);
  yaz('G19', 'G16-G15-G17', f.G19_hizmetDisiKm);
  yaz('I15', `ROUND((${g.yakitYansitmaCarpani}*(G19*L7*L8)),2)`, f.I15_yakitYansitma);
  yaz('I17', G('K'), f.I17_hizmetDisiGun);
  yaz('I18', `I17*L9/${p.ucret.ayBolenGun}`, f.I18_kesinti);
  const a2 = ff.a2 ? `+ROUND(C16*(E18/E17),5)` : '';
  yaz('M19', `ROUND(C15${a2}+ROUND(C19*(E16/E15),5)+ROUND(C20*(E20/E19),5),5)`, f.M19_pn);
  yaz('M20', `ROUND(((L9-I18)*(M19-1)*K20),2)`, f.M20_aracFiyatFarki);
  // Sürücü kalemleri
  const sv = g.surucuVar;
  yaz('B26', `Giriş!${U.fm}`, f.B26);
  yaz('D26', `Giriş!${U.ht}`, f.D26);
  yaz('E26', `Giriş!${U.rt}`, f.E26);
  yaz('F26', `Giriş!${U.dg}`, f.F26);
  if (g.konaklamaBirimFiyat != null) V(ws, 'G26', g.konaklamaBirimFiyat); else yaz('G26', `Giriş!${U.kon}`, f.G26);
  yaz('H26', `Giriş!${U.yemek}`, f.H26);
  yaz('I26', `Giriş!${U.yol}`, f.I26);
  yaz('B27', G('Q'), f.B27);
  yaz('D27', `${p.puantaj.haftaTatiliSaat}*${G('R')}`, f.D27);
  yaz('E27', G('S'), f.E27); yaz('F27', G('T'), f.F27); yaz('G27', G('U'), f.G27); yaz('H27', G('V'), f.H27); yaz('I27', G('W'), f.I27);
  for (const c of ['B', 'D', 'E', 'F', 'G', 'H', 'I']) yaz(`${c}28`, `ROUND((${c}26*${c}27),2)`, (f as any)[`${c}28`]);
  const dg = p.ucret.yemekYolDusumGun;
  if (sv) {
    yaz('K26', `Giriş!${U.ucret}-(Giriş!${U.yemek}*${dg}+Giriş!${U.yol}*${dg})`, f.K26_surucuUcreti);
    yaz('L26', `((K20*(M19-1))*((Giriş!${FF.ucret}+B27*Giriş!${FF.fm}+D27*Giriş!${FF.ht}+E27*Giriş!${FF.rt}+H27*Giriş!${FF.yemek}+I27*Giriş!${FF.yol}-(Giriş!${FF.ucret}/${p.ucret.ayBolenGun})*${G('J')})))`, f.L26_fiyatFarki);
    yaz('M26', 'Giriş!AD18', f.M26_asgariFark);
  } else {
    V(ws, 'K26', 0); V(ws, 'L26', 0); V(ws, 'M26', 0);
  }
  yaz('K28', 'ROUND((K26+L26+M26+B28+D28+E28+F28+H28+I28),2)', f.K28_toplamSurucu);
  const v = p.vergi;
  yaz('K31', 'ROUND((K28),2)', f.K31);
  yaz('K32', `ROUND((K31*${v.kdv}),2)`, f.K32);
  yaz('K33', `ROUND((K32*${v.iscilikTevkifat}),2)`, f.K33);
  yaz('K34', 'ROUND((K31+(K32-K33)),2)', f.K34);
  yaz('K35', 'ROUND((L9-I18+M20),2)', f.K35_aracKiralama);
  yaz('K36', `ROUND((K35*${v.kdv}),2)`, f.K36_aracKdv);
  yaz('K37', `ROUND((K36*${v.aracTevkifat}),2)`, f.K37_aracTevkifat);
  yaz('K38', 'ROUND((K35+K36-K37),2)', f.K38_aracToplam);
  yaz('K39', 'G28', f.K39);
  yaz('K40', `'ÖN TABLO'!R${6 + i}`, f.K40);
  yaz('K41', 'ROUND((K39+K40),2)', f.K41);
  yaz('K42', 'ROUND((K31+K35+K39),2)', f.K42);
  yaz('K43', 'ROUND((K34+K38+K41),2)', f.K43);
  yaz('K44', 'ROUND((I15),2)', f.K44);
  yaz('K45', `ROUND((K44*${v.kdv}),2)`, f.K45);
  yaz('K46', 'ROUND((K44+K45),2)', f.K46);
  // İmzacılar
  yaz('F53', 'Giriş!X2', p.imzacilar[0]?.ad ?? ''); yaz('H53', 'Giriş!X3', p.imzacilar[1]?.ad ?? ''); yaz('K53', 'Giriş!X4', p.imzacilar[2]?.ad ?? '');
  yaz('F54', 'Giriş!Z2', p.imzacilar[0]?.unvan ?? ''); yaz('H54', 'Giriş!Z3', p.imzacilar[1]?.unvan ?? ''); yaz('K54', 'Giriş!Z4', p.imzacilar[2]?.unvan ?? '');
  V(ws, 'A2', `${p.kurum.kurumAdi} ${p.kurum.bolgeAdi.replace(/\s*\(.*\)\s*/, '')}`.trim());
  return ws;
}

function onTabloSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, p: Params, sayfalar: string[]) {
  const sl = L().firma.onTablo;
  const ws = wb.addWorksheet('ÖN TABLO');
  sayfaHazirla(ws, sl);
  blokKopyala(ws, sl, 1, 5, 1);
  const firma = (p.kurum.firmaKisaAdi || p.kurum.firmaAdi).toLocaleUpperCase('tr-TR');
  V(ws, 'A3', `${firma}'A AİT KİRALIK ARAÇLARIN ${ayBaslik(son.ay)} HAKEDİŞ ÖDEME LİSTESİ `);
  const n = son.giris.length;
  const t = son.firma.onTabloToplam;
  const esik = `ROUND((Giriş!$AD$29/(${p.vergi.konaklamaEsikBolen})),2)`;
  const top = 6 + n; // toplam satırı
  son.firma.onTablo.forEach((o, i) => {
    const r = 6 + i;
    satirStili(ws, sl, 6, r, 23);
    const s = sq(sayfalar[i]);
    const gr = 2 + i;
    V(ws, `A${r}`, i + 1);
    F(ws, `B${r}`, `Giriş!B${gr}`, o.surucu); F(ws, `C${r}`, `Giriş!F${gr}`, o.gorevYeri); F(ws, `D${r}`, `Giriş!E${gr}`, o.aracTipi); F(ws, `E${r}`, `Giriş!A${gr}`, o.plaka);
    F(ws, `F${r}`, `ROUND((${s}!$K$28-${s}!$L$26-${s}!$M$26-${s}!$F$28),2)`, o.F_surucuUcreti);
    F(ws, `G${r}`, `ROUND(${s}!L26,2)`, o.G_iscilikFF);
    F(ws, `H${r}`, `ROUND(${s}!M26,2)`, o.H_asgariFark);
    F(ws, `I${r}`, `${s}!$K$28`, o.I_iscilikToplam);
    F(ws, `J${r}`, `${s}!$K$32-${s}!$K$33`, o.J_iscilikKdv);
    F(ws, `K${r}`, `${s}!$K$34`, o.K_iscilikGenel);
    F(ws, `L${r}`, `${s}!$L$9-${s}!$I$18`, o.L_kira);
    F(ws, `M${r}`, `${s}!$M$20`, o.M_aracFF);
    F(ws, `N${r}`, `${s}!$K$35`, o.N_aracToplam);
    F(ws, `O${r}`, `${s}!$K$36-${s}!$K$37`, o.O_aracKdv);
    F(ws, `P${r}`, `${s}!$K$38`, o.P_aracGenel);
    F(ws, `Q${r}`, `${s}!$K$39`, o.Q_konaklama);
    F(ws, `R${r}`, `IF($Q$${top}>=${esik},(ROUND((Q${r}*${p.vergi.konaklamaKdvTevkifatliNet}),2)),(ROUND((Q${r}*${p.vergi.konaklamaKdv}),2)))`, o.R_konaklamaKdv);
    F(ws, `S${r}`, `${s}!$K$41`, o.S_konaklamaGenel);
    F(ws, `T${r}`, `${s}!$F$28`, o.T_disGorev);
    F(ws, `U${r}`, `${s}!$I$15`, o.U_akaryakit);
    F(ws, `V${r}`, `${s}!$K$42`, o.V_kdvHaric);
    F(ws, `W${r}`, `${s}!$K$43`, o.W_kdvDahil);
  });
  // Toplam + özet bloğu (şablon satır 47..66 -> top..)
  blokKopyala(ws, sl, 47, 66, top);
  const son6 = top - 1;
  const v = p.vergi;
  const S = (c: string) => `SUM(${c}6:${c}${son6})`;
  F(ws, `F${top}`, S('F'), t.F); F(ws, `G${top}`, S('G'), t.G); F(ws, `H${top}`, S('H'), t.H);
  F(ws, `I${top}`, `ROUND(${S('I')},2)`, t.I);
  F(ws, `J${top}`, `ROUND(I${top}*${v.kdv},2)-ROUND(I${top}*${v.kdv}*${v.iscilikTevkifat},2)`, t.J);
  F(ws, `K${top}`, `ROUND((I${top}+J${top}),2)`, t.K);
  F(ws, `L${top}`, S('L'), t.L); F(ws, `M${top}`, S('M'), t.M);
  F(ws, `N${top}`, `ROUND(${S('N')},2)`, t.N);
  F(ws, `O${top}`, `ROUND(N${top}*${v.kdv},2)-ROUND(N${top}*${v.kdv}*${v.aracTevkifat},2)`, t.O);
  F(ws, `P${top}`, `ROUND((N${top}+O${top}),2)`, t.P);
  F(ws, `Q${top}`, `ROUND(${S('Q')},2)`, t.Q);
  F(ws, `R${top}`, `IF($Q$${top}>=${esik},(ROUND((Q${top}*${v.konaklamaKdvTevkifatliNet}),2)),(ROUND((Q${top}*${v.konaklamaKdv}),2)))`, t.R);
  F(ws, `S${top}`, `ROUND((Q${top}+R${top}),2)`, t.S);
  F(ws, `T${top}`, S('T'), t.T); F(ws, `U${top}`, S('U'), t.U); F(ws, `V${top}`, S('V'), t.V);
  F(ws, `W${top}`, `P${top}+K${top}+S${top}`, t.W);
  F(ws, `X${top}`, `V${top}-T${top}-Q${top}`, t.X);
  const fa = son.firma.fatura;
  const o = (k: number) => top + k; // satır 47 -> top
  F(ws, `V${o(1)}`, `I${top}`, fa.iscilik);
  F(ws, `V${o(2)}`, `N${top}`, fa.arac);
  F(ws, `V${o(3)}`, `Q${top}`, fa.konaklama);
  F(ws, `V${o(4)}`, `ROUND(V${o(1)}*${v.kdv},2)`, fa.iscilikKdv);
  F(ws, `V${o(5)}`, `ROUND(V${o(2)}*${v.kdv},2)`, fa.aracKdv);
  F(ws, `V${o(6)}`, `ROUND(V${o(3)}*${v.konaklamaKdv},2)`, fa.konaklamaKdv);
  F(ws, `V${o(7)}`, `ROUND(V${o(4)}*${v.iscilikTevkifat},2)`, fa.iscilikTevkifat);
  F(ws, `V${o(8)}`, `ROUND(V${o(5)}*${v.aracTevkifat},2)`, fa.aracTevkifat);
  F(ws, `V${o(9)}`, `IF($Q$${top}>=${esik},(ROUND((V${o(6)}*${v.konaklamaTevkifat}),2)),0)`, fa.konaklamaTevkifat);
  F(ws, `V${o(10)}`, `V${o(1)}+V${o(4)}-V${o(7)}+V${o(2)}+V${o(5)}-V${o(8)}+V${o(3)}+V${o(6)}-V${o(9)}`, fa.faturaToplami);
  F(ws, `V${o(11)}`, `ROUND((SUM(G${top},H${top},M${top},Q${top},T${top})*${v.damgaHakedis}),2)`, fa.damgaVergisi);
  V(ws, `A${o(11)}`, `DAMGA VERGİSİ KESİNTİSİ (%${(v.damgaHakedis * 100).toLocaleString('tr-TR')})`);
  // imzalar (şablon: H64/O64/T64 adlar, H65.. unvanlar)
  const im = p.imzacilar;
  F(ws, `H${o(17)}`, 'Giriş!X2', im[0]?.ad ?? ''); F(ws, `O${o(17)}`, 'Giriş!X3', im[1]?.ad ?? ''); F(ws, `T${o(17)}`, 'Giriş!X4', im[2]?.ad ?? '');
  F(ws, `H${o(18)}`, 'Giriş!Z2', im[0]?.unvan ?? ''); F(ws, `O${o(18)}`, 'Giriş!Z3', im[1]?.unvan ?? ''); F(ws, `T${o(18)}`, 'Giriş!Z4', im[2]?.unvan ?? '');
  if (ws.pageSetup) ws.pageSetup.printArea = `A1:W${o(19)}`;
}

function gvFormulu(p: Params, r: number): string {
  const d = p.bordro.gvDilimleri;
  const K = `(Y${r}+AB${r})`;
  if (d.length === 3 && d[0].ust != null && d[1].ust != null) {
    const [a, b] = [d[0].ust, d[1].ust];
    const [o1, o2, o3] = d.map((x) => x.oran);
    return `ROUND((IF(${K}<${a},(AB${r}*${o1}-AL${r}),IF(AND(${a}<${K}, Y${r}<${a}),((${a}-Y${r})*${o1}+(${K}-${a})*${o2}-AL${r}),IF(AND(${a}<${K}, ${K}<${b}),(AB${r}*${o2}-AL${r}),IF(AND(${b}<${K}, Y${r}<${b}),((${b}-Y${r})*${o2}+(${K}-${b})*${o3}-AL${r}),(AB${r}*${o3}-AL${r})))))),2)`;
  }
  // genel N dilim: Σ MAX(0; MIN(K; üst) - MAX(Y; alt)) × oran
  let alt = 0;
  const parcalar = d.map((x) => {
    const ust = x.ust ?? 1e15;
    const s = `MAX(0,MIN(${K},${ust})-MAX(Y${r},${alt}))*${x.oran}`;
    alt = ust;
    return s;
  });
  return `ROUND(${parcalar.join('+')}-AL${r},2)`;
}

function surucuFaaliyetSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, p: Params, sayfalar: string[], canli: boolean) {
  const sl = L().firma.surucuFaaliyet;
  const ws = wb.addWorksheet('Sürücü Faaliyet');
  sayfaHazirla(ws, sl);
  blokKopyala(ws, sl, 1, 1, 1);
  const b = p.bordro;
  const n = son.giris.length;
  const son2 = n + 1;
  son.firma.surucuFaaliyet.forEach((x, i) => {
    const r = 2 + i;
    const g = son.giris[i];
    satirStili(ws, sl, 2, r, 49);
    const s = sq(sayfalar[i]);
    const c = g.ucretGrubu === 'operator' ? b.carpanOperator : b.carpanSurucu;
    const yaz = (a: string, f: string, v: any) => (canli ? F(ws, `${a}${r}`, f, v) : V(ws, `${a}${r}`, v));
    yaz('A', `Giriş!A${r}`, x.plaka);
    yaz('B', `'ÖN TABLO'!B${6 + i}`, x.surucu);
    yaz('C', `Giriş!N${r}`, x.C); yaz('D', `Giriş!S${r}`, x.D); yaz('E', `Giriş!R${r}`, x.E);
    yaz('F', `${p.puantaj.haftaTatiliSaat}*E${r}`, x.F);
    yaz('G', `Giriş!Q${r}`, x.G); yaz('H', `F${r}+G${r}`, x.H); yaz('I', `Giriş!U${r}`, x.I); yaz('J', `Giriş!T${r}`, x.J);
    yaz('K', `Giriş!V${r}`, x.K); yaz('L', `Giriş!W${r}`, x.L);
    const asg = canli ? '$AN$4' : String(b.asgariUcretBrut);
    yaz('P', g.surucuVar ? `ROUND((${asg}*${c}),2)*((${b.ayGun}-AR${r})/${b.ayGun})` : '0', x.P_temel);
    yaz('Q', `ROUND((${asg}*${c}/${b.ayGun})*D${r},2)`, x.Q_resmiTatil);
    yaz('R', `ROUND((${asg}*${c}/${b.aylikSaat})*${b.fazlaMesaiZam}*H${r},2)`, x.R_fazlaMesai);
    const std = g.ucretGrubu === 'operator' ? 'AD43' : 'AD25';
    yaz('S', `IF(${s}!$G$26=Giriş!${std},${s}!$G$28*${b.konaklamaCarpanStandart},${s}!$G$28*${b.konaklamaCarpanDiger})`, x.S_konaklama);
    yaz('T', `J${r}*Giriş!$AD$${g.ucretGrubu === 'operator' ? 44 : 26}`, x.T_disGorev);
    yaz('U', `ROUND((${b.yemekGunluk}*K${r}),2)`, x.U_yemek);
    yaz('V', `ROUND((${b.yolGunluk}*L${r}),2)`, x.V_yol);
    yaz('W', `ROUND(SUM(P${r}:V${r}),2)`, x.W_brut);
    V(ws, `X${r}`, x.X_emekli ? 'Evet' : 'Hayır');
    V(ws, `Y${r}`, x.Y_kumulatif);
    yaz('Z', `ROUND((${b.yemekIstisnaGunluk}*K${r}),2)`, x.Z_sgkIstisna);
    yaz('AA', `ROUND((W${r}-S${r}-Z${r}),2)`, x.AA_sgkMatrah);
    yaz('AB', `ROUND((W${r}-S${r}-Z${r}-AD${r}-AE${r}),2)-AM${r}`, x.AB_gvmAylik);
    yaz('AC', `ROUND((Y${r}+AB${r}),2)`, x.AC_gvmYillik);
    yaz('AD', `ROUND((IF(X${r}="HAYIR",AA${r}*${b.sgkIsci},AA${r}*${b.sgdpIsci})),2)`, x.AD_sgk);
    yaz('AE', `ROUND((IF(X${r}="HAYIR",AA${r}*${b.issizlikIsci},AA${r}*${b.issizlikEmekli})),2)`, x.AE_issizlik);
    yaz('AF', `IF(AG${r}<0,0,AG${r})`, x.AF_gelirVergisi);
    yaz('AG', g.surucuVar ? gvFormulu(p, r) : '0', x.AG_hGelirVergisi);
    yaz('AH', `IF(AI${r}<0,0,AI${r})`, x.AH_damga);
    yaz('AI', g.surucuVar ? `ROUND((W${r}-Z${r}-${asg})*${b.damga},2)` : '0', x.AI_hDamga);
    yaz('AJ', `W${r}-AD${r}-AE${r}-AF${r}-AH${r}`, x.AJ_odenecek);
    V(ws, `AK${r}`, x.AK_calismaAyi);
    yaz('AL', `VLOOKUP(AK${r},$AS$2:$AT$13,2,FALSE)`, x.AL_vergiIndirimi);
    V(ws, `AM${r}`, x.AM_ozelSigorta);
    yaz('AO', i === 0 ? 'DAY(EDATE(Giriş!Z11,1)-DAY(Giriş!Z11))' : 'AO2', x.AO_ayGunu);
    yaz('AP', `Giriş!J${r}`, x.AP_raporIzin);
    yaz('AQ', `$AO$2-AP${r}`, x.AQ_calismaGunu);
    yaz('AR', `IF(AP${r}>0,${b.ayGun}-AQ${r},0)`, x.AR_kesinti);
  });
  // Yardımcı tablolar
  V(ws, 'AN2', 'Evet'); V(ws, 'AN3', 'Hayır');
  V(ws, 'AN1', 'Asgari Ücret / GV Dilimleri');
  V(ws, 'AN4', b.asgariUcretBrut);
  b.gvDilimleri.forEach((d, i) => { if (d.ust != null) V(ws, `AN${5 + i}`, d.ust); });
  V(ws, 'AS1', 'Ay'); V(ws, 'AT1', 'Vergi İndirimi');
  son.firma.vergiIndirimTablosu.forEach((t, i) => {
    const r = 2 + i;
    V(ws, `AS${r}`, t.ay);
    V(ws, `AT${r}`, t.tutar);
    V(ws, `AV${r}`, t.aylikMatrah);
    V(ws, `AW${r}`, t.kumulatif);
  });
  const top = son2 + 2;
  F(ws, `AJ${top}`, `ROUND((SUM(AJ2:AJ${son2})),2)`, son.firma.surucuFaaliyetToplam);
  F(ws, `W${top}`, `SUM(W2:W${son2})`, son.firma.surucuFaaliyet.reduce((s, x) => s + x.W_brut, 0));
  for (const c of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) F(ws, `${c}${top}`, `SUM(${c}2:${c}${son2})`, son.firma.surucuFaaliyet.reduce((s, x) => s + (x as any)[c], 0));
  ws.getRow(top).font = { bold: true };
  for (let r = 2; r <= son2; r++) ws.getCell(`X${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['$AN$2:$AN$3'] };
}

function aracFaaliyetSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, sayfalar: string[], canli: boolean) {
  const sl = L().firma.aracFaaliyet;
  const ws = wb.addWorksheet('Araç Faaliyet');
  sayfaHazirla(ws, sl);
  blokKopyala(ws, sl, 1, 1, 1);
  son.firma.aracFaaliyet.forEach((x, i) => {
    const r = 2 + i;
    satirStili(ws, sl, 2, r, 8);
    const s = sq(sayfalar[i]);
    const yaz = (a: string, f: string, v: any) => (canli ? F(ws, `${a}${r}`, f, v) : V(ws, `${a}${r}`, v));
    yaz('A', `Giriş!A${r}`, x.plaka);
    yaz('B', `Giriş!B${r}`, x.surucu);
    yaz('C', `${s}!G16-${s}!G15`, x.C_km);
    yaz('D', `'ÖN TABLO'!N${6 + i}`, x.D_kira);
    yaz('E', `'ÖN TABLO'!F${6 + i}`, x.E_surucuUcreti);
    yaz('F', `'ÖN TABLO'!U${6 + i}`, x.F_hizmetDisi);
    yaz('G', `${s}!G16`, x.G_kapanisKm);
    yaz('H', `'Sürücü Faaliyet'!AC${r}`, x.H_kumulatif);
  });
  const t = son.firma.aracFaaliyet.length + 2;
  for (const [c, k] of [['C', 'C_km'], ['D', 'D_kira'], ['E', 'E_surucuUcreti'], ['F', 'F_hizmetDisi']] as const)
    F(ws, `${c}${t}`, `SUM(${c}2:${c}${t - 1})`, son.firma.aracFaaliyet.reduce((s, x) => s + x[k], 0));
  ws.getRow(t).font = { bold: true };
}

function bordroSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, canli: boolean) {
  const sl = L().firma.bordroTutar;
  const ws = wb.addWorksheet('Bordro Tutar');
  sayfaHazirla(ws, sl);
  const n = son.giris.length;
  const liste = son.firma.bordro; // alfabetik
  const orijinal = son.firma.surucuFaaliyet.filter((x, i) => son.giris[i].surucuVar);
  liste.forEach((x, i) => {
    const r = 1 + i;
    satirStili(ws, sl, 1, r, 8);
    V(ws, `A${r}`, x.surucu);
    if (canli) F(ws, `B${r}`, `VLOOKUP(A${r},'Sürücü Faaliyet'!$B$2:$AJ$${n + 1},35,)`, x.tutar);
    else V(ws, `B${r}`, x.tutar);
    V(ws, `C${r}`, Math.round(x.tutar * 100) / 100);
  });
  orijinal.forEach((x, i) => {
    const r = 1 + i;
    V(ws, `G${r}`, x.surucu);
    if (canli) F(ws, `H${r}`, `VLOOKUP(G${r},$A$1:$E$${liste.length + 3},2,FALSE)`, x.AJ_odenecek);
    else V(ws, `H${r}`, x.AJ_odenecek);
  });
  const t = liste.length + 1;
  V(ws, `A${t}`, 'Toplam'); V(ws, `G${t}`, 'Toplam');
  F(ws, `B${t}`, `SUM(B1:B${t - 1})`, son.firma.bordroToplam);
  F(ws, `C${t}`, `SUM(C1:C${t - 1})`, liste.reduce((s, x) => s + Math.round(x.tutar * 100) / 100, 0));
  F(ws, `H${t}`, `SUM(H1:H${t - 1})`, son.firma.bordroToplam);
  ws.getRow(t).font = { bold: true };
  for (const c of ['B', 'C', 'H']) ws.getColumn(c).numFmt = '#,##0.00';
  ws.getColumn('A').width = Math.max(ws.getColumn('A').width ?? 10, 28);
  ws.getColumn('G').width = Math.max(ws.getColumn('G').width ?? 10, 28);
}

// ---------------------------------------------------------------- tekil çıktılar (butonlar)
export async function tekilExcel(tur: 'surucuFaaliyet' | 'aracFaaliyet' | 'bordro' | 'onTablo', son: DonemSonucu, p: Params, hedef: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Makine İkmal Hakediş';
  wb.calcProperties.fullCalcOnLoad = true;
  const kullanilan = new Set<string>();
  const sayfalar = son.giris.map((g) => sayfaAdi(g.plaka || `SURUCU${g.driverId}`, kullanilan));
  if (tur === 'surucuFaaliyet') surucuFaaliyetSayfasi(wb, son, p, sayfalar, false);
  if (tur === 'aracFaaliyet') aracFaaliyetSayfasi(wb, son, sayfalar, false);
  if (tur === 'bordro') bordroSayfasi(wb, son, false);
  if (tur === 'onTablo') {
    // ÖN TABLO tek başına: formüller bağımlı olduğu için Giriş + plaka formlarıyla birlikte
    girisSayfasi(wb, son, p);
    onTabloSayfasi(wb, son, p, sayfalar);
    son.giris.forEach((g, i) => plakaFormuSayfasi(wb, son, p, i, sayfalar[i], true));
    wb.getWorksheet('Giriş')!.state = 'visible';
  }
  await wb.xlsx.writeFile(hedef);
}

/** Tek plaka formu (değerlerle) — bir veya birden çok plaka */
export async function plakaFormlariExcel(son: DonemSonucu, p: Params, indeksler: number[], hedef: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Makine İkmal Hakediş';
  const kullanilan = new Set<string>();
  for (const i of indeksler) plakaFormuSayfasi(wb, son, p, i, sayfaAdi(son.giris[i].plaka || `SURUCU${son.giris[i].driverId}`, kullanilan), false);
  await wb.xlsx.writeFile(hedef);
}

// ================================================================== KURUM PUANTAJ DOSYASI
export interface KurumKaynak {
  tatiller: Tatil[];
  surucuGunleri: any[]; // DB satırları
  seferler: any[];      // DB satırları (ad_soyad dahil)
  suruculer: { id: number; ad_soyad: string; yol_hakki: number }[];
}

export async function kurumPuantajExcel(son: DonemSonucu, p: Params, k: KurumKaynak, hedef: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Makine İkmal Hakediş';
  wb.calcProperties.fullCalcOnLoad = true;
  const { yil, ay } = parseAy(son.ay);
  const ayAdi = AY_ADLARI[ay - 1];
  const harita = tatilHaritasi(k.tatiller);
  const satirlar = son.giris;
  // --- Giriş
  {
    const sl = L().kurum.giris;
    const ws = wb.addWorksheet('Giriş');
    sayfaHazirla(ws, sl);
    blokKopyala(ws, sl, 1, 2, 1);
    V(ws, 'A1', 'Firma Adı'); V(ws, 'B1', p.kurum.firmaAdi || p.kurum.firmaKisaAdi);
    satirlar.forEach((g, i) => {
      const r = 3 + i;
      satirStili(ws, sl, 3, r, 5);
      V(ws, `A${r}`, g.plaka); V(ws, `B${r}`, g.surucu); V(ws, `C${r}`, g.gorevYeri); V(ws, `D${r}`, g.aracTipi); V(ws, `E${r}`, g.modelYili ?? '');
    });
  }
  // --- EK-4 Sürücü Puantaj
  surucuPuantajSayfasi(wb, son, p, k);
  // --- Plaka puantaj sayfaları
  const kullanilan = new Set<string>(['GİRİŞ', 'SÜRÜCÜ PUANTAJ', 'HAKEDİŞ']);
  const surucuAd = new Map(k.suruculer.map((s) => [s.id, s]));
  satirlar.forEach((g, i) => {
    if (g.vehicleId == null) return;
    const sl = L().kurum.plaka;
    const ws = wb.addWorksheet(sayfaAdi(g.plaka, kullanilan));
    sayfaHazirla(ws, sl);
    blokKopyala(ws, sl, 1, 7, 1);
    blokKopyala(ws, sl, 38, 68, 38);
    V(ws, 'B1', `${p.kurum.kurumAdi} \n${p.kurum.bolgeAdi}`);
    V(ws, 'D3', g.gorevYeri); V(ws, 'D4', p.kurum.firmaAdi || p.kurum.firmaKisaAdi); V(ws, 'D5', g.surucu); V(ws, 'L5', g.plaka);
    V(ws, 'D6', g.aracTipi); V(ws, 'E6', g.modelYili ?? ''); V(ws, 'P5', ayAdi); V(ws, 'S5', yil); V(ws, 'AE2', ayAdi); V(ws, 'AH2', yil);
    const gunKayit = new Map<string, any>();
    if (g.driverId != null) for (const x of k.surucuGunleri.filter((x) => x.surucu_id === g.driverId)) gunKayit.set(x.tarih, x);
    const aracSefer = k.seferler.filter((x) => x.arac_id === g.vehicleId);
    for (let gun = 1; gun <= 31; gun++) {
      const r = 7 + gun;
      satirStili(ws, sl, 8, r, 21);
      const tarih = son.gunler[gun - 1];
      if (!tarih) continue;
      const sinif = gunSinifla(tarih, harita, p);
      ws.getCell(`B${r}`).value = isoTarih(tarih);
      ws.getCell(`B${r}`).numFmt = 'dd.mm.yyyy ddd';
      const renk = sinif.RT || sinif.DB ? 'FFF4CCCC' : sinif.RTA || sinif.DBA ? 'FFFCE4D6' : sinif.Pzr || sinif.Ctesi ? 'FFE7E6E6' : null;
      if (renk) for (let c = 2; c <= 20; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: renk } };
      if (sinif.tip !== 'İş' && sinif.tip !== 'Cts' && sinif.tip !== 'Pzr') V(ws, `C${r}`, sinif.tip);
      const s = aracSefer.filter((x) => x.tarih === tarih);
      if (s.length) {
        const cik = s.map((x) => x.km_cikis).filter((x: any) => x != null);
        const don = s.map((x) => x.km_donus).filter((x: any) => x != null);
        if (cik.length) V(ws, `F${r}`, Math.min(...cik));
        if (don.length) V(ws, `G${r}`, Math.max(...don));
        const hiz = s.reduce((t, x) => t + (x.km_cikis != null && x.km_donus != null ? x.km_donus - x.km_cikis : 0), 0);
        if (cik.length || don.length) F(ws, `H${r}`, s.length === 1 ? `G${r}-F${r}` : String(hiz), hiz);
        if (s.some((x) => x.arac_ig)) V(ws, `I${r}`, 'X');
        const igd = Math.max(0, ...s.map((x) => x.arac_igd || 0));
        if (igd) V(ws, `J${r}`, igd);
        V(ws, `D${r}`, s.map((x) => x.gorevli).filter(Boolean).join(' / '));
        V(ws, `E${r}`, s.map((x) => x.gorev_yeri).filter(Boolean).join(' / '));
        const digerleri = [...new Set(s.filter((x) => x.surucu_id !== g.driverId).map((x) => surucuAd.get(x.surucu_id)?.ad_soyad ?? '?'))];
        if (digerleri.length) V(ws, `AR${r}`, `${digerleri.join(', ')} ÇALIŞTI.`);
      }
      const d = gunKayit.get(tarih);
      if (d) {
        V(ws, `K${r}`, d.durum === '' || d.durum === '0' ? 0 : d.durum);
        const sg = { driverId: d.surucu_id, tarih, durum: d.durum, fazlaMesai: d.fazla_mesai, haftaTatili: !!d.hafta_tatili, resmiTatil: d.resmi_tatil, disGorev: d.dis_gorev, konaklama: !!d.konaklama, yemekOverride: d.yemek_override == null ? null : !!d.yemek_override, yolOverride: d.yol_override == null ? null : !!d.yol_override };
        V(ws, `L${r}`, yemekHakki(sg, p.puantaj.disGorevdeYemekYol) ? 1 : 0);
        V(ws, `M${r}`, yolHakki(sg, { yolHakki: !!surucuAd.get(d.surucu_id)?.yol_hakki }, p.puantaj.disGorevdeYemekYol) ? 1 : 0);
        if (d.cikis_saat) V(ws, `N${r}`, d.cikis_saat);
        if (d.donus_saat) V(ws, `O${r}`, d.donus_saat);
        if (d.fazla_mesai) V(ws, `P${r}`, d.fazla_mesai);
        if (d.hafta_tatili) V(ws, `Q${r}`, 'X');
        if (d.resmi_tatil) V(ws, `R${r}`, d.resmi_tatil);
        if (d.dis_gorev) V(ws, `S${r}`, d.dis_gorev === 1 ? 'X' : d.dis_gorev);
        if (d.konaklama) V(ws, `T${r}`, 'X');
        if (d.notlar) V(ws, `AS${r}`, d.notlar);
      } else if (g.driverId != null) {
        V(ws, `K${r}`, 0); V(ws, `L${r}`, 0); V(ws, `M${r}`, 0);
      }
    }
    // Toplam satırları (39, 41) — şablondaki formüller korunur, sonuçlar hesaplanır
    const sa = son.kurum[i].surucuAy;
    const aa = son.kurum[i].aracAy;
    const t39: [string, string, number][] = [
      ['H39', 'SUM(H8:H38)', aa?.hizmetIciKm ?? 0], ['I39', 'COUNTIF(I8:I38,"x")', aa?.ig ?? 0], ['J39', 'SUM(J8:J38)', aa?.igd ?? 0],
      ['K39', 'COUNTIF(K8:K38,"x")', sa?.surucuCalisma ?? 0], ['L39', 'SUM(L8:L38)', sa?.yemek ?? 0], ['M39', 'SUM(M8:M38)', sa?.yol ?? 0],
      ['P39', 'SUM(P8:P38)', sa?.fazlaMesai ?? 0], ['Q39', 'COUNTIF(Q8:Q38,"x")', sa?.haftaTatili ?? 0], ['R39', 'SUM(R8:R38)', sa?.resmiTatil ?? 0],
      ['S39', 'SUM(S8:S38)+COUNTIF(S8:S38,"x")', sa?.disGorev ?? 0], ['T39', 'COUNTIF(T8:T38,"x")', sa?.konaklama ?? 0],
      ['F41', 'SUM(I39:J39)', aa?.aracCalisma ?? 0], ['G41', 'SUM(K39)', sa?.surucuCalisma ?? 0], ['H41', 'MAX(F8:G38)-MIN(F8:G38)', aa?.toplamKm ?? 0],
      ['I41', 'SUM(H39)', aa?.hizmetIciKm ?? 0], ['J41', 'H41-I41', aa?.hariciKm ?? 0], ['K41', 'SUM(L39)', sa?.yemek ?? 0], ['L41', 'SUM(M39)', sa?.yol ?? 0],
      ['M41', 'SUM(P39)', sa?.fazlaMesai ?? 0], ['N41', 'SUM(Q39)', sa?.haftaTatili ?? 0], ['O41', 'SUM(R39)', sa?.resmiTatil ?? 0],
      ['P41', 'SUM(S39)', sa?.disGorev ?? 0], ['Q41', 'SUM(T39)', sa?.konaklama ?? 0],
    ];
    for (const [a, f, v] of t39) F(ws, a, f, v);
    // eski yardımcı formül hücrelerini temizle
    for (const a of ['AQ39', 'AL39', 'AL40', 'AL41']) ws.getCell(a).value = null;
  });
  // --- HAKEDİŞ
  {
    const sl = L().kurum.hakedis;
    const ws = wb.addWorksheet('HAKEDİŞ');
    sayfaHazirla(ws, sl);
    blokKopyala(ws, sl, 1, 1, 1);
    son.kurum.forEach((x, i) => {
      const r = 2 + i;
      satirStili(ws, sl, 2, r, 14);
      const vals = [x.plaka, x.surucu, x.ig, x.igd, x.surucuCalisma, x.kapanisKm, x.hizmetIciKm, x.fazlaMesai, x.haftaTatili, x.resmiTatil, x.disGorev, x.konaklama, x.yemek, x.yol];
      vals.forEach((v, c) => V(ws, `${colLetter(c + 1)}${r}`, v));
    });
    const t = 2 + son.kurum.length;
    satirStili(ws, sl, 43, t, 14);
    V(ws, `A${t}`, 'TOPLAM');
    for (let c = 3; c <= 14; c++) {
      const L2 = colLetter(c);
      F(ws, `${L2}${t}`, `SUM(${L2}2:${L2}${t - 1})`, son.kurum.reduce((s, x) => s + ([0, 0, x.ig, x.igd, x.surucuCalisma, x.kapanisKm, x.hizmetIciKm, x.fazlaMesai, x.haftaTatili, x.resmiTatil, x.disGorev, x.konaklama, x.yemek, x.yol][c - 1] as number), 0));
    }
  }
  await wb.xlsx.writeFile(hedef);
}

function surucuPuantajSayfasi(wb: ExcelJS.Workbook, son: DonemSonucu, p: Params, k: KurumKaynak) {
  const sl = L().kurum.surucuPuantaj;
  const ws = wb.addWorksheet('Sürücü Puantaj');
  sayfaHazirla(ws, sl);
  blokKopyala(ws, sl, 1, 9, 1);
  const { yil, ay } = parseAy(son.ay);
  V(ws, 'C2', p.kurum.firmaAdi || p.kurum.firmaKisaAdi);
  V(ws, 'C3', p.kurum.firmaAdresi);
  V(ws, 'AM5', AY_ADLARI[ay - 1].toLocaleUpperCase('tr-TR'));
  V(ws, 'AM6', String(yil));
  const suruculer = son.kurum.filter((x) => x.driverId != null);
  const gunMap = new Map<string, any>();
  for (const g of k.surucuGunleri) gunMap.set(`${g.surucu_id}|${g.tarih}`, g);
  suruculer.forEach((x, i) => {
    const r = 10 + 2 * i;
    satirStili(ws, sl, 10, r, 46);
    satirStili(ws, sl, 11, r + 1, 46);
    for (const m of sl.merges) {
      const [a, b] = m.split(':');
      const pa = parseAddr(a), pb = parseAddr(b);
      if (pa.r >= 10 && pa.r <= 11) try { ws.mergeCells(pa.r - 10 + r, pa.c, pb.r - 10 + r, pb.c); } catch { /* */ }
    }
    V(ws, `A${r}`, i + 1);
    V(ws, `B${r}`, x.surucu);
    son.gunler.forEach((t, gi) => {
      const c = colLetter(3 + gi);
      const d = gunMap.get(`${x.driverId}|${t}`);
      V(ws, `${c}${r}`, d && d.durum && d.durum !== '0' ? d.durum : 0);
      V(ws, `${c}${r + 1}`, d?.fazla_mesai || 0);
    });
    const R = `C${r}:AG${r}`;
    const a = x.surucuAy!;
    F(ws, `AH${r}`, `SUM(COUNTIF(${R},"B"),COUNTIF(${R},"X"))`, a.calisilanGun);
    F(ws, `AI${r}`, `COUNTIF(${R},"R")`, a.raporlu);
    F(ws, `AJ${r}`, `SUM(COUNTIF(${R},"Üİ"),COUNTIF(${R},"Sİ"),COUNTIF(${R},"Mİ"),COUNTIF(${R},"İİ"))`, a.izin);
    F(ws, `AK${r}`, `COUNTIF(${R},0)`, a.calisilmayan);
    V(ws, `AL${r}`, a.toplamGun);
    V(ws, `AM${r}`, a.fazlaCalismaSaati);
    V(ws, `AN${r}`, a.resmiTatil);
    V(ws, `AO${r}`, a.yemek);
    V(ws, `AP${r}`, a.yol);
    V(ws, `AQ${r}`, a.disGorev);
    V(ws, `AR${r}`, a.konaklama);
  });
  const hedef = 10 + 2 * suruculer.length;
  blokKopyala(ws, sl, 92, 110, hedef);
}
