import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { tohumdanOlustur } from '../electron/tohum';
import { Store } from '../electron/store'; import { Api } from '../electron/api'; import { Kimlik } from '../electron/auth';

const WASM = path.resolve('node_modules/sql.js/dist');
const TOHUM = path.resolve('hazir-veri', 'hakedis.db');

describe('Hazır başlangıç verisi', () => {
  it('dosya yoksa kopyalanır, varsa dokunulmaz', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tohum-'));
    const t = path.join(d, 'tohum.db'); fs.writeFileSync(t, 'x');
    const h = path.join(d, 'alt', 'hakedis.db');
    expect(tohumdanOlustur(h, t)).toBe(true);
    expect(fs.readFileSync(h, 'utf8')).toBe('x');
    fs.writeFileSync(h, 'mevcut');
    expect(tohumdanOlustur(h, t)).toBe(false);
    expect(fs.readFileSync(h, 'utf8')).toBe('mevcut');
    expect(tohumdanOlustur(path.join(d, 'y.db'), path.join(d, 'yok.db'))).toBe(false);
    expect(fs.readdirSync(d).some((f) => f.includes('.tohum-'))).toBe(false);
  });

  (fs.existsSync(TOHUM) ? it : it.skip)('hazır veri: 41 araç/sürücü eşleşmiş, hesap ve puantaj yok; ilk yönetici kurulabilir', async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tohum-')); const h = path.join(d, 'hakedis.db');
    expect(tohumdanOlustur(h, TOHUM)).toBe(true);
    const s = new Store(h); await s.ac(WASM); const api = new Api(s); const k = new Kimlik(s);
    expect(api.araclar().length).toBe(41);
    expect(api.suruculer().length).toBe(41);
    const at = api.atamalar();
    expect(at.length).toBe(41);
    expect(new Set(at.map((a) => a.arac_id)).size).toBe(41);
    expect(api.tatiller(2026).length).toBeGreaterThan(10);
    expect(k.kurulumGerekli()).toBe(true);                       // hesap yok: ilk açılışta yönetici oluşturulur
    expect(api.istatistik().gunKaydi).toBe(0);                   // puantaj yok
    expect(api.hesapla('2026-08').veriYok).toBe(true);
    k.ilkKurulum({ kullaniciAdi: 'admin', ad: 'Yönetici', sifre: 'sifre1' });
    expect(k.giris('admin', 'sifre1').rol).toBe('yonetici');
    // parametreler: Ağustos 2026 değerleri en baştan geçerli
    expect(api.parametreler('2026-03').ucret.surucu.yemek).toBe(337.5);
    s.kapat();
  });
});
