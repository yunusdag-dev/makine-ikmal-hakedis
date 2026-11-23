import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { gunlukKlasoruAyarla, gunlukDosyasi, hataYaz, kullaniciMesaji, maskele } from '../electron/hataGunlugu';

describe('Hata günlüğü ve kullanıcı iletileri', () => {
  it('teknik hatalar anlaşılır iletiye çevrilir, doğrulama iletileri aynen geçer', () => {
    expect(kullaniciMesaji(new Error('NOT NULL constraint failed: surucu_gunleri.fazla_mesai'))).toMatchObject({ teknik: true });
    expect(kullaniciMesaji(new Error('NOT NULL constraint failed: x')).mesaj).not.toMatch(/constraint|SQL/i);
    expect(kullaniciMesaji(new Error("EPERM: operation not permitted, rename 'x'")).mesaj).toMatch(/izni/);
    expect(kullaniciMesaji(new Error('ENOSPC: no space left')).mesaj).toMatch(/Diskte yer/);
    expect(kullaniciMesaji(new Error('Fazla mesai 0 ile 24 arasında olmalı (girilen: 99).'))).toEqual({ mesaj: 'Fazla mesai 0 ile 24 arasında olmalı (girilen: 99).', teknik: false });
    expect(kullaniciMesaji(new Error('Kullanıcı adı veya şifre hatalı.')).teknik).toBe(false);
  });

  it('günlüğe yazılır, gizli bilgi maskelenir, boyut aşılınca döndürülür', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'log-'));
    gunlukKlasoruAyarla(d);
    hataYaz('test', new Error('T.C. 12345678901 ve ali@kurum.gov.tr ile hata'));
    const ic = fs.readFileSync(gunlukDosyasi(), 'utf8');
    expect(ic).toMatch(/test: /); expect(ic).not.toMatch(/12345678901/); expect(ic).not.toMatch(/ali@kurum/);
    fs.writeFileSync(gunlukDosyasi(), 'x'.repeat(1024 * 1024 + 10));
    hataYaz('test', new Error('yeni'));
    expect(fs.existsSync(gunlukDosyasi() + '.1')).toBe(true);
    expect(fs.statSync(gunlukDosyasi()).size).toBeLessThan(2000);
    expect(maskele('no 12345678901')).toBe('no ***********');
  });
});
