import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api'; import { excelIceAktar } from '../electron/importDb';
import { KURUM_DOSYA, FIRMA_DOSYA, ornekVar } from './helpers';

const d = ornekVar ? describe : describe.skip;
d('Puantajı girilmemiş ay', () => {
  it('tüm tutarlar sıfır; dolu ay etkilenmez; boş ay kapatılamaz', async () => {
    const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bos-')), 'h.db');
    const s = new Store(dosya); await s.ac(path.resolve('node_modules/sql.js/dist'), { kullanici: 'T' });
    const api = new Api(s);
    await excelIceAktar(s, KURUM_DOSYA, FIRMA_DOSYA, api.parametreler('2026-08'));
    const dolu = api.hesapla('2026-08');
    expect(dolu.veriYok).toBe(false);
    expect(dolu.firma.fatura.faturaToplami).toBeCloseTo(6728986.13, 2);
    for (const ay of ['2026-07', '2026-09', '2027-01']) {
      const r = api.hesapla(ay);
      expect(r.veriYok).toBe(true);
      expect(r.giris.length).toBe(0);
      expect(r.firma.fatura.faturaToplami).toBe(0);
      expect(r.firma.onTabloToplam.I).toBe(0);
      expect(r.firma.onTabloToplam.N).toBe(0);
      expect(r.firma.bordroToplam).toBe(0);
    }
    expect(() => api.donemKapat('2026-09')).toThrow(/puantaj girilmemiş/);
    // Eylül'e tek günlük puantaj girilince hesap başlar
    const sid = api.suruculer()[0].id; const aid = api.araclar()[0].id;
    api.gunKaydet(sid, '2026-09-01', { durum: 'X' }, [{ arac_id: aid, arac_ig: 1 }]);
    expect(api.hesapla('2026-09').veriYok).toBe(false);
    expect(api.hesapla('2026-09').firma.fatura.faturaToplami).toBeGreaterThan(0);
    s.kapat();
  });
});
