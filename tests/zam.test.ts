import { describe, it, expect } from 'vitest';
import { VARSAYILAN_PARAMS } from '../src/engine/params';
import { zamUygula, ZAM_GRUPLARI } from '../src/engine/zam';

const tum = ZAM_GRUPLARI.map((g) => g.anahtar);

describe('Toplu zam', () => {
  it('%35 zam: seçilen tutarlar kuruşa yuvarlanarak artar, girdi değişmez', () => {
    const kopya = JSON.stringify(VARSAYILAN_PARAMS);
    const { params, degisimler } = zamUygula(VARSAYILAN_PARAMS, 35, ['ucret']);
    expect(JSON.stringify(VARSAYILAN_PARAMS)).toBe(kopya);
    expect(params.ucret.surucu.ucretBrut).toBe(101565.39); // 75233.62 × 1,35
    expect(params.ucret.operator.ucretBrut).toBe(118781.79); // 87986.51 × 1,35 = 118781.7885
    expect(degisimler).toHaveLength(4);
    // seçilmeyen gruplar aynı kalır
    expect(params.ucret.surucu.yemek).toBe(337.5);
    expect(params.bordro.asgariUcretBrut).toBe(33030);
  });

  it('tüm gruplar: yalnız tutar alanları değişir; oran, çarpan, gün sayısı, vergi ve kesinti asla değişmez', () => {
    const { params } = zamUygula(VARSAYILAN_PARAMS, 40, tum);
    expect(params.ucret.surucu.yemek).toBe(472.5); expect(params.ucret.surucu.yol).toBe(572.25);
    expect(params.bordro.yemekGunluk).toBe(462.42); expect(params.bordro.asgariUcretBrut).toBe(46242);
    expect(params.epdkYakitFiyati).toBe(90.32916); // 64.52083 × 1,4 = 90.329162 → EPDK 5 hane
  });

  it('indirim, sıfır ve geçersiz oran', () => {
    expect(zamUygula(VARSAYILAN_PARAMS, -10, ['yemekyol']).params.ucret.surucu.yemek).toBe(303.75);
    const sifir = zamUygula(VARSAYILAN_PARAMS, 0, tum);
    expect(sifir.degisimler).toHaveLength(0); expect(sifir.params).toEqual(VARSAYILAN_PARAMS);
    expect(() => zamUygula(VARSAYILAN_PARAMS, NaN, tum)).toThrow(/Zam oranı/);
    expect(() => zamUygula(VARSAYILAN_PARAMS, -100, tum)).toThrow(/Zam oranı/);
  });

  it('oran, çarpan, vergi, gün sayısı ve kesinti alanlarına dokunmaz', () => {
    const { params } = zamUygula(VARSAYILAN_PARAMS, 50, tum);
    const a = VARSAYILAN_PARAMS;
    expect(params.vergi).toEqual(a.vergi);
    expect(params.bordro.carpanSurucu).toBe(a.bordro.carpanSurucu); expect(params.bordro.sgkIsci).toBe(a.bordro.sgkIsci); expect(params.bordro.gvDilimleri).toEqual(a.bordro.gvDilimleri);
    expect(params.ucret.surucu.ucretKesinti).toBe(a.ucret.surucu.ucretKesinti);
    expect(params.ucret.yemekYolDusumGun).toBe(22); expect(params.fiyatFarki.a1).toBe(a.fiyatFarki.a1); expect(params.takvim).toEqual(a.takvim);
  });
});
