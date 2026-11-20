import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store';
import { SCHEMA_VERSION } from '../electron/schema';

const WASM = path.resolve('node_modules/sql.js/dist');
const yeniDizin = () => fs.mkdtempSync(path.join(os.tmpdir(), 'koruma-'));

describe('Sürüm koruması, yükseltme yedeği, kayıt budama', () => {
  it('daha yeni şemalı veritabanını eski uygulama açmaz ve dosyaya dokunmaz', async () => {
    const h = path.join(yeniDizin(), 'hakedis.db');
    const s = new Store(h); await s.ac(WASM, { kullanici: 't' });
    s.tx(() => s.db.run(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`));
    s.kapat();
    const once = fs.readFileSync(h);
    const s2 = new Store(h);
    await expect(s2.ac(WASM, { kullanici: 't' })).rejects.toThrow(/daha yeni bir uygulama sürümüyle/);
    expect(fs.readFileSync(h).equals(once)).toBe(true);
  });

  it('eski şemalı dosya yükseltilmeden önce yedeklenir; yedek temizlikte silinmez', async () => {
    const d = yeniDizin(); const h = path.join(d, 'hakedis.db');
    const s = new Store(h); await s.ac(WASM, { kullanici: 't' });
    s.tx(() => s.db.run('PRAGMA user_version = 2'));
    s.kapat();
    const s2 = new Store(h); await s2.ac(WASM, { kullanici: 't' });
    const y = s2.yedekler().filter((x) => x.ad.includes('yukseltme-oncesi'));
    expect(y.length).toBe(1);
    s2.kapat();
  });

  it('12 aydan eski değişiklik kaydının önce/sonra ayrıntısı silinir, özeti kalır; günde bir kez', async () => {
    const h = path.join(yeniDizin(), 'hakedis.db');
    const s = new Store(h); await s.ac(WASM, { kullanici: 't' });
    s.tx(() => {
      s.run("INSERT INTO degisiklik_kaydi (zaman,kullanici,makine,islem,varlik,ozet,once,sonra) VALUES ('2020-01-01 10:00:00','a','m','x','v','eski','{\"a\":1}','{\"a\":2}')");
      s.run("INSERT INTO degisiklik_kaydi (zaman,kullanici,makine,islem,varlik,ozet,once,sonra) VALUES (datetime('now','localtime'),'a','m','x','v','yeni','{\"a\":1}','{\"a\":2}')");
    });
    expect(s.kayitBudama()).toBe(1);
    const eski = s.get<any>("SELECT * FROM degisiklik_kaydi WHERE ozet='eski'");
    expect(eski.once).toBeNull(); expect(eski.sonra).toBeNull();
    expect(s.get<any>("SELECT * FROM degisiklik_kaydi WHERE ozet='yeni'").once).toBe('{"a":1}');
    expect(s.kayitBudama()).toBe(0);
    s.kapat();
  });
});
