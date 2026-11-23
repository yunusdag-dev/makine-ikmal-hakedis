import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api'; import { excelIceAktar } from '../electron/importDb';
import { KURUM_DOSYA, FIRMA_DOSYA, ornekVar } from './helpers';

const WASM = path.resolve('node_modules/sql.js/dist');
const d = ornekVar ? describe : describe.skip;

d('Bireysel düzenleme: geçmiş günü değiştir / sil, hakediş yeniden hesaplansın', () => {
  it('17 Ağustos kaydı düzenlenince toplamlar değişir, eski haline dönünce Excel tutarına geri gelir; değişiklik kaydı tutulur; kapalı dönem korunur', async () => {
    const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-')), 'h.db');
    const s = new Store(dosya); await s.ac(WASM, { kullanici: 'Test' });
    const api = new Api(s);
    await excelIceAktar(s, KURUM_DOSYA, FIRMA_DOSYA, api.parametreler('2026-08'));
    const toplam = () => api.hesapla('2026-08').firma.fatura.faturaToplami;
    const baslangic = toplam();
    expect(baslangic).toBeCloseTo(6728986.13, 2);

    // çalıştığı bir günü olan sürücüyü bul
    let sid = 0; let gun: any = null; let seferler: any[] = [];
    for (const su of api.suruculer()) {
      const a = api.surucuAyi(su.id, '2026-08');
      const g = a.gunler.find((x: any) => x.tarih === '2026-08-17' && x.durum === 'X');
      if (g) { sid = su.id; gun = g; seferler = a.seferler.filter((x: any) => x.tarih === '2026-08-17'); break; }
    }
    expect(sid).toBeGreaterThan(0);

    // düzenle: +3 saat fazla mesai (bugünün tarihi ne olursa olsun geçmiş gün değişir)
    api.gunKaydet(sid, '2026-08-17', { ...gun, fazla_mesai: (gun.fazla_mesai || 0) + 3 }, seferler);
    const duzenli = toplam();
    expect(duzenli).toBeGreaterThan(baslangic);
    expect(api.surucuAyi(sid, '2026-08').gunler.find((x: any) => x.tarih === '2026-08-17').fazla_mesai).toBe((gun.fazla_mesai || 0) + 3);

    // değişiklik kaydı: kim, ne zaman, eski → yeni
    const kayit = api.kayitlar({ arama: '2026-08-17', limit: 20 }).find((x: any) => x.varlik_id === `${sid}/2026-08-17`);
    expect(kayit?.kullanici).toBe('Test');
    const det = api.kayitDetay(kayit.id);
    expect(JSON.parse(det.once).gun.fazla_mesai).toBe(gun.fazla_mesai);
    expect(JSON.parse(det.sonra).gun.fazla_mesai).toBe((gun.fazla_mesai || 0) + 3);

    // eski haline döndür -> Excel tutarı geri gelir
    api.gunKaydet(sid, '2026-08-17', gun, seferler);
    expect(toplam()).toBeCloseTo(baslangic, 2);

    // sil: gün ve araç satırları kalkar, toplam düşer; yeniden girince geri gelir
    api.gunKaydet(sid, '2026-08-17', {}, []);
    const a2 = api.surucuAyi(sid, '2026-08');
    expect(a2.gunler.some((x: any) => x.tarih === '2026-08-17')).toBe(false);
    expect(a2.seferler.some((x: any) => x.tarih === '2026-08-17')).toBe(false);
    expect(toplam()).toBeLessThan(baslangic);
    api.gunKaydet(sid, '2026-08-17', gun, seferler);
    expect(toplam()).toBeCloseTo(baslangic, 2);

    // kapalı dönem değiştirilemez
    api.donemKapat('2026-08');
    expect(() => api.gunKaydet(sid, '2026-08-17', { ...gun, fazla_mesai: 9 }, seferler)).toThrow();
    expect(toplam()).toBeCloseTo(baslangic, 2);
  });
});
