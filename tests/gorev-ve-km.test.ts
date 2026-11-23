import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api';
import { adNorm, adlaraBol } from '../electron/dogrulama';
import { surucuAylik } from '../src/engine/kurum';
import type { SurucuGun } from '../src/engine/types';

const WASM = path.resolve('node_modules/sql.js/dist');

async function kur() {
  const h = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gk-')), 'h.db');
  const s = new Store(h); await s.ac(WASM, { kullanici: 'Test' });
  const api = new Api(s);
  const arac = api.aracKaydet({ plaka: '34 TST 036' } as any);
  const arac2 = api.aracKaydet({ plaka: '34 TST 037' } as any);
  const sur = api.surucuKaydet({ ad_soyad: 'Deneme Sürücü' } as any);
  return { s, api, arac, arac2, sur };
}
const gun = (o: any = {}) => ({ durum: 'X', fazla_mesai: 0, hafta_tatili: 0, resmi_tatil: 0, dis_gorev: 0, konaklama: 0, yemek_override: null, yol_override: null, cikis_saat: '', donus_saat: '', notlar: '', ...o });
const sefer = (arac: number, o: any = {}) => ({ arac_id: arac, km_cikis: null, km_donus: null, arac_ig: 1, arac_igd: 0, gorevli: '', gorev_yeri: '', cikis_saat: '', donus_saat: '', fazla_mesai: 0, mesai_mod: 'oto', ...o });
const harici = (api: Api, sid: number, ay: string) => api.surucuAyi(sid, ay).seferler.map((x: any) => [x.tarih, x.sira, x.harici_km]);

describe('Harici km (önceki kaydın çıkış KM\'si ile yeni giriş KM\'si arasındaki fark)', () => {
  it('örnek: 100→130, ertesi gün 145 ile başlarsa 15 km harici; negatifse yazılmaz; ilk kayıt yok; düzeltme sonraki günü günceller', async () => {
    const { api, arac, sur } = await kur();
    api.gunKaydet(sur, '2026-09-01', gun(), [sefer(arac, { km_cikis: 100, km_donus: 130 })]);
    api.gunKaydet(sur, '2026-09-02', gun(), [sefer(arac, { km_cikis: 145, km_donus: 160 })]);
    expect(harici(api, sur, '2026-09')).toEqual([['2026-09-01', 0, null], ['2026-09-02', 0, 15]]);
    // negatif fark: yeni giriş önceki çıkıştan küçük -> harici yazılmaz
    api.gunKaydet(sur, '2026-09-03', gun(), [sefer(arac, { km_cikis: 150, km_donus: 170 })]);
    expect(harici(api, sur, '2026-09')[2]).toEqual(['2026-09-03', 0, null]);
    // geçmiş kaydı düzelt: 1. gün çıkış 140 olunca 2. günün harici değeri 5 olur
    api.gunKaydet(sur, '2026-09-01', gun(), [sefer(arac, { km_cikis: 100, km_donus: 140 })]);
    expect(harici(api, sur, '2026-09')[1]).toEqual(['2026-09-02', 0, 5]);
  });
  it('aynı gün iki görev: 1. görev çıkış KM → 2. görev giriş KM sırasıyla karşılaştırılır; farklı araçlar ayrı izlenir', async () => {
    const { api, arac, arac2, sur } = await kur();
    api.gunKaydet(sur, '2026-09-05', gun(), [
      sefer(arac, { km_cikis: 100, km_donus: 130, cikis_saat: '08:00', donus_saat: '19:00', fazla_mesai: 1 }),
      sefer(arac, { km_cikis: 135, km_donus: 170, cikis_saat: '22:00', donus_saat: '05:00', fazla_mesai: 7 }),
      sefer(arac2, { km_cikis: 500, km_donus: 520 }),
    ]);
    const r = harici(api, sur, '2026-09');
    expect(r).toEqual([['2026-09-05', 0, null], ['2026-09-05', 1, 5], ['2026-09-05', 2, null]]);
  });
});

