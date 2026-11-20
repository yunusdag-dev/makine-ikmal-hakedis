import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api';

const WASM = path.resolve('node_modules/sql.js/dist');

describe('Sunucu tarafı girdi doğrulaması', () => {
  it('geçersiz değerler reddedilir, geçerli değerler kabul edilir', async () => {
    const h = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dog-')), 'h.db');
    const s = new Store(h); await s.ac(WASM, { kullanici: 't' }); s.rol = 'yonetici';
    const api = new Api(s);
    const sid = api.surucuKaydet({ ad_soyad: 'Test Sürücü' } as any);
    const arac = api.aracKaydet({ plaka: '06 TST 01' } as any);
    const gun = (t: string, g: any, sef: any[] = []) => () => api.gunKaydet(sid, t, g, sef);

    // geçersiz
    expect(gun('abc', { durum: 'X' })).toThrow(/tarih/i);
    expect(gun('2026-02-31', { durum: 'X' })).toThrow(/tarih/i);
    expect(gun('2026-08-03', { durum: 'X', fazla_mesai: -5 })).toThrow(/mesai/i);
    expect(gun('2026-08-03', { durum: 'X', fazla_mesai: 99 })).toThrow(/mesai/i);
    expect(gun('2026-08-03', { durum: 'X', fazla_mesai: 'abc' })).toThrow(/mesai/i);
    expect(gun('2026-08-03', { durum: 'ZZZ' })).toThrow(/durum/i);
    expect(gun('2026-08-03', { durum: 'X', cikis_saat: '25:99' })).toThrow(/saat/i);
    expect(gun('2026-08-03', { durum: 'X', dis_gorev: 3 })).toThrow(/dış görev/i);
    expect(gun('2026-08-03', { durum: 'X' }, [{ arac_id: arac, km_cikis: 500, km_donus: 100 }])).toThrow(/KM/);
    expect(gun('2026-08-03', { durum: 'X' }, [{ arac_id: arac, km_cikis: -5, km_donus: 10 }])).toThrow(/KM/);
    expect(gun('2026-08-03', { durum: 'X' }, [{ arac_id: 9999, km_cikis: 1, km_donus: 2 }])).toThrow(/araç/i);
    expect(() => api.aracKaydet({ plaka: '06 TST 02', kira_bedeli: -1000 } as any)).toThrow(/kira/i);
    expect(() => api.aracKaydet({ plaka: '06 TST 03', model_yili: 1800 } as any)).toThrow(/model yılı/i);
    expect(() => api.surucuKaydet({ ad_soyad: 'X Y', tc_no: '123' } as any)).toThrow(/T\.C\./);
    expect(() => api.surucuKaydet({ ad_soyad: 'X Y', ise_giris: '31.02.2026' } as any)).toThrow(/tarih/i);
    expect(() => api.aracAyKaydet(arac, '2026-13', {})).toThrow(/ay/i);
    expect(() => api.aracAyKaydet(arac, '2026-08', { hizmet_disi_gun: 40 })).toThrow(/gün/i);
    expect(() => api.surucuAyKaydet(sid, '2026-08', { calisma_ayi: 13 })).toThrow(/çalışma ayı/i);
    expect(() => api.ayTopluKaydet(sid, '2026-08', [{ tarih: '2026-09-01', gun: { durum: 'X' }, seferler: [] }], 'x')).toThrow(/tarih/i);

    // hiçbir geçersiz kayıt veritabanına yazılmamış olmalı
    expect(s.get<{ n: number }>('SELECT COUNT(*) n FROM surucu_gunleri')!.n).toBe(0);
    expect(s.get<{ n: number }>('SELECT COUNT(*) n FROM seferler')!.n).toBe(0);

    // geçerli (mevcut davranış korunur)
    expect(gun('2026-08-03', { durum: 'X', fazla_mesai: 2.5, cikis_saat: '08:00', donus_saat: '17:30', dis_gorev: 0.66, resmi_tatil: 0.5 }, [{ arac_id: arac, km_cikis: 100, km_donus: 180.5, arac_igd: 0.5 }])).not.toThrow();
    expect(gun('2026-08-04', { durum: 'Sİ' })).not.toThrow();
    expect(gun('2026-08-05', { durum: '' })).not.toThrow();
    expect(() => api.aracKaydet({ plaka: '06 TST 04', kira_bedeli: 1500.5, model_yili: 2020 } as any)).not.toThrow();
    expect(() => api.surucuKaydet({ ad_soyad: 'Z W', tc_no: '12345678901', ise_giris: '2026-01-05' } as any)).not.toThrow();
    expect(() => api.aracAyKaydet(arac, '2026-08', { hizmet_disi_gun: 2, km_duzeltme: -50 })).not.toThrow();
    expect(() => api.surucuAyKaydet(sid, '2026-08', { calisma_ayi: 8, kumulatif_gvm: 1000 })).not.toThrow();
    s.kapat();
  });
});
