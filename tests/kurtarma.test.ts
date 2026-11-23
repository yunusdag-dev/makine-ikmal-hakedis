import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { bozukKurtarUygula, kurtarmaIzniOlustur } from '../electron/kurtarma';
import { Store, dosyaButunMu } from '../electron/store';

const WASM = path.resolve('node_modules/sql.js/dist');

describe('Bozuk veritabanı kurtarma yetkisi', () => {
  it('yalnız bozuk bulunan dosya ve listelenen, sağlam yedekle değiştirilir', async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kur-'));
    const db = path.join(d, 'hakedis.db');
    const s = new Store(path.join(d, 'saglam.db')); await s.ac(WASM, { kullanici: 't' }); s.kapat();
    const saglam = path.join(d, 'saglam.db'); const bozukYedek = path.join(d, 'bozuk-yedek.db'); const baska = path.join(d, 'baska.db');
    fs.writeFileSync(db, 'BOZUK DOSYA'); fs.writeFileSync(bozukYedek, 'bozuk'); fs.copyFileSync(saglam, baska);
    expect(dosyaButunMu(saglam)).toBe(true); expect(dosyaButunMu(bozukYedek)).toBe(false); expect(dosyaButunMu(db)).toBe(false);

    const izin = kurtarmaIzniOlustur(db, [saglam, bozukYedek]);
    expect(() => bozukKurtarUygula(null, db, saglam, dosyaButunMu)).toThrow(/yetkisi yok/);
    expect(() => bozukKurtarUygula(izin, path.join(d, 'baska-hedef.db'), saglam, dosyaButunMu)).toThrow(/bozuk bulunan/);
    expect(() => bozukKurtarUygula(izin, db, baska, dosyaButunMu)).toThrow(/listesindeki/);
    expect(() => bozukKurtarUygula(izin, db, bozukYedek, dosyaButunMu)).toThrow(/da bozuk/);
    expect(fs.readFileSync(db, 'utf8')).toBe('BOZUK DOSYA'); // reddedilen girişimler hiçbir şeyi değiştirmedi

    const r = bozukKurtarUygula(izin, db, saglam, dosyaButunMu);
    expect(dosyaButunMu(db)).toBe(true);
    expect(fs.readFileSync(r.bozukDosya, 'utf8')).toBe('BOZUK DOSYA'); // bozuk dosya silinmeden saklandı
  });
});