describe('Çift görev: çakışma engeli, görev saatleri saklanır', () => {
  it('çakışan saatler kaydedilmez, çakışmayan iki görev kaydedilir', async () => {
    const { api, arac, sur } = await kur();
    expect(() => api.gunKaydet(sur, '2026-09-06', gun(), [
      sefer(arac, { cikis_saat: '08:00', donus_saat: '20:00' }), sefer(arac, { cikis_saat: '19:00', donus_saat: '23:00' }),
    ])).toThrow(/çakış/);
    expect(api.surucuAyi(sur, '2026-09').seferler.length).toBe(0);
    api.gunKaydet(sur, '2026-09-06', gun({ fazla_mesai: 8 }), [
      sefer(arac, { cikis_saat: '08:00', donus_saat: '19:00', fazla_mesai: 1 }), sefer(arac, { cikis_saat: '22:00', donus_saat: '05:00', fazla_mesai: 7, mesai_mod: 'elle' }),
    ]);
    const a = api.surucuAyi(sur, '2026-09');
    expect(a.seferler.map((x: any) => [x.cikis_saat, x.donus_saat, x.fazla_mesai, x.mesai_mod])).toEqual([['08:00', '19:00', 1, 'oto'], ['22:00', '05:00', 7, 'elle']]);
    expect(a.gunler[0].fazla_mesai).toBe(8);
  });
});

describe('Ortak personel ve görev yeri listeleri', () => {
  it('yazım farkları (büyük/küçük harf, boşluk, Türkçe karakter) tek kayıt olur; birden çok kişi eklenir', async () => {
    expect(adNorm('  Çağlar   ÜNAL ')).toBe('caglar unal');
    expect(adNorm('IŞIK')).toBe('isik');
    expect(adlaraBol('Ali Veli; ali  veli ;Ayşe Kaya;;')).toEqual(['Ali Veli', 'Ayşe Kaya']);
    const { api, arac, sur } = await kur();
    api.gunKaydet(sur, '2026-09-07', gun(), [sefer(arac, { gorevli: 'Çağlar Ünal; Ayşe Kaya', gorev_yeri: 'Torbalı TM' })]);
    api.gunKaydet(sur, '2026-09-08', gun(), [sefer(arac, { gorevli: 'caglar  unal', gorev_yeri: 'TORBALI TM; Bornova' })]);
    const l = api.listeler();
    expect(l.personel.map((x) => x.ad)).toEqual(['Ayşe Kaya', 'Çağlar Ünal']);
    expect(l.personel.find((x) => x.ad === 'Çağlar Ünal')!.kullanim).toBe(2);
    expect(l.yerler.map((x) => x.ad).sort()).toEqual(['Bornova', 'Torbalı TM']);
  });
  it('ad düzeltme geçmiş kayıtlara da işler, birleştirme çalışır, silme geçmişi bozmaz', async () => {
    const { api, arac, sur } = await kur();
    api.gunKaydet(sur, '2026-09-09', gun(), [sefer(arac, { gorevli: 'Mehmet Yilmaz; Ayşe Kaya', gorev_yeri: 'Bornova' })]);
    const mehmet = api.listeler().personel.find((x) => x.ad === 'Mehmet Yilmaz')!;
    api.listeDuzelt('personel', mehmet.id, 'Mehmet Yılmaz');
    expect(api.surucuAyi(sur, '2026-09').seferler[0].gorevli).toBe('Mehmet Yılmaz; Ayşe Kaya');
    // listedeki başka bir adla aynı yapılırsa birleşir
    const ayse = api.listeler().personel.find((x) => x.ad === 'Ayşe Kaya')!;
    const r = api.listeDuzelt('personel', ayse.id, 'MEHMET YILMAZ');
    expect(r.birlesti).toBe(true);
    expect(api.listeler().personel.length).toBe(1);
    // silinen ad geçmiş kayıtta durur
    const yer = api.listeler().yerler[0];
    api.listeSil('yer', yer.id);
    expect(api.listeler().yerler.length).toBe(0);
    expect(api.surucuAyi(sur, '2026-09').seferler[0].gorev_yeri).toBe('Bornova');
  });
});

