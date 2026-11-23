import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api'; import { excelIceAktar } from '../electron/importDb';
import { KURUM_DOSYA, FIRMA_DOSYA, ornekVar } from './helpers';

const WASM = path.resolve('node_modules/sql.js/dist');
const d = ornekVar ? describe : describe.skip;

d('Dönem bazlı sürücü-araç ataması', () => {
  it('geçmiş değişmez, gelecek ay yeni araçla açılır, kapalı dönem korunur, eski veritabanı geçişi', async () => {
    const dosya = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atama-')), 'h.db');
    let s = new Store(dosya); await s.ac(WASM, { kullanici: 'T' });
    let api = new Api(s);
    await excelIceAktar(s, KURUM_DOSYA, FIRMA_DOSYA, api.parametreler('2026-08'));
    const sur = api.suruculer().find((x) => x.ad_soyad.includes('SOYAD'))!;
    const eski = api.araclar().find((a) => a.plaka === '34 TST 016')!;
    const yeni = api.araclar().find((a) => a.plaka === '34 TST 024')!;
    // her araç tam bir sürücüde, her sürücünün tam bir aracı var
    const at = api.atamalar();
    expect(at.length).toBe(41);
    expect(new Set(at.map((x) => x.arac_id)).size).toBe(41);
    const ocak = api.donemVerisi('2026-08').suruculer.find((x) => x.id === sur.id)!;
    expect(ocak.varsayilanAracId).toBe(eski.id);
    const once = api.hesapla('2026-08').firma.fatura.faturaToplami;
    expect(once).toBeCloseTo(6728986.13, 2);

    // Ekim ayından itibaren başka araç
    api.atamaKaydet(sur.id, '2026-10', yeni.id);
    const arac = (ay: string) => api.donemVerisi(ay).suruculer.find((x) => x.id === sur.id)!.varsayilanAracId;
    expect(arac('2026-08')).toBe(eski.id);
    expect(arac('2026-09')).toBe(eski.id);
    expect(arac('2026-10')).toBe(yeni.id);
    expect(arac('2027-03')).toBe(yeni.id);
    expect(api.hesapla('2026-08').firma.fatura.faturaToplami).toBe(once);   // geçmiş ay aynı
    expect(api.suruculer().find((x) => x.id === sur.id)!.varsayilan_arac_id).toBe(yeni.id); // güncel
    // Ekimde eski araç sürücüsüz kalır -> bilgi uyarısı
    api.gunKaydet(sur.id, '2026-10-01', { durum: 'X' }, [{ arac_id: yeni.id, arac_ig: 1 }]);
    expect(api.hesapla('2026-10').uyarilar.some((u) => u.mesaj.includes('34 TST 016') && u.mesaj.includes('atanmamış'))).toBe(true);

    // kapalı dönemi etkileyen atama reddedilir
    api.donemKapat('2026-08');
    expect(() => api.atamaKaydet(sur.id, '2026-08', yeni.id)).toThrow(/kapalı/);
    expect(arac('2026-08')).toBe(eski.id);
    // atama silme: Ekim ataması silinince eski araç döner; son kayıt silinemez
    const ekim = api.atamalar().find((x) => x.surucu_id === sur.id && x.baslangic === '2026-10')!;
    api.atamaSil(ekim.id);
    expect(arac('2026-10')).toBe(eski.id);
    expect(() => api.atamaSil(api.atamalar().find((x) => x.surucu_id === sur.id)!.id)).toThrow(/en az bir/);

    // v2 -> v3 geçişi: tablo yokken açılışta mevcut eşleşmelerden yeniden kurulur
    s.tx(() => { s.db.run('DROP TABLE surucu_arac_atamalari'); s.db.run('PRAGMA user_version = 2'); });
    s.kapat();
    s = new Store(dosya); await s.ac(WASM, { kullanici: 'T' }); api = new Api(s);
    expect(api.atamalar().length).toBe(41);
    expect(api.donemVerisi('2026-08').suruculer.find((x) => x.id === sur.id)!.varsayilanAracId).toBe(eski.id);
    s.kapat();
  });
});
