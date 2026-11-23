/**
 * Ağustos 2026 örnek dosyalarındaki gerçek rakamlar beklenen değerdir.
 * Uygulama, tüm araç ve sürücülerin çıktılarını Excel ile kuruşu kuruşuna aynı vermezse test başarısız olur.
 * (Örnek dosyalar repoda değildir; yoksa testler atlanır.)
 */
import { describe, it, expect } from 'vitest';
import { oku, ornekVar, KURUM_DOSYA, FIRMA_DOSYA, Karsilastirici } from './helpers';
import { parseKurum, parseFirma, cv, plakaKey } from '../src/importer/excelImport';
import { kurumHakedis } from '../src/engine/kurum';
import { firmaHakedis, FirmaGirisSatiri } from '../src/engine/firma';
import { ayGunSayisi, tarihStr } from '../src/engine/excel';
import { ayTakvimi } from '../src/engine/calendar';
import { VARSAYILAN_PARAMS } from '../src/engine/params';
import type { AracKart, AracSefer, SurucuGun, SurucuKart } from '../src/engine/types';

const d = ornekVar ? describe : describe.skip;

export async function kurumGirdisi() {
  const wb = await oku(KURUM_DOSYA);
  const k = parseKurum(wb);
  const araclar: AracKart[] = [];
  const suruculer: SurucuKart[] = [];
  const gunler: SurucuGun[] = [];
  const seferler: AracSefer[] = [];
  k.plakalar.forEach((p, i) => {
    araclar.push({ id: i + 1, plaka: p.plaka, markaModel: '', modelYili: p.modelYili, aracTipi: p.aracTipi, gorevYeri: p.gorevYeri, tuketimOrani: 0, kiraBedeli: 0, yakitYansitmaCarpani: 1, sira: i, aktif: true });
    suruculer.push({ id: i + 1, adSoyad: p.surucu, varsayilanAracId: i + 1, ucretGrubu: 'surucu', emekli: false, yolHakki: true, sira: i, aktif: true });
    for (const g of p.gunler) {
      gunler.push({
        driverId: i + 1, tarih: g.tarih, durum: g.durum, fazlaMesai: g.fazlaMesai, haftaTatili: g.haftaTatili,
        resmiTatil: g.resmiTatil, disGorev: g.disGorev, konaklama: g.konaklama,
        yemekOverride: g.yemekElle === null ? null : g.yemekElle !== 0,
        yolOverride: g.yolElle === null ? null : g.yolElle !== 0,
      });
      if (g.kmCikis != null || g.kmDonus != null || g.aracIG || g.aracIGD) {
        seferler.push({ driverId: i + 1, vehicleId: i + 1, tarih: g.tarih, kmCikis: g.kmCikis, kmDonus: g.kmDonus, aracIG: g.aracIG, aracIGD: g.aracIGD });
      }
    }
  });
  const tumGunler = Array.from({ length: ayGunSayisi(k.yil, k.ay) }, (_, i) => tarihStr(k.yil, k.ay, i + 1));
  return { wb, k, araclar, suruculer, gunler, seferler, tumGunler };
}

