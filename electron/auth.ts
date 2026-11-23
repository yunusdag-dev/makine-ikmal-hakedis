/**
 * Kullanıcı hesapları ve kimlik doğrulama.
 * - Şifreler scrypt ile (rastgele tuzla) özetlenir; düz metin hiçbir yerde saklanmaz.
 * - Roller: yonetici (her şey + kullanıcı yönetimi), kullanici (veri girişi), izleyici (yalnız görüntüleme / çıktı).
 * - En az bir aktif yönetici her zaman bulunur.
 * - Kurtarma kodu: tüm yöneticiler şifresini unutursa, ilk kurulumda verilen kodla bir yönetici şifresi sıfırlanır.
 */
import crypto from 'node:crypto';
import os from 'node:os';
import { Store } from './store';

export type Rol = 'yonetici' | 'kullanici' | 'izleyici';
export const ROLLER: Rol[] = ['yonetici', 'kullanici', 'izleyici'];
export const MIN_SIFRE = 6;

export interface KullaniciSatiri {
  id: number;
  kullanici_adi: string;
  ad: string;
  rol: Rol;
  aktif: number;
  sifre_degistirmeli: number;
  son_giris: string;
  olusturma: string;
  sifre_var: number;
}

function ozet(sifre: string, tuz: string): string {
  return crypto.scryptSync(sifre, tuz, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
}
function yeniOzet(sifre: string) {
  const tuz = crypto.randomBytes(16).toString('hex');
  return { tuz, hash: ozet(sifre, tuz) };
}
function esit(sifre: string, tuz: string, hash: string): boolean {
  const a = Buffer.from(ozet(sifre, tuz), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sifreKontrol(s: string) {
  if (typeof s !== 'string' || s.length < MIN_SIFRE) throw new Error(`Şifre en az ${MIN_SIFRE} karakter olmalı.`);
  if (s.length > 128) throw new Error('Şifre çok uzun.');
}
/** Kullanıcı adını sabit biçime çevirir: küçük harf, Türkçe karakterler sadeleştirilir (Ayşe = ayse) */
export function adNormal(k: string): string {
  const harita: Record<string, string> = { ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u' };
  return String(k ?? '').trim().replace(/[çÇğĞıIİöÖşŞüÜ]/g, (c) => harita[c]).toLowerCase();
}
function adKontrol(k: string): string {
  const t = adNormal(k);
  if (!/^[a-z0-9._-]{3,32}$/.test(t)) throw new Error('Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, tire ve alt çizgi kullanılabilir (boşluk olmaz).');
  return t;
}
function kurtarmaKoduUret(): string {
  const harf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.randomBytes(12);
  let s = '';
  for (let i = 0; i < 12; i++) s += harf[b[i] % harf.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
const kodNormalize = (k: string) => String(k ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const DENEME_SINIRI = 5;
const GIRIS_BEKLEME_MS = 60_000;
const KURTAR_BEKLEME_MS = 5 * 60_000;

export class Kimlik {
  constructor(private s: Store) {}

  // ---- hatalı deneme sayacı: veritabanında tutulur (uygulama yeniden açılsa ya da başka bilgisayardan denense de sıfırlanmaz)
  private denemeOku(anahtar: string): { sayi: number; kilitBitis: number } {
    const m = this.s.get<{ deger: string }>('SELECT deger FROM meta WHERE anahtar=?', [`deneme:${anahtar}`])?.deger;
    const [sayi, kilitBitis] = (m ?? '0|0').split('|').map(Number);
    return { sayi: sayi || 0, kilitBitis: kilitBitis || 0 };
  }
  private denemeYaz(anahtar: string, sayi: number, kilitBitis: number) {
    this.s.tx(() => {
      if (sayi === 0 && kilitBitis === 0) this.s.run('DELETE FROM meta WHERE anahtar=?', [`deneme:${anahtar}`]);
      else this.s.run("INSERT INTO meta (anahtar, deger) VALUES (?,?) ON CONFLICT(anahtar) DO UPDATE SET deger=excluded.deger", [`deneme:${anahtar}`, `${sayi}|${kilitBitis}`]);
    }, { sistem: true });
  }
  private denemeKilitli(anahtar: string) {
    const d = this.denemeOku(anahtar);
    if (d.kilitBitis > Date.now()) {
      const sn = Math.ceil((d.kilitBitis - Date.now()) / 1000);
      throw new Error(`Çok sayıda hatalı deneme. ${sn >= 90 ? Math.ceil(sn / 60) + ' dakika' : sn + ' saniye'} sonra tekrar deneyin.`);
    }
  }
  private denemeBasarisiz(anahtar: string, bekleme: number) {
    const d = this.denemeOku(anahtar);
    const sayi = d.sayi + 1;
    if (sayi >= DENEME_SINIRI) this.denemeYaz(anahtar, 0, Date.now() + bekleme);
    else this.denemeYaz(anahtar, sayi, 0);
  }
  private denemeSifirla(anahtar: string) {
    const d = this.denemeOku(anahtar);
    if (d.sayi || d.kilitBitis) this.denemeYaz(anahtar, 0, 0);
  }

  private kayit(kullanici: string, islem: string, ozetMetin: string, varlikId = '') {
    this.s.run('INSERT INTO degisiklik_kaydi (kullanici, makine, islem, varlik, varlik_id, ozet) VALUES (?,?,?,?,?,?)',
      [kullanici, os.hostname(), islem, 'kullanıcı', varlikId, ozetMetin]);
  }

  /** Şifreli en az bir hesap var mı? (yoksa ilk kurulum ekranı) */
  kurulumGerekli(): boolean {
    this.s.tazele();
    return !this.s.get<{ n: number }>("SELECT COUNT(*) n FROM kullanicilar WHERE sifre_hash IS NOT NULL AND aktif=1")!.n;
  }

  ilkKurulum(o: { kullaniciAdi: string; ad: string; sifre: string }): { kurtarmaKodu: string } {
    const ka = adKontrol(o.kullaniciAdi);
    const ad = String(o.ad ?? '').trim();
    if (!ad) throw new Error('Ad soyad giriniz.');
    sifreKontrol(o.sifre);
    const kod = kurtarmaKoduUret();
    this.s.tx(() => {
      if (this.s.get<{ n: number }>('SELECT COUNT(*) n FROM kullanicilar WHERE sifre_hash IS NOT NULL AND aktif=1')!.n)
        throw new Error('Kurulum zaten yapılmış. Lütfen giriş yapın.');
      const { tuz, hash } = yeniOzet(o.sifre);
      this.adBenzersiz(ad, ka, null);
      this.s.run(
        "INSERT INTO kullanicilar (ad, kullanici_adi, sifre_hash, sifre_tuz, rol, aktif, sifre_degistirmeli, olusturma) VALUES (?,?,?,?,'yonetici',1,0,datetime('now','localtime'))",
        [ad, ka, hash, tuz]);
      const k = yeniOzet(kodNormalize(kod));
      this.s.run("INSERT OR REPLACE INTO meta (anahtar, deger) VALUES ('kurtarma', ?)", [`${k.tuz}:${k.hash}`]);
      this.kayit(ad, 'ilk kurulum', `İlk yönetici hesabı oluşturuldu: ${ka}`);
    });
    return { kurtarmaKodu: kod };
  }

  private adBenzersiz(ad: string, ka: string, id: number | null) {
    if (this.s.get('SELECT id FROM kullanicilar WHERE kullanici_adi = ? COLLATE NOCASE AND id <> ?', [ka, id ?? 0]))
      throw new Error(`"${ka}" kullanıcı adı zaten kullanılıyor.`);
    if (this.s.get('SELECT id FROM kullanicilar WHERE ad = ? AND id <> ?', [ad, id ?? 0]))
      throw new Error(`"${ad}" adlı bir hesap zaten var.`);
  }

  giris(kullaniciAdi: string, sifre: string) {
    const ka = adNormal(kullaniciAdi);
    this.s.tazele();
    const u = this.s.get<any>('SELECT * FROM kullanicilar WHERE kullanici_adi = ? COLLATE NOCASE', [ka]);
    // olmayan kullanıcı adları ortak bir anahtarda sayılır (veritabanında rastgele kayıt birikmesin)
    const anahtar = u ? `g:${ka}` : 'g:?';
    this.denemeKilitli(anahtar);
    const ok = !!u && !!u.sifre_hash && esit(String(sifre ?? ''), u.sifre_tuz, u.sifre_hash);
    if (!ok) {
      this.denemeBasarisiz(anahtar, GIRIS_BEKLEME_MS);
      throw new Error('Kullanıcı adı veya şifre hatalı.');
    }
    if (!u.aktif) throw new Error('Bu hesap pasif durumda. Yöneticinize başvurun.');
    this.denemeSifirla(anahtar);
    this.s.kullanici = u.ad;
    this.s.kullaniciId = u.id;
    this.s.rol = u.rol;
    this.s.saltOkunur = u.rol === 'izleyici';
    this.s.oturumuYenile();
    try {
      // izleyicinin girişi de kayda geçsin (yalnız bu sistem kaydı için izin verilir)
      this.s.tx(() => {
        this.s.run("UPDATE kullanicilar SET son_giris = datetime('now','localtime') WHERE id=?", [u.id]);
        this.kayit(u.ad, 'oturum aç', 'Giriş yapıldı', String(u.id));
      }, { sistem: true });
    } catch { /* meşgulse giriş kaydı atlanır */ }
    return { id: u.id, ad: u.ad, kullaniciAdi: u.kullanici_adi, rol: u.rol as Rol, sifreDegistirmeli: !!u.sifre_degistirmeli };
  }

  /** Kurtarma koduyla bir hesabın şifresini sıfırlar (tüm yöneticiler şifreyi unuttuysa) */
  kurtar(kod: string, kullaniciAdi: string, yeniSifre: string) {
    sifreKontrol(yeniSifre);
    this.s.tazele();
    const m = this.s.get<{ deger: string }>("SELECT deger FROM meta WHERE anahtar='kurtarma'");
    if (!m) throw new Error('Bu veritabanında kurtarma kodu tanımlı değil.');
    this.denemeKilitli('k');
    const [tuz, hash] = m.deger.split(':');
    if (!esit(kodNormalize(kod), tuz, hash)) {
      this.denemeBasarisiz('k', KURTAR_BEKLEME_MS);
      throw new Error('Kurtarma kodu hatalı.');
    }
    this.denemeSifirla('k');
    const ka = adNormal(kullaniciAdi);
    this.s.tx(() => {
      const u = this.s.get<any>('SELECT * FROM kullanicilar WHERE kullanici_adi = ? COLLATE NOCASE', [ka]);
      if (!u) throw new Error('Kullanıcı bulunamadı.');
      const { tuz: t2, hash: h2 } = yeniOzet(yeniSifre);
      this.s.run("UPDATE kullanicilar SET sifre_hash=?, sifre_tuz=?, sifre_degistirmeli=0, aktif=1, rol='yonetici' WHERE id=?", [h2, t2, u.id]);
      this.kayit(u.ad, 'kurtarma', `Kurtarma koduyla şifre sıfırlandı ve yönetici yapıldı: ${u.kullanici_adi}`, String(u.id));
    });
  }

  // ------------------------------------------------------------- oturum sahibinin işlemleri
  sifremiDegistir(eski: string, yeni: string) {
    sifreKontrol(yeni);
    const id = this.s.kullaniciId;
    if (!id) throw new Error('Oturum yok.');
    this.s.tazele();
    const u = this.s.get<any>('SELECT * FROM kullanicilar WHERE id=?', [id]);
    if (!u || !esit(String(eski ?? ''), u.sifre_tuz, u.sifre_hash)) throw new Error('Mevcut şifre hatalı.');
    if (eski === yeni) throw new Error('Yeni şifre eskisiyle aynı olamaz.');
    this.s.tx(() => {
      const { tuz, hash } = yeniOzet(yeni);
      this.s.run('UPDATE kullanicilar SET sifre_hash=?, sifre_tuz=?, sifre_degistirmeli=0 WHERE id=?', [hash, tuz, id]);
      this.kayit(u.ad, 'şifre değiştir', 'Kendi şifresini değiştirdi', String(id));
    }, { sistem: true });
  }

  // ------------------------------------------------------------- yönetici işlemleri
  private yoneticiMi() {
    if (this.s.rol !== 'yonetici') throw new Error('Bu işlem için yönetici yetkisi gerekir.');
  }

  liste(): KullaniciSatiri[] {
    this.yoneticiMi();
    return this.s.all<KullaniciSatiri>(
      `SELECT id, kullanici_adi, ad, rol, aktif, sifre_degistirmeli, son_giris, olusturma, (sifre_hash IS NOT NULL) AS sifre_var
       FROM kullanicilar WHERE kullanici_adi IS NOT NULL ORDER BY aktif DESC, rol, ad`);
  }

  private aktifYoneticiSayisi(haric?: number) {
    return this.s.get<{ n: number }>("SELECT COUNT(*) n FROM kullanicilar WHERE rol='yonetici' AND aktif=1 AND sifre_hash IS NOT NULL AND id<>?", [haric ?? 0])!.n;
  }

  kaydet(o: { id?: number; kullaniciAdi: string; ad: string; rol: Rol; aktif: boolean; sifre?: string }) {
    this.yoneticiMi();
    const ka = adKontrol(o.kullaniciAdi);
    const ad = String(o.ad ?? '').trim();
    if (!ad) throw new Error('Ad soyad giriniz.');
    if (!ROLLER.includes(o.rol)) throw new Error('Geçersiz rol.');
    if (!o.id || o.sifre) sifreKontrol(o.sifre ?? '');
    return this.s.tx(() => {
      this.adBenzersiz(ad, ka, o.id ?? null);
      if (o.id) {
        const once = this.s.get<any>('SELECT id, kullanici_adi, ad, rol, aktif FROM kullanicilar WHERE id=?', [o.id]);
        if (!once) throw new Error('Kullanıcı bulunamadı.');
        if (once.rol === 'yonetici' && once.aktif && (o.rol !== 'yonetici' || !o.aktif) && this.aktifYoneticiSayisi(o.id) === 0)
          throw new Error('En az bir aktif yönetici kalmalı. Önce başka bir yönetici tanımlayın.');
        this.s.run('UPDATE kullanicilar SET kullanici_adi=?, ad=?, rol=?, aktif=? WHERE id=?', [ka, ad, o.rol, o.aktif ? 1 : 0, o.id]);
        if (o.sifre) {
          const { tuz, hash } = yeniOzet(o.sifre);
          this.s.run('UPDATE kullanicilar SET sifre_hash=?, sifre_tuz=?, sifre_degistirmeli=? WHERE id=?', [hash, tuz, o.id === this.s.kullaniciId ? 0 : 1, o.id]);
        }
        this.kayit(this.s.kullanici, 'kullanıcı güncelle', `${ka} (${o.rol}${o.aktif ? '' : ', pasif'})${o.sifre ? ' — şifre yenilendi' : ''}`, String(o.id));
        return o.id;
      }
      const { tuz, hash } = yeniOzet(o.sifre!);
      const { lastId } = this.s.run(
        "INSERT INTO kullanicilar (ad, kullanici_adi, sifre_hash, sifre_tuz, rol, aktif, sifre_degistirmeli, olusturma) VALUES (?,?,?,?,?,?,1,datetime('now','localtime'))",
        [ad, ka, hash, tuz, o.rol, o.aktif ? 1 : 0]);
      this.kayit(this.s.kullanici, 'kullanıcı ekle', `${ka} — ${ad} (${o.rol})`, String(lastId));
      return lastId;
    });
  }

  /** Yönetici başka bir kullanıcıya yeni (geçici) şifre atar; kullanıcı ilk girişte değiştirir */
  sifreAta(id: number, sifre: string) {
    this.yoneticiMi();
    sifreKontrol(sifre);
    this.s.tx(() => {
      const u = this.s.get<any>('SELECT * FROM kullanicilar WHERE id=?', [id]);
      if (!u) throw new Error('Kullanıcı bulunamadı.');
      const { tuz, hash } = yeniOzet(sifre);
      this.s.run('UPDATE kullanicilar SET sifre_hash=?, sifre_tuz=?, sifre_degistirmeli=?, aktif=1 WHERE id=?', [hash, tuz, id === this.s.kullaniciId ? 0 : 1, id]);
      this.denemeSifirla(`g:${adNormal(u.kullanici_adi)}`);
      this.kayit(this.s.kullanici, 'şifre ata', `${u.kullanici_adi} kullanıcısına yeni şifre atandı`, String(id));
    });
  }

  kurtarmaKoduYenile(): string {
    this.yoneticiMi();
    const kod = kurtarmaKoduUret();
    this.s.tx(() => {
      const k = yeniOzet(kodNormalize(kod));
      this.s.run("INSERT OR REPLACE INTO meta (anahtar, deger) VALUES ('kurtarma', ?)", [`${k.tuz}:${k.hash}`]);
      this.kayit(this.s.kullanici, 'kurtarma kodu', 'Yeni kurtarma kodu oluşturuldu (eskisi geçersiz)');
    });
    return kod;
  }
}
