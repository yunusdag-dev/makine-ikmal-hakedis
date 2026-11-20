import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api';
import { tcMaske } from '../electron/dogrulama';

const WASM = path.resolve('node_modules/sql.js/dist');

describe('T.C. kimlik no: varsayılan maskeli, istenince gösterilir', () => {
  it('liste maskeli; "göster" tam değeri verir ve kayda geçer; değişiklik kaydında tam T.C. yok', async () => {
    const h = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tc-')), 'h.db');
    const s = new Store(h); await s.ac(WASM, { kullanici: 'Ayşe' }); s.rol = 'kullanici';
    const api = new Api(s);
    expect(tcMaske('12345678901')).toBe('*********01');
    expect(tcMaske('')).toBe('');

    const id = api.surucuKaydet({ ad_soyad: 'Ali Veli', tc_no: '12345678901', telefon: '0532' } as any);
    // liste maskeli
    const satir = api.suruculer().find((x) => x.id === id)!;
    expect(satir.tc_no).toBe('*********01');
    // veritabanında gerçek değer saklı
    expect(s.get<any>('SELECT tc_no FROM suruculer WHERE id=?', [id]).tc_no).toBe('12345678901');
    // gösterme: tam değer + denetim kaydı
    expect(api.surucuTcGoster(id)).toBe('12345678901');
    const k = s.get<any>("SELECT * FROM degisiklik_kaydi WHERE islem='T.C. görüntüle'");
    expect(k.kullanici).toBe('Ayşe'); expect(k.ozet).toMatch(/Ali Veli/); expect(k.ozet).not.toMatch(/12345678901/);
    // maskeli haliyle kaydedince gerçek değer korunur
    api.surucuKaydet({ ...satir, notlar: 'güncel' } as any);
    expect(s.get<any>('SELECT tc_no, notlar FROM suruculer WHERE id=?', [id])).toMatchObject({ tc_no: '12345678901', notlar: 'güncel' });
    // yeni değer girilince değişir; boş girilince silinir
    api.surucuKaydet({ ...satir, tc_no: '10987654321' } as any);
    expect(api.surucuTcGoster(id)).toBe('10987654321');
    api.surucuKaydet({ ...satir, tc_no: '' } as any);
    expect(api.surucuTcGoster(id)).toBe('');
    // değişiklik kaydında hiçbir yerde tam T.C. yok
    const tum = s.all<any>('SELECT ozet, once, sonra FROM degisiklik_kaydi').map((r) => `${r.ozet}${r.once}${r.sonra}`).join('|');
    expect(tum).not.toMatch(/12345678901|10987654321/);
    // izleyici göremez
    s.rol = 'izleyici';
    expect(() => api.surucuTcGoster(id)).toThrow(/yetki/);
    s.kapat();
  });
});