d('AŞAMA 1 — Kurum puantajı (Ağustos 2026.xlsx)', () => {
  it('HAKEDİŞ sayfası: 41 plakanın tüm sütunları birebir', async () => {
    const { wb, araclar, suruculer, gunler, seferler, tumGunler } = await kurumGirdisi();
    const sonuc = kurumHakedis(tumGunler, suruculer, araclar, gunler, seferler, 7.5);
    const H = wb.getWorksheet('HAKEDİŞ')!;
    const k = new Karsilastirici();
    let satir = 0;
    for (let r = 2; r < 100; r++) {
      const plaka = cv(H, `A${r}`);
      if (!plaka) break;
      const s = sonuc.find((x) => x.plaka === plaka)!;
      expect(s, `satır ${plaka}`).toBeTruthy();
      const t = `${plaka}`;
      k.esit(`${t} C İG`, cv(H, `C${r}`), s.ig);
      k.esit(`${t} D İGD`, cv(H, `D${r}`), s.igd);
      k.esit(`${t} E Sürücü çalışma`, cv(H, `E${r}`), s.surucuCalisma);
      k.esit(`${t} F Kapanış KM`, cv(H, `F${r}`), s.kapanisKm);
      k.esit(`${t} G Hizmet içi KM`, cv(H, `G${r}`), s.hizmetIciKm);
      k.esit(`${t} H Fazla mesai`, cv(H, `H${r}`), s.fazlaMesai);
      k.esit(`${t} I Hafta tatili`, cv(H, `I${r}`), s.haftaTatili);
      k.esit(`${t} J Resmi tatil`, cv(H, `J${r}`), s.resmiTatil);
      k.esit(`${t} K Dış görev`, cv(H, `K${r}`), s.disGorev);
      k.esit(`${t} L Konaklama`, cv(H, `L${r}`), s.konaklama);
      k.esit(`${t} M Yemek`, cv(H, `M${r}`), s.yemek);
      k.esit(`${t} N Yol`, cv(H, `N${r}`), s.yol);
      satir++;
    }
    expect(satir).toBe(41);
    expect(k.hatalar).toEqual([]);
  });

  it('Sürücü Puantaj (EK-4) özet sütunları birebir', async () => {
    const { wb, araclar, suruculer, gunler, seferler, tumGunler } = await kurumGirdisi();
    const sonuc = kurumHakedis(tumGunler, suruculer, araclar, gunler, seferler, 7.5);
    const S = wb.getWorksheet('Sürücü Puantaj')!;
    const k = new Karsilastirici();
    sonuc.forEach((s, i) => {
      const r = 10 + 2 * i;
      const a = s.surucuAy!;
      const t = s.plaka;
      k.esit(`${t} AH`, cv(S, `AH${r}`), a.calisilanGun);
      k.esit(`${t} AI`, cv(S, `AI${r}`), a.raporlu);
      k.esit(`${t} AJ`, cv(S, `AJ${r}`), a.izin);
      k.esit(`${t} AK`, cv(S, `AK${r}`), a.calisilmayan);
      k.esit(`${t} AL`, cv(S, `AL${r}`), a.toplamGun);
      k.esit(`${t} AM`, cv(S, `AM${r}`), a.fazlaCalismaSaati);
      k.esit(`${t} AN`, cv(S, `AN${r}`), a.resmiTatil);
      k.esit(`${t} AO`, cv(S, `AO${r}`), a.yemek);
      k.esit(`${t} AP`, cv(S, `AP${r}`), a.yol);
      k.esit(`${t} AQ`, cv(S, `AQ${r}`), a.disGorev);
      k.esit(`${t} AR`, cv(S, `AR${r}`), a.konaklama);
    });
    expect(k.hatalar).toEqual([]);
  });

  it('Takvim (Günler sayfası) sayıları birebir', async () => {
    const wb = await oku(KURUM_DOSYA);
    const T = wb.getWorksheet('Tatil')!;
    const tatiller: any[] = [];
    for (let r = 5; r <= 116; r++) {
      const add = (col: string, tur: string, adCol?: string) => {
        const v = cv(T, `${col}${r}`);
        if (v instanceof Date) tatiller.push({ tarih: v.toISOString().slice(0, 10), tur, ad: adCol ? String(cv(T, `${adCol}${r}`) ?? '') : '' });
      };
      add('B', 'RT', 'C'); add('D', 'RTA'); add('G', 'DB', 'H'); add('I', 'DBA', 'J');
    }
    const t = ayTakvimi(2026, 8, tatiller, VARSAYILAN_PARAMS);
    const G = wb.getWorksheet('Günler')!;
    const k = new Karsilastirici();
    k.esit('Hafta içi', cv(G, 'C6'), t.sayilar.X);
    k.esit('Cumartesi', cv(G, 'D6'), t.sayilar.Ctesi);
    k.esit('Pazar', cv(G, 'E6'), t.sayilar.Pzr);
    k.esit('RTA', cv(G, 'F6'), t.sayilar.RTA);
    k.esit('RT', cv(G, 'G6'), t.sayilar.RT);
    k.esit('DBA', cv(G, 'H6'), t.sayilar.DBA);
    k.esit('DB', cv(G, 'I6'), t.sayilar.DB);
    k.esit('Toplam iş günü', cv(wb.getWorksheet('iş günü')!, 'T25'), t.toplamIsGunu);
    // Ekim 2026: 28 Ekim arifesi + 29 Ekim; Mayıs 2026: Kurban Bayramı
    expect(ayTakvimi(2026, 10, tatiller, VARSAYILAN_PARAMS).sayilar.RTA).toBe(1);
    expect(ayTakvimi(2026, 5, tatiller, VARSAYILAN_PARAMS).sayilar.DB).toBe(4);
    expect(k.hatalar).toEqual([]);
  });
});

