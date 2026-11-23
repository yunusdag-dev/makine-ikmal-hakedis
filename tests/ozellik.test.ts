import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api';
import { excelIceAktar } from '../electron/importDb';
import { ornekVar, KURUM_DOSYA, FIRMA_DOSYA } from './helpers';
import { VARSAYILAN_PARAMS } from '../src/engine/params';
import { etkinParams } from '../src/engine/ozellik';
import { donemHesapla } from '../src/engine/donem';

const WASM = path.resolve('node_modules/sql.js/dist');

describe('Özellik anahtarları (birim)', () => {
  it('kapalı kalemlerin birim ücretleri sıfırlanır, saklanan değerler ve diğer kalemler değişmez', () => {
    const p = JSON.parse(JSON.stringify(VARSAYILAN_PARAMS));
    p.ozellikler.yemek = false; p.ozellikler.fazlaMesai = false;
    const e = etkinParams(p);
    for (const t of [e.ucret.surucu, e.ucret.operator, e.ucret.ffSurucu, e.ucret.ffOperator]) { expect(t.yemek).toBe(0); expect(t.fazlaCalisma).toBe(0); expect(t.yol).toBeGreaterThan(0); }
    expect(e.bordro.yemekGunluk).toBe(0); expect(e.bordro.yemekIstisnaGunluk).toBe(0); expect(e.bordro.yolGunluk).toBeGreaterThan(0);
    expect(p.ucret.surucu.yemek).toBe(337.5); // ham değer silinmez
    expect(etkinParams(VARSAYILAN_PARAMS)).toEqual(VARSAYILAN_PARAMS); // hepsi açıkken aynen
  });
});

const d = ornekVar ? describe : describe.skip;
d('Özellik anahtarları (Ağustos 2026 verisiyle)', () => {
  let api: Api; let store: Store;
  beforeAll(async () => {
    store = new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'oz-')), 'h.db'));
    await store.ac(WASM, { kullanici: 't' }); store.rol = 'yonetici';
    api = new Api(store);
    await excelIceAktar(store, KURUM_DOSYA, FIRMA_DOSYA, api.parametreler('2026-08'));
  });
  const topla = (s: any, k: string) => s.giris.reduce((t: number, g: any) => t + (g[k] ?? 0), 0);
  const tutar = (s: any) => JSON.stringify(s.firma.surucuFaaliyet.map((x: any) => x.AC_gvmYillik));

  it('her kalem kapatılınca ilgili miktar/tutar sıfırlanır; açılınca tam geri gelir; diğer aylar etkilenmez', () => {
    const ham = api.parametreSurumu(api.parametreSurumleri()[0].id)!;
    const temel = api.hesapla('2026-08');
    const kalemler = ['fazlaMesai', 'haftaTatili', 'resmiTatil', 'disGorev', 'konaklama', 'yemek', 'yol'];
    const alan: Record<string, string> = { fazlaMesai: 'fazlaMesai', haftaTatili: 'haftaTatili', resmiTatil: 'resmiTatil', disGorev: 'disGorev', konaklama: 'konaklama', yemek: 'yemek', yol: 'yol' };
    for (const k of kalemler) expect(topla(temel, alan[k]), `${k} temelde 0 değil olmalı`).toBeGreaterThan(0);

    for (const k of kalemler) {
      const p = JSON.parse(JSON.stringify(ham.veri)); p.ozellikler[k] = false;
      api.parametreKaydet('2026-08', p, `${k} kapalı`);
      const s = api.hesapla('2026-08');
      expect(topla(s, alan[k]), `${k} kapalıyken miktar`).toBe(0);
      for (const diger of kalemler.filter((x) => x !== k)) expect(topla(s, alan[diger]), `${k} kapalıyken ${diger} değişmemeli`).toBe(topla(temel, alan[diger]));
    }
    // hepsi açık haline dönülünce temel sonuçla birebir aynı
    api.parametreKaydet('2026-08', ham.veri, 'geri');
    const geri = api.hesapla('2026-08');
    expect(tutar(geri)).toBe(tutar(temel));
    expect(JSON.stringify(geri.firma)).toBe(JSON.stringify(temel.firma));
  });

  it('yemek kapalı: tutarlar düşer; yeni sürüm yalnız belirtilen aydan itibaren geçerli olur', () => {
    const ham = api.parametreSurumu(api.parametreSurumleri()[0].id)!;
    const once = JSON.stringify(api.hesapla('2026-08').firma);
    const p = JSON.parse(JSON.stringify(ham.veri)); p.ozellikler.yemek = false;
    api.parametreKaydet('2026-09', p, 'Eylülden itibaren yemek yok');
    expect(JSON.stringify(api.hesapla('2026-08').firma)).toBe(once); // Ağustos aynı
    expect(api.parametreler('2026-09').ucret.surucu.yemek).toBe(0);
    expect(api.parametreler('2026-08').ucret.surucu.yemek).toBe(337.5);
    // donemHesapla doğrudan ham parametreyle çağrılsa da anahtarlar uygulanır (UI tarafı da aynı sonucu görür)
    const v = api.donemVerisi('2026-08'); v.params = p;
    expect(v.params.ozellikler.yemek).toBe(false);
    expect(donemHesapla(v).giris.reduce((t, g) => t + g.yemek, 0)).toBe(0);
  });
});