describe('Yemek ve yol: çalışılan her gün otomatik var (dış görev / konaklama günleri dahil)', () => {
  const g = (o: Partial<SurucuGun>): SurucuGun => ({ driverId: 1, tarih: '2026-09-01', durum: 'X', fazlaMesai: 0, haftaTatili: false, resmiTatil: 0, disGorev: 0, konaklama: false, yemekOverride: null, yolOverride: null, ...o } as SurucuGun);
  const gunler = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'];
  const kayit = [g({ tarih: '2026-09-01' }), g({ tarih: '2026-09-02', disGorev: 1 }), g({ tarih: '2026-09-03', konaklama: true }), g({ tarih: '2026-09-04', durum: 'R' })];
  it('yeni kural: X günlerinin hepsinde yemek ve yol var; rapor günü yok', () => {
    const a = surucuAylik(1, gunler, kayit, { yolHakki: true }, 7.5, true);
    expect([a.yemek, a.yol]).toEqual([3, 3]);
  });
  it('Excel kuralı: dış görev (tam) ve konaklama günlerinde yok', () => {
    const a = surucuAylik(1, gunler, kayit, { yolHakki: true }, 7.5, false);
    expect([a.yemek, a.yol]).toEqual([1, 1]);
  });
  it('elle kaldırılan gün (yemek yok) sayılmaz; günde yalnız bir kez sayılır', () => {
    const k2 = [g({ tarih: '2026-09-01', yemekOverride: false }), g({ tarih: '2026-09-02' })];
    const a = surucuAylik(1, gunler, k2, { yolHakki: true }, 7.5, true);
    expect([a.yemek, a.yol]).toEqual([1, 2]);
  });
});

describe('İki oturum aynı veri dosyasında (ağ klasörü benzetimi)', () => {
  it('aynı ve farklı sürücüye eşzamanlı kayıt: ikisi de korunur; yeni personel/yer listeleri birleşir; harici km oturumlar arası tutarlı', async () => {
    const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gk2-')), 'h.db');
    const a = new Store(dosya); await a.ac(WASM, { kullanici: 'Ali' });
    const b = new Store(dosya); await b.ac(WASM, { kullanici: 'Veli' });
    const A = new Api(a), B = new Api(b);
    const arac = A.aracKaydet({ plaka: '34 TST 036' } as any);
    const s1 = A.surucuKaydet({ ad_soyad: 'Sürücü Bir' } as any);
    const s2 = A.surucuKaydet({ ad_soyad: 'Sürücü İki' } as any);
    b.tazele();
    // aynı anda (karşılıklı tazelemeden) farklı sürücülere kayıt, ikisi de yeni personel ekliyor
    A.gunKaydet(s1, '2026-09-10', gun(), [sefer(arac, { km_cikis: 100, km_donus: 130, gorevli: 'Ali Kaya', gorev_yeri: 'Torbalı' })]);
    B.gunKaydet(s2, '2026-09-11', gun(), [sefer(arac, { km_cikis: 145, km_donus: 160, gorevli: 'Veli Demir', gorev_yeri: 'Bornova' })]);
    a.tazele(); b.tazele();
    for (const X of [A, B]) {
      expect(X.listeler().personel.map((p) => p.ad).sort()).toEqual(['Ali Kaya', 'Veli Demir']);
      expect(X.listeler().yerler.map((p) => p.ad).sort()).toEqual(['Bornova', 'Torbalı']);
    }
    // aynı sürücünün aynı gününe iki kişi yazarsa son yazan kazanır, dosya bozulmaz; harici km zinciri iki oturumda da aynı
    A.gunKaydet(s1, '2026-09-12', gun(), [sefer(arac, { km_cikis: 170, km_donus: 180 })]);
    B.gunKaydet(s1, '2026-09-12', gun({ fazla_mesai: 1 }), [sefer(arac, { km_cikis: 175, km_donus: 190 })]);
    a.tazele();
    const zincir = A.aracAyi(arac, '2026-09').map((x: any) => [x.tarih, x.harici_km]);
    expect(zincir).toEqual([['2026-09-10', null], ['2026-09-11', 15], ['2026-09-12', 15]]);
    expect(A.surucuAyi(s1, '2026-09').gunler.find((x: any) => x.tarih === '2026-09-12').fazla_mesai).toBe(1);
  });
});
