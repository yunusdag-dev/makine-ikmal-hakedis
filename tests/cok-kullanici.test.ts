/**
 * Çok kullanıcılı çalışma ve hesaplar:
 *  - Aynı veritabanı dosyasını açan iki/üç oturum (farklı bilgisayarları temsil eder) birbirinin kaydını ezmez.
 *  - Şifreli giriş, roller, yönetici işlemleri, kurtarma kodu.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../electron/store';
import { Api } from '../electron/api';
import { Kimlik } from '../electron/auth';

const WASM = path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist');

async function oturum(dosya: string, ad: string) {
  const s = new Store(dosya);
  await s.ac(WASM, { kullanici: ad });
  return { s, api: new Api(s), kimlik: new Kimlik(s) };
}

describe('Aynı anda birden çok kullanıcı', () => {
  it('iki oturumun araya giren kayıtları kaybolmaz', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-cok-'));
    const dosya = path.join(dir, 'h.db');
    const A = await oturum(dosya, 'Ali');
    const B = await oturum(dosya, 'Veli');
    const C = await oturum(dosya, 'Ayşe');
    // A araç ekler, B (belleği eski) sürücü ekler, C araç ekler — hepsi kalıcı olmalı
    const a1 = A.api.aracKaydet({ plaka: '34 TST 025', kira_bedeli: 100 });
    B.api.surucuKaydet({ ad_soyad: 'SÜRÜCÜ BİR', varsayilan_arac_id: a1 });
    C.api.aracKaydet({ plaka: '34 TST 026' });
    for (let i = 0; i < 20; i++) {
      [A, B, C][i % 3].api.aracKaydet({ plaka: `34 X ${100 + i}` });
    }
    for (const o of [A, B, C]) o.s.tazele();
    expect(A.api.araclar().length).toBe(22);
    expect(B.api.araclar().length).toBe(22);
    expect(C.api.suruculer().map((s) => s.ad_soyad)).toEqual(['SÜRÜCÜ BİR']);
    // aynı ayın farklı alanlarını iki kişi değiştirir: ikisi de korunur
    A.api.aracAyKaydet(a1, '2026-09', { onceki_km: 1000 });
    B.api.aracAyKaydet(a1, '2026-09', { hizmet_disi_gun: 2 });
    C.s.tazele();
    const row = C.api.aylikGirdiler('2026-09').araclar[0];
    expect(row.onceki_km).toBe(1000);
    expect(row.hizmet_disi_gun).toBe(2);
    // aynı gün, iki sürücüye iki kişi aynı anda puantaj girer
    const s2 = C.api.surucuKaydet({ ad_soyad: 'SÜRÜCÜ İKİ', varsayilan_arac_id: a1 });
    A.api.gunKaydet(1, '2026-09-01', { durum: 'X', fazla_mesai: 2 }, [{ arac_id: a1, km_cikis: 1000, km_donus: 1100, arac_ig: 1 }]);
    B.api.gunKaydet(s2, '2026-09-01', { durum: 'X' }, [{ arac_id: a1, km_cikis: 1100, km_donus: 1150, arac_ig: 1 }]);
    C.s.tazele(); // uygulamada her istekten önce otomatik yapılır
    const son = C.api.hesapla('2026-09');
    expect(son.kurum.find((k) => k.driverId === 1)!.fazlaMesai).toBe(2);
    expect(son.kurum.find((k) => k.vehicleId === a1 && k.aracBirincil)!.hizmetIciKm).toBe(150);
    // sürüm sayacı ve son değiştiren
    const b = C.s.surumBilgisi();
    expect(b.surum).toBeGreaterThan(25);
    expect(b.kim).toBe('Veli');
    // değişiklik kaydında üç kullanıcı da var
    const kisiler = new Set(C.api.kayitlar({ limit: 500 }).map((k: any) => k.kullanici));
    expect([...kisiler].sort()).toEqual(['Ali', 'Ayşe', 'Veli']);
    for (const o of [A, B, C]) o.s.kapat();
  });

  it('terk edilmiş yazma kilidi temizlenir; açık oturumlar listelenir', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-kilit-'));
    const dosya = path.join(dir, 'h.db');
    const A = await oturum(dosya, 'Ali');
    fs.writeFileSync(dosya + '.yazma', JSON.stringify({ kullanici: 'Eski', makine: 'X', token: 'zz', zaman: new Date(Date.now() - 60_000).toISOString() }));
    A.api.aracKaydet({ plaka: '34 TST 027' });
    expect(fs.existsSync(dosya + '.yazma')).toBe(false);
    const B = await oturum(dosya, 'Veli');
    expect(A.s.acikOturumlar().map((o) => o.kullanici).sort()).toEqual(['Ali', 'Veli']);
    B.s.kapat();
    expect(A.s.acikOturumlar().map((o) => o.kullanici)).toEqual(['Ali']);
    A.s.kapat();
  }, 40000);

  it('kilit, bilgisayar saatine değil gözlem süresine göre terk edilmiş sayılır: taze kilit çalınmaz', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-kilit2-'));
    const dosya = path.join(dir, 'h.db');
    const A = await oturum(dosya, 'Ali');
    // yazanın saati çok geri/ileri olsa bile (saat farkı) hemen silinmez; gerçekten terk edilmişse beklemeyle temizlenir
    fs.writeFileSync(dosya + '.yazma', JSON.stringify({ kullanici: 'Başka', makine: 'X', token: 'yy', zaman: new Date(Date.now() + 3600_000).toISOString() }));
    const t0 = Date.now();
    A.api.aracKaydet({ plaka: '34 TST 028' });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(11000); // en az ~12 sn gözlemlendi, saat değeri etkisiz
    expect(fs.existsSync(dosya + '.yazma')).toBe(false);
    A.s.kapat();
  }, 40000);
});

describe('Hesaplar ve yetkiler', () => {
  it('ilk kurulum, giriş, roller, şifre atama, kurtarma', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-hesap-'));
    const dosya = path.join(dir, 'h.db');
    const { s, kimlik } = await oturum(dosya, '');
    expect(kimlik.kurulumGerekli()).toBe(true);
    expect(() => kimlik.ilkKurulum({ kullaniciAdi: 'admin', ad: 'Ana Yönetici', sifre: '123' })).toThrow(/en az 6/);
    const { kurtarmaKodu } = kimlik.ilkKurulum({ kullaniciAdi: 'admin', ad: 'Ana Yönetici', sifre: 'gizli1' });
    expect(kurtarmaKodu).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(kimlik.kurulumGerekli()).toBe(false);
    expect(() => kimlik.giris('admin', 'yanlis1')).toThrow(/hatalı/);
    const g = kimlik.giris('ADMIN', 'gizli1');
    expect(g.rol).toBe('yonetici');
    // ikinci yönetici ve normal kullanıcı, izleyici
    const y2 = kimlik.kaydet({ kullaniciAdi: 'mehmet', ad: 'Mehmet Yönetici', rol: 'yonetici', aktif: true, sifre: 'mehmet1' });
    const k1 = kimlik.kaydet({ kullaniciAdi: 'ayse', ad: 'Ayşe Kullanıcı', rol: 'kullanici', aktif: true, sifre: 'ayse12' });
    kimlik.kaydet({ kullaniciAdi: 'izle', ad: 'İzleyici', rol: 'izleyici', aktif: true, sifre: 'izle12' });
    expect(() => kimlik.kaydet({ kullaniciAdi: 'ayse', ad: 'Başka', rol: 'kullanici', aktif: true, sifre: 'xxxxxx' })).toThrow(/zaten/);
    expect(kimlik.liste().length).toBe(4);
    // yeni kullanıcı ilk girişte şifre değiştirmeli
    const ay = new Kimlik(s);
    const gk = ay.giris('ayse', 'ayse12');
    expect(gk.sifreDegistirmeli).toBe(true);
    expect(() => ay.liste()).toThrow(/yönetici/);
    ay.sifremiDegistir('ayse12', 'yeni123');
    expect(ay.giris('ayse', 'yeni123').sifreDegistirmeli).toBe(false);
    // izleyici yazamaz
    const iz = new Kimlik(s);
    iz.giris('izle', 'izle12');
    expect(() => new Api(s).aracKaydet({ plaka: '34 TST 029' })).toThrow(/izleyici/);
    // bayrak bir şekilde kapansa bile rol kontrolü yazmayı engeller (fail-closed)
    s.saltOkunur = false;
    expect(() => new Api(s).aracKaydet({ plaka: '34 TST 030' })).toThrow(/izleyici/);
    // izleyici kendi şifresini değiştirebilir, sonra yine yazamaz
    iz.sifremiDegistir('izle12', 'izle34');
    expect(s.saltOkunur || s.rol === 'izleyici').toBe(true);
    expect(() => new Api(s).aracKaydet({ plaka: '34 TST 031' })).toThrow(/izleyici/);
    iz.giris('izle', 'izle34');
    // yönetici şifre atar (kurtarma)
    kimlik.giris('mehmet', 'mehmet1');
    kimlik.sifreAta(k1, 'gecici1');
    expect(new Kimlik(s).giris('ayse', 'gecici1').sifreDegistirmeli).toBe(true);
    // son yönetici korunur: admin pasif/yönetici değil yapılabilir çünkü mehmet var; mehmet tek kalınca yapılamaz
    kimlik.giris('admin', 'gizli1');
    kimlik.kaydet({ id: y2, kullaniciAdi: 'mehmet', ad: 'Mehmet Yönetici', rol: 'yonetici', aktif: true });
    const adminId = kimlik.liste().find((k) => k.kullanici_adi === 'admin')!.id;
    kimlik.giris('mehmet', 'mehmet1');
    kimlik.kaydet({ id: adminId, kullaniciAdi: 'admin', ad: 'Ana Yönetici', rol: 'kullanici', aktif: true });
    expect(() => kimlik.kaydet({ id: y2, kullaniciAdi: 'mehmet', ad: 'Mehmet Yönetici', rol: 'kullanici', aktif: true })).toThrow(/En az bir aktif yönetici/);
    // 5 hatalı denemede bekletme
    const k = new Kimlik(s);
    for (let i = 0; i < 5; i++) expect(() => k.giris('izle', 'yanlis')).toThrow();
    expect(() => k.giris('izle', 'izle34')).toThrow(/saniye/);
    // kurtarma kodu ile admin şifresi sıfırlanır ve yönetici yapılır
    expect(() => k.kurtar('AAAA-BBBB-CCCC', 'admin', 'kurtar1')).toThrow(/hatalı/);
    k.kurtar(kurtarmaKodu.toLowerCase(), 'admin', 'kurtar1');
    expect(k.giris('admin', 'kurtar1').rol).toBe('yonetici');
    // şifreler düz metin saklanmaz
    const ham = fs.readFileSync(dosya).toString('latin1');
    expect(ham.includes('kurtar1')).toBe(false);
    expect(ham.includes('gizli1')).toBe(false);
    s.kapat();
  }, 60000);

  it('hatalı giriş ve kurtarma denemesi sınırı veritabanında tutulur (yeniden açılınca sıfırlanmaz)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hakedis-deneme-'));
    const dosya = path.join(dir, 'h.db');
    const { s, kimlik } = await oturum(dosya, '');
    const { kurtarmaKodu } = kimlik.ilkKurulum({ kullaniciAdi: 'admin', ad: 'Ana Yönetici', sifre: 'gizli1' });
    for (let i = 0; i < 5; i++) expect(() => kimlik.giris('admin', 'yanlis')).toThrow(/hatalı/);
    expect(() => kimlik.giris('admin', 'gizli1')).toThrow(/saniye/); // doğru şifre bile bekleme süresince reddedilir
    s.kapat();
    // uygulama yeniden açılsa da sayaç sürer
    const yeni = await oturum(dosya, '');
    expect(() => yeni.kimlik.giris('admin', 'gizli1')).toThrow(/saniye|dakika/);
    // kurtarma kodu denemeleri de sınırlı
    for (let i = 0; i < 5; i++) expect(() => yeni.kimlik.kurtar('AAAA-BBBB-CCCC', 'admin', 'kurtar1')).toThrow(/hatalı/);
    expect(() => yeni.kimlik.kurtar(kurtarmaKodu, 'admin', 'kurtar1')).toThrow(/dakika/);
    yeni.s.kapat();
  }, 60000);
});
