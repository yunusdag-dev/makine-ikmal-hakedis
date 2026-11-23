/**
 * Uçtan uca: boş veritabanı -> Excel içe aktarma -> günlük kayıtlardan hesap -> Excel ile birebir karşılaştırma.
 * Ayrıca atomik kayıt, yeniden açma, yedek ve geri yükleme denenir.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../electron/store';
import { Api } from '../electron/api';
import { excelIceAktar } from '../electron/importDb';
import { oku, ornekVar, KURUM_DOSYA, FIRMA_DOSYA, Karsilastirici } from './helpers';
import { cv } from '../src/importer/excelImport';

const WASM = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const d = ornekVar ? describe : describe.skip;

d('Veritabanı akışı (Excel içe aktarma -> hesap)', () => {
  let dir: string;
  let store: Store;
  let api: Api;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-test-'));
    store = new Store(path.join(dir, 'hakedis.db'));
    await store.ac(WASM, { kullanici: 'test', saltOkunur: false });
    api = new Api(store);
    await excelIceAktar(store, KURUM_DOSYA, FIRMA_DOSYA, api.parametreler('2026-08'));
  });

  it('İçe aktarılan Ağustos 2026, ÖN TABLO ve bordro ile kuruşu kuruşuna aynı', async () => {
    const sonuc = api.hesapla('2026-08');
    const wb = await oku(FIRMA_DOSYA);
    const O = wb.getWorksheet('ÖN TABLO')!;
    const S = wb.getWorksheet('Sürücü Faaliyet')!;
    const k = new Karsilastirici();
    expect(sonuc.firma.onTablo.length).toBe(41);
    sonuc.firma.onTablo.forEach((row, i) => {
      const r = 6 + i;
      expect(cv(O, `E${r}`)).toBe(row.plaka);
      for (const [c, key] of [['F', 'F_surucuUcreti'], ['G', 'G_iscilikFF'], ['I', 'I_iscilikToplam'], ['N', 'N_aracToplam'], ['Q', 'Q_konaklama'], ['T', 'T_disGorev'], ['U', 'U_akaryakit'], ['V', 'V_kdvHaric'], ['W', 'W_kdvDahil']] as const)
        k.esit(`${row.plaka} ${c}`, cv(O, `${c}${r}`), (row as any)[key]);
    });
    k.esit('W47', cv(O, 'W47'), sonuc.firma.onTabloToplam.W);
    k.esit('V57', cv(O, 'V57'), sonuc.firma.fatura.faturaToplami);
    sonuc.firma.surucuFaaliyet.forEach((x, i) => k.esit(`${x.plaka} AJ`, cv(S, `AJ${2 + i}`), x.AJ_odenecek));
    expect(k.hatalar).toEqual([]);
    expect(sonuc.uyarilar.filter((u) => u.seviye === 'hata')).toEqual([]);
  });

  it('Dosya yeniden açılınca aynı veri gelir; yedek alınır ve geri yüklenir', async () => {
    const once = api.hesapla('2026-08').firma.fatura.faturaToplami;
    store.kapat();
    const s2 = new Store(path.join(dir, 'hakedis.db'));
    await s2.ac(WASM, { kullanici: 'test2', saltOkunur: false });
    const a2 = new Api(s2);
    expect(a2.hesapla('2026-08').firma.fatura.faturaToplami).toBe(once);
    const yedek = a2.yedekAl();
    expect(fs.existsSync(yedek)).toBe(true);
    // bir değişiklik yap, sonra yedekten dön
    const ilkArac = a2.araclar()[0];
    a2.aracKaydet({ ...ilkArac, kira_bedeli: 1 });
    expect(a2.hesapla('2026-08').firma.fatura.faturaToplami).not.toBe(once);
    a2.yedektenYukle(yedek);
    expect(a2.hesapla('2026-08').firma.fatura.faturaToplami).toBe(once);
    expect(a2.kayitlar({})[0].islem).toBe('geri yükle');
    // Dönem kapatma: kümülatif matrah sonraki aya devreder
    a2.donemKapat('2026-08');
    const eylul = a2.donemVerisi('2026-09');
    const agustos = a2.hesapla('2026-08');
    const ilk = agustos.giris[0];
    expect(eylul.oncekiKumulatifOtomatik[ilk.driverId!]).toBe(agustos.firma.surucuFaaliyet[0].AC_gvmYillik);
    expect(() => a2.gunKaydet(ilk.driverId!, '2026-08-05', { durum: 'X' }, [])).toThrow(/kapatılmış/);
    s2.kapat();
    store = s2; api = a2;
  });
});