export async function firmaGirdisi() {
  const wb = await oku(FIRMA_DOSYA);
  const f = parseFirma(wb);
  const satirlar: FirmaGirisSatiri[] = f.satirlar.map((s, i) => ({
    ...s, key: String(i), driverId: i, vehicleId: i, surucuVar: true, aracVar: true,
  }));
  const [y, m] = f.hakedisTarihi.split('-').map(Number);
  return { wb, f, satirlar, ayGunu: ayGunSayisi(y, m) };
}

d('AŞAMA 2 — Firma hakedişi (Firma Ağustos 2026 Hakediş.xlsx)', () => {
  it('Plaka hakediş formları (41 form, tüm hesap hücreleri)', async () => {
    const { wb, f, satirlar, ayGunu } = await firmaGirdisi();
    const s = firmaHakedis(satirlar, f.params, ayGunu);
    const k = new Karsilastirici();
    satirlar.forEach((r, i) => {
      const ws = wb.getWorksheet(plakaKey(r.plaka)) ?? wb.worksheets.find((w) => plakaKey(w.name) === plakaKey(r.plaka))!;
      const fm = s.formlar[i];
      const c = (a: string) => cv(ws, a);
      const t = r.plaka;
      const pairs: [string, number][] = [
        ['G19', fm.G19_hizmetDisiKm], ['I15', fm.I15_yakitYansitma], ['I18', fm.I18_kesinti], ['M19', fm.M19_pn], ['M20', fm.M20_aracFiyatFarki],
        ['B28', fm.B28], ['D28', fm.D28], ['E28', fm.E28], ['F28', fm.F28], ['G28', fm.G28], ['H28', fm.H28], ['I28', fm.I28],
        ['K26', fm.K26_surucuUcreti], ['L26', fm.L26_fiyatFarki], ['K28', fm.K28_toplamSurucu],
        ['K31', fm.K31], ['K32', fm.K32], ['K33', fm.K33], ['K34', fm.K34], ['K35', fm.K35_aracKiralama], ['K36', fm.K36_aracKdv],
        ['K37', fm.K37_aracTevkifat], ['K38', fm.K38_aracToplam], ['K39', fm.K39], ['K40', fm.K40], ['K41', fm.K41], ['K42', fm.K42],
        ['K43', fm.K43], ['K44', fm.K44], ['K45', fm.K45], ['K46', fm.K46],
      ];
      for (const [a, v] of pairs) k.esit(`${t} ${a}`, c(a), v);
    });
    expect(k.sayi).toBe(41 * 31);
    expect(k.hatalar).toEqual([]);
  });

  it('ÖN TABLO: 41 satır × 18 tutar sütunu + toplamlar + fatura özeti', async () => {
    const { wb, f, satirlar, ayGunu } = await firmaGirdisi();
    const s = firmaHakedis(satirlar, f.params, ayGunu);
    const O = wb.getWorksheet('ÖN TABLO')!;
    const k = new Karsilastirici();
    const kol: [string, keyof (typeof s.onTablo)[0]][] = [
      ['F', 'F_surucuUcreti'], ['G', 'G_iscilikFF'], ['H', 'H_asgariFark'], ['I', 'I_iscilikToplam'], ['J', 'J_iscilikKdv'], ['K', 'K_iscilikGenel'],
      ['L', 'L_kira'], ['M', 'M_aracFF'], ['N', 'N_aracToplam'], ['O', 'O_aracKdv'], ['P', 'P_aracGenel'], ['Q', 'Q_konaklama'],
      ['R', 'R_konaklamaKdv'], ['S', 'S_konaklamaGenel'], ['T', 'T_disGorev'], ['U', 'U_akaryakit'], ['V', 'V_kdvHaric'], ['W', 'W_kdvDahil'],
    ];
    s.onTablo.forEach((row, i) => {
      const r = 6 + i;
      expect(cv(O, `E${r}`)).toBe(row.plaka);
      for (const [c, key] of kol) k.esit(`${row.plaka} ${c}`, cv(O, `${c}${r}`), row[key] as number);
    });
    const T = s.onTabloToplam as any;
    for (const c of ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X']) k.esit(`TOPLAM ${c}47`, cv(O, `${c}47`), T[c]);
    const fa = s.fatura;
    const ozet: [string, number][] = [
      ['V48', fa.iscilik], ['V49', fa.arac], ['V50', fa.konaklama], ['V51', fa.iscilikKdv], ['V52', fa.aracKdv], ['V53', fa.konaklamaKdv],
      ['V54', fa.iscilikTevkifat], ['V55', fa.aracTevkifat], ['V56', fa.konaklamaTevkifat], ['V57', fa.faturaToplami], ['V58', fa.damgaVergisi],
    ];
    for (const [a, v] of ozet) k.esit(a, cv(O, a), v);
    expect(k.hatalar).toEqual([]);
  });

  it('Sürücü Faaliyet: brütten nete tüm sütunlar (41 sürücü)', async () => {
    const { wb, f, satirlar, ayGunu } = await firmaGirdisi();
    const s = firmaHakedis(satirlar, f.params, ayGunu);
    const S = wb.getWorksheet('Sürücü Faaliyet')!;
    const k = new Karsilastirici();
    s.surucuFaaliyet.forEach((x, i) => {
      const r = 2 + i;
      const t = x.plaka;
      const pairs: [string, number][] = [
        ['C', x.C], ['D', x.D], ['E', x.E], ['F', x.F], ['G', x.G], ['H', x.H], ['I', x.I], ['J', x.J], ['K', x.K], ['L', x.L],
        ['P', x.P_temel], ['Q', x.Q_resmiTatil], ['R', x.R_fazlaMesai], ['S', x.S_konaklama], ['T', x.T_disGorev], ['U', x.U_yemek],
        ['V', x.V_yol], ['W', x.W_brut], ['Z', x.Z_sgkIstisna], ['AA', x.AA_sgkMatrah], ['AB', x.AB_gvmAylik], ['AC', x.AC_gvmYillik],
        ['AD', x.AD_sgk], ['AE', x.AE_issizlik], ['AF', x.AF_gelirVergisi], ['AG', x.AG_hGelirVergisi], ['AH', x.AH_damga],
        ['AI', x.AI_hDamga], ['AJ', x.AJ_odenecek], ['AL', x.AL_vergiIndirimi], ['AO', x.AO_ayGunu], ['AQ', x.AQ_calismaGunu], ['AR', x.AR_kesinti],
      ];
      for (const [c, v] of pairs) k.esit(`${t} ${c}`, cv(S, `${c}${r}`), v);
    });
    k.esit('AJ43 toplam', cv(S, 'AJ43'), s.surucuFaaliyetToplam);
    s.vergiIndirimTablosu.forEach((v, i) => k.esit(`AT${2 + i}`, cv(S, `AT${2 + i}`), v.tutar));
    expect(k.hatalar).toEqual([]);
  });

  it('Araç Faaliyet ve Bordro Tutar', async () => {
    const { wb, f, satirlar, ayGunu } = await firmaGirdisi();
    const s = firmaHakedis(satirlar, f.params, ayGunu);
    const A = wb.getWorksheet('Araç Faaliyet')!;
    const B = wb.getWorksheet('Bordro Tutar')!;
    const k = new Karsilastirici();
    s.aracFaaliyet.forEach((x, i) => {
      const r = 2 + i;
      k.esit(`${x.plaka} C`, cv(A, `C${r}`), x.C_km);
      k.esit(`${x.plaka} D`, cv(A, `D${r}`), x.D_kira);
      k.esit(`${x.plaka} E`, cv(A, `E${r}`), x.E_surucuUcreti);
      k.esit(`${x.plaka} F`, cv(A, `F${r}`), x.F_hizmetDisi);
      k.esit(`${x.plaka} G`, cv(A, `G${r}`), x.G_kapanisKm);
      k.esit(`${x.plaka} H`, cv(A, `H${r}`), x.H_kumulatif);
    });
    // Bordro: B sütunu (formül) sürücü adına göre
    for (let r = 1; r <= 41; r++) {
      const ad = cv(B, `A${r}`);
      const x = s.bordro.find((b) => b.surucu.trim() === String(ad).trim());
      expect(x, `bordro ${ad}`).toBeTruthy();
      k.esit(`Bordro satır ${r}`, cv(B, `B${r}`), x!.tutar);
    }
    k.esit('Bordro toplam', cv(B, 'B42'), s.bordroToplam);
    expect(s.bordro.length).toBe(41);
    expect(k.hatalar).toEqual([]);
  });
});
