import { describe, it, expect } from 'vitest';
import { gorevMesai, gorevCakismasi, gorevSuresi, saatDk, gorevAraligi } from '../src/engine/mesai';

describe('Fazla mesai: 18:00 sonrası, 45 dk kuralı, gece yarısı', () => {
  it('örnek bitiş saatleri (otomatik)', () => {
    expect(gorevMesai('08:00', '17:59')).toBe(0);
    expect(gorevMesai('08:00', '18:00')).toBe(0);
    expect(gorevMesai('08:00', '19:00')).toBe(1);
    expect(gorevMesai('08:00', '20:30')).toBe(2);       // 30 dk artan -> atılır
    expect(gorevMesai('08:00', '19:45')).toBe(1);       // tam 45 dk -> 45'i aşmıyor
    expect(gorevMesai('08:00', '19:46')).toBe(2);       // 46 dk -> yukarı
    expect(gorevMesai('08:00', '21:50')).toBe(4);       // 3 saat 50 dk -> 4
  });
  it('gece yarısını geçen görev ertesi güne sarkar (22:00 → 05:00 = 7 saat)', () => {
    expect(gorevAraligi('22:00', '05:00')).toEqual([1320, 1740]);
    expect(gorevSuresi('22:00', '05:00')).toBe(7);
    expect(gorevMesai('22:00', '05:00')).toBe(7);
    expect(gorevMesai('08:00', '02:00')).toBe(8);       // 18:00 → 02:00
  });
  it('elle seçilebilir yuvarlama: yukarı / aşağı / elle', () => {
    expect(gorevMesai('08:00', '19:10', 'yukari')).toBe(2);
    expect(gorevMesai('08:00', '19:50', 'asagi')).toBe(1);
    expect(gorevMesai('08:00', '19:50', 'elle')).toBeNull();
  });
  it('eksik veya geçersiz saat hesaplanmaz', () => {
    expect(gorevMesai('', '19:00')).toBeNull();
    expect(gorevMesai('08:00', '25:00')).toBeNull();
    expect(gorevMesai('19:00', '19:00')).toBeNull();
    expect(saatDk('9:05')).toBe(545);
  });
  it('çift görev: 1. görev 19:00\'a kadar + 2. görev 22:00 → 05:00; çakışma yok, mesai toplamı 8', () => {
    const g = [{ cikis_saat: '08:00', donus_saat: '19:00' }, { cikis_saat: '22:00', donus_saat: '05:00' }];
    expect(gorevCakismasi(g)).toBeNull();
    expect(gorevMesai(g[0].cikis_saat, g[0].donus_saat)! + gorevMesai(g[1].cikis_saat, g[1].donus_saat)!).toBe(8);
  });
  it('çakışan görevler yakalanır', () => {
    expect(gorevCakismasi([{ cikis_saat: '08:00', donus_saat: '20:00' }, { cikis_saat: '19:00', donus_saat: '23:00' }])).toEqual([0, 1]);
    expect(gorevCakismasi([{ cikis_saat: '22:00', donus_saat: '05:00' }, { cikis_saat: '23:00', donus_saat: '23:30' }])).not.toBeNull();
    expect(gorevCakismasi([{ cikis_saat: '22:00', donus_saat: '05:00' }, { cikis_saat: '03:00', donus_saat: '04:00' }])).toBeNull(); // 03:00 aynı günün sabahı, geceki görevle çakışmaz
    expect(gorevCakismasi([{ cikis_saat: '08:00', donus_saat: '12:00' }, { cikis_saat: '12:00', donus_saat: '14:00' }])).toBeNull(); // bitişik, çakışmaz
  });
});
