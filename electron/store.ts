/**
 * Veritabanı dosya katmanı (sql.js / SQLite) — aynı anda birden çok kullanıcı için.
 *
 * Eşzamanlı kullanım (2-3 kişi, ortak ağ klasöründe tek dosya):
 *  - Okuma: her istekten önce dosyanın imzasına (değişiklik zamanı + boyut) bakılır; başka biri
 *    kaydetmişse dosya yeniden yüklenir. Arayüz birkaç saniyede bir yoklar ve kendini günceller.
 *  - Yazma: kısa süreli YAZMA KİLİDİ (`hakedis.db.yazma`) alınır -> diskteki en güncel sürüm yüklenir ->
 *    değişiklik uygulanır -> dosyaya atomik yazılır -> kilit bırakılır. Böylece kimse diğerinin
 *    kaydını ezmez; kilit yalnız birkaç milisaniye tutulur. 20 saniyeden eski kilit terk edilmiş sayılır.
 *  - Açık oturumlar `hakedis.db.oturumlar/` klasöründe görünür (kim, hangi bilgisayar).
 *
 * Bozulmaya karşı önlemler:
 *  - Atomik yazma: geçici dosya -> fsync -> doğrulama -> önceki sürüm .bak -> yeniden adlandırma.
 *  - Açılışta PRAGMA integrity_check; bozuksa .bak veya yedekten kurtarma önerilir.
 *  - Otomatik yedek: son yedek 2 saatten eskiyse `yedekler/` klasörüne kopya (son 60 adet).
 *  - Dosya standart SQLite formatındadır; uygulama bozulsa bile herhangi bir SQLite aracıyla açılabilir.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { SCHEMA_VERSION, migrate } from './schema';

let SQL: SqlJsStatic | null = null;

export async function sqlInit(wasmDir: string) {
  if (!SQL) SQL = await initSqlJs({ locateFile: (f: string) => path.join(wasmDir, f) });
  return SQL;
}

/** Dosyanın geçerli bir SQLite veritabanı olup olmadığını ve bütünlük denetimini geçip geçmediğini döndürür (sqlInit sonrası) */
export function dosyaButunMu(yol: string): boolean {
  try {
    const d = new (SQL as SqlJsStatic).Database(fs.readFileSync(yol));
    try { return d.exec('PRAGMA integrity_check')[0]?.values?.[0]?.[0] === 'ok'; } finally { d.close(); }
  } catch {
    return false;
  }
}

function uyu(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export interface OturumBilgisi {
  kullanici: string;
  makine: string;
  pid: number;
  baslangic: string;
  son: string;
}

export class Store {
  db!: Database;
  readonly dosya: string;
  readonly yazmaKilidi: string;
  readonly oturumKlasor: string;
  readonly yedekKlasor: string;
  /** İzleyici rolü: değişiklik yapamaz */
  saltOkunur = false;
  /** Değişiklik kaydında görünen ad */
  kullanici = '';
  kullaniciId: number | null = null;
  rol: 'yonetici' | 'kullanici' | 'izleyici' | '' = '';
  sonKayit: Date | null = null;
  private diskImza = '';
  private txIcinde = false;
  private oturumTimer: NodeJS.Timeout | null = null;
  private yedekTimer: NodeJS.Timeout | null = null;
  private readonly oturumDosya: string;
  private readonly token = crypto.randomBytes(8).toString('hex');

  constructor(dosya: string) {
    this.dosya = path.resolve(dosya);
    this.yazmaKilidi = this.dosya + '.yazma';
    this.oturumKlasor = this.dosya + '.oturumlar';
    this.yedekKlasor = path.join(path.dirname(this.dosya), 'yedekler');
    this.oturumDosya = path.join(this.oturumKlasor, `${os.hostname()}_${process.pid}_${this.token}.json`.replace(/[^\w.\-]/g, '_'));
  }

  // ------------------------------------------------------------- dosya imzası / yeniden yükleme
  /** Dosya kimliği + oluşturma/değişiklik zamanı (ns) + boyut. Her atomik kayıt yeni bir dosya olduğundan imza değişir. */
  private imza(): string {
    try {
      const st = fs.statSync(this.dosya, { bigint: true });
      return `${st.ino}:${st.birthtimeNs}:${st.mtimeNs}:${st.size}`;
    } catch {
      return '';
    }
  }

  /** Diskteki dosyayı belleğe yükler (başka kullanıcının kaydettiği en güncel hal) */
  private dosyadanYukle() {
    const S = SQL as SqlJsStatic;
    let son: any;
    for (let i = 0; i < 8; i++) {
      try {
        const once = this.imza();
        const buf = fs.readFileSync(this.dosya);
        const yeni = new S.Database(buf);
        yeni.exec('SELECT 1 FROM sqlite_master LIMIT 1');
        const sonra = this.imza();
        if (once !== sonra) { yeni.close(); uyu(60); continue; }
        // Dosya bu uygulamadan daha yeni bir sürümle yükseltilmişse eski sürüm ona dokunmaz
        const dv = Number(yeni.exec('PRAGMA user_version')[0]?.values?.[0]?.[0] ?? 0);
        if (dv > SCHEMA_VERSION) {
          yeni.close();
          throw new Error(`Bu veritabanı daha yeni bir uygulama sürümüyle yükseltilmiş (veri yapısı v${dv}; bu uygulama v${SCHEMA_VERSION} biliyor). Verilerin bozulmaması için açılmadı. Lütfen uygulamayı güncelleyin (ortak klasördeki en yeni kurulum dosyası).`);
        }
        try { this.db?.close(); } catch { /* */ }
        this.db = yeni;
        this.db.run('PRAGMA foreign_keys = ON');
        this.diskImza = sonra;
        return;
      } catch (e: any) {
        if (String(e?.message).startsWith('Bu veritabanı daha yeni')) throw e;
        son = e;
        uyu(120);
      }
    }
    throw son ?? new Error('Veritabanı dosyası okunamadı.');
  }

  /** Başka biri kaydetmişse belleği günceller. true: yeniden yüklendi */
  tazele(): boolean {
    if (this.txIcinde) return false;
    const im = this.imza();
    if (im && im !== this.diskImza) {
      this.dosyadanYukle();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------- yazma kilidi
  private kilitAl(zamanAsimiMs = 20000) {
    const bas = Date.now();
    const icerik = JSON.stringify({ kullanici: this.kullanici, makine: os.hostname(), pid: process.pid, token: this.token, zaman: new Date().toISOString() });
    // Terk edilmiş kilit tespiti bilgisayar saatlerine DEĞİL, bu süreçte kilidi ne kadar süredir aynı halde gördüğümüze dayanır
    // (bilgisayarların saati farklı olsa da bir kilit yanlışlıkla çalınmaz).
    let gorulen: { token: string; ilk: number } | null = null;
    for (;;) {
      try {
        const fd = fs.openSync(this.yazmaKilidi, 'wx');
        fs.writeSync(fd, icerik);
        fs.closeSync(fd);
        return;
      } catch (e: any) {
        if (e?.code !== 'EEXIST' && e?.code !== 'EPERM' && e?.code !== 'EBUSY') throw e;
        // terk edilmiş kilit mi?
        try {
          const k = JSON.parse(fs.readFileSync(this.yazmaKilidi, 'utf8'));
          if (!gorulen || gorulen.token !== k.token) gorulen = { token: k.token, ilk: Date.now() };
          else if (Date.now() - gorulen.ilk > 12000) {
            // aynı kilit 12 sn'dir yerinde: sahibi çökmüş. Silmeden hemen önce hâlâ aynı kilit mi diye bakılır.
            const k2 = JSON.parse(fs.readFileSync(this.yazmaKilidi, 'utf8'));
            if (k2.token === gorulen.token) fs.unlinkSync(this.yazmaKilidi);
            gorulen = null;
          }
        } catch { gorulen = null; /* okunamadı / silindi */ }
        if (Date.now() - bas > zamanAsimiMs) {
          let kim = '';
          try { const k = JSON.parse(fs.readFileSync(this.yazmaKilidi, 'utf8')); kim = ` (${k.kullanici} – ${k.makine})`; } catch { /* */ }
          throw new Error(`Veritabanı şu an başka bir kayıt işlemiyle meşgul${kim}. Lütfen tekrar deneyin.`);
        }
        uyu(80 + Math.floor(Math.random() * 80));
      }
    }
  }

  private kilitBirak() {
    try {
      const k = JSON.parse(fs.readFileSync(this.yazmaKilidi, 'utf8'));
      if (k.token === this.token) fs.unlinkSync(this.yazmaKilidi);
    } catch { /* yok */ }
  }

  // ------------------------------------------------------------- aç / kapat
  async ac(wasmDir: string, opts?: { kullanici?: string; saltOkunur?: boolean }) {
    const S = await sqlInit(wasmDir);
    if (opts?.kullanici) this.kullanici = opts.kullanici;
    if (opts?.saltOkunur) this.saltOkunur = true;
    fs.mkdirSync(path.dirname(this.dosya), { recursive: true });
    if (fs.existsSync(this.dosya)) {
      this.dosyadanYukle();
      if (!this.butunlukKontrol()) throw new Error('BUTUNLUK_HATASI');
    } else {
      this.db = new S.Database();
    }
    const v = Number(this.db.exec('PRAGMA user_version')[0]?.values?.[0]?.[0] ?? 0);
    if (v < SCHEMA_VERSION || !fs.existsSync(this.dosya)) {
      // şema oluşturma / yükseltme: kilit altında, en güncel dosya üzerinde
      this.kilitAl();
      try {
        if (fs.existsSync(this.dosya)) {
          this.dosyadanYukle();
          // Yükseltmeden önce, yükseltilecek dosyanın aynen yedeği (eski sürüme dönüş için)
          if (Number(this.db.exec('PRAGMA user_version')[0]?.values?.[0]?.[0] ?? 0) < SCHEMA_VERSION) this.yedekAl(`yukseltme-oncesi-v${SCHEMA_VERSION}`);
        }
        migrate(this.db);
        this.kaydet();
      } finally {
        this.kilitBirak();
      }
    }
    this.oturumYaz();
    this.oturumTimer = setInterval(() => this.oturumYaz(), 30_000);
    this.otomatikYedek();
    this.yedekTimer = setInterval(() => this.otomatikYedek(), 30 * 60 * 1000);
    return { surum: SCHEMA_VERSION };
  }

  butunlukKontrol(): boolean {
    try {
      const r = this.db.exec('PRAGMA integrity_check');
      return r[0]?.values?.[0]?.[0] === 'ok';
    } catch {
      return false;
    }
  }

  kapat() {
    if (this.oturumTimer) clearInterval(this.oturumTimer);
    if (this.yedekTimer) clearInterval(this.yedekTimer);
    this.oturumTimer = this.yedekTimer = null;
    try { fs.unlinkSync(this.oturumDosya); } catch { /* */ }
    try { this.db?.close(); } catch { /* */ }
  }

  // ------------------------------------------------------------- açık oturumlar
  private oturumYaz() {
    if (!this.kullanici) return;
    try {
      fs.mkdirSync(this.oturumKlasor, { recursive: true });
      const o: OturumBilgisi = { kullanici: this.kullanici, makine: os.hostname(), pid: process.pid, baslangic: this.oturumBaslangic, son: new Date().toISOString() };
      fs.writeFileSync(this.oturumDosya, JSON.stringify(o));
    } catch { /* ağ kesintisi */ }
  }
  private oturumBaslangic = new Date().toISOString();
  private sonBak = 0;

  /**
   * Değişiklik kaydı budama: 12 aydan eski kayıtların "önce/sonra" ayrıntısı silinir (kim/ne zaman/özet kalır);
   * dosya küçülsün diye VACUUM yapılır. Günde en çok bir kez, yazma kilidi altında.
   */
  kayitBudama(ayTut = 12): number {
    if (this.saltOkunur || this.rol === 'izleyici') return 0;
    const bugun = new Date().toISOString().slice(0, 10);
    const son = this.get<{ deger: string }>("SELECT deger FROM meta WHERE anahtar='budama_tarihi'")?.deger;
    if (son === bugun) return 0;
    const sinir = new Date(); sinir.setMonth(sinir.getMonth() - ayTut);
    const sinirS = sinir.toISOString().slice(0, 19).replace('T', ' ');
    const n = this.get<{ n: number }>("SELECT COUNT(*) n FROM degisiklik_kaydi WHERE zaman < ? AND (once IS NOT NULL OR sonra IS NOT NULL)", [sinirS])?.n ?? 0;
    this.kilitAl();
    try {
      if (this.imza() !== this.diskImza) this.dosyadanYukle();
      if (n > 0) {
        this.db.run("UPDATE degisiklik_kaydi SET once=NULL, sonra=NULL WHERE zaman < ? AND (once IS NOT NULL OR sonra IS NOT NULL)", [sinirS]);
        this.db.run('VACUUM');
      }
      this.db.run("INSERT INTO meta (anahtar, deger) VALUES ('budama_tarihi', ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger", [bugun]);
      this.kaydet();
    } finally {
      this.kilitBirak();
    }
    return n;
  }

  oturumuYenile() {
    this.oturumBaslangic = new Date().toISOString();
    this.oturumYaz();
  }

  acikOturumlar(): (OturumBilgisi & { ben: boolean })[] {
    try {
      return fs.readdirSync(this.oturumKlasor)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          try {
            const o = JSON.parse(fs.readFileSync(path.join(this.oturumKlasor, f), 'utf8')) as OturumBilgisi;
            if (Date.now() - new Date(o.son).getTime() > 100_000) {
              try { fs.unlinkSync(path.join(this.oturumKlasor, f)); } catch { /* */ }
              return null;
            }
            return { ...o, ben: f === path.basename(this.oturumDosya) };
          } catch { return null; }
        })
        .filter(Boolean) as any;
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------------- kaydet (atomik)
  /** Bellekteki veritabanını diske atomik yazar. Yalnız yazma kilidi altındayken çağrılmalı. */
  kaydet() {
    const data = this.db.export();
    this.db.run('PRAGMA foreign_keys = ON');
    const tmp = `${this.dosya}.tmp-${process.pid}`;
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, data);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    const kontrol = new (SQL as SqlJsStatic).Database(fs.readFileSync(tmp));
    kontrol.close();
    // Önceki sürüm kopyası: her kayıtta değil, en çok 5 dakikada bir (ağda gereksiz trafiği önler)
    if (fs.existsSync(this.dosya) && Date.now() - this.sonBak > 5 * 60 * 1000) {
      try { fs.copyFileSync(this.dosya, this.dosya + '.bak'); this.sonBak = Date.now(); } catch { /* */ }
    }
    let hata: any;
    for (let i = 0; i < 10; i++) {
      try {
        fs.renameSync(tmp, this.dosya);
        hata = null;
        break;
      } catch (e) {
        hata = e; // başka bir bilgisayar o an dosyayı okuyor olabilir
        uyu(100);
      }
    }
    if (hata) { try { fs.unlinkSync(tmp); } catch { /* */ } throw hata; }
    this.diskImza = this.imza();
    this.sonKayit = new Date();
  }

  /**
   * Yazma işlemi: kilit -> en güncel dosyayı yükle -> BEGIN -> fn -> sürüm++ -> COMMIT -> atomik kaydet -> kilidi bırak.
   * Hata olursa geri alınır.
   */
  /**
   * opts.sistem: yalnız kimlik modülünün kendi kayıtları (giriş kaydı, kişinin kendi şifresi) için;
   * izleyici rolünün veri değiştirmesine izin vermez, paylaşılan yetki bayraklarına dokunmaz.
   */
  tx<T>(fn: () => T, opts?: { sistem?: boolean }): T {
    if (this.txIcinde) return fn();
    if ((this.saltOkunur || this.rol === 'izleyici') && !opts?.sistem) throw new Error('Bu hesap yalnız görüntüleme yetkisine sahip (izleyici); değişiklik yapılamaz.');
    this.kilitAl();
    this.txIcinde = true;
    try {
      const im = this.imza();
      if (im && im !== this.diskImza) this.dosyadanYukle();
      this.db.run('BEGIN');
      try {
        const r = fn();
        this.db.run("INSERT INTO meta (anahtar, deger) VALUES ('surum', '1') ON CONFLICT(anahtar) DO UPDATE SET deger = CAST(deger AS INTEGER) + 1");
        this.db.run("INSERT INTO meta (anahtar, deger) VALUES ('son_degistiren', ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger", [`${this.kullanici}|${os.hostname()}|${process.pid}|${new Date().toISOString()}`]);
        this.db.run('COMMIT');
        this.kaydet();
        return r;
      } catch (e) {
        try { this.db.run('ROLLBACK'); } catch { /* */ }
        // bellekteki hali diskle eşitle
        try { this.dosyadanYukle(); } catch { /* */ }
        throw e;
      }
    } finally {
      this.txIcinde = false;
      this.kilitBirak();
    }
  }

  /** Değişiklik sayacı ve son değiştiren (arayüzün yoklaması için) */
  surumBilgisi() {
    const m = this.all<{ anahtar: string; deger: string }>("SELECT anahtar, deger FROM meta WHERE anahtar IN ('surum','son_degistiren')");
    const surum = Number(m.find((x) => x.anahtar === 'surum')?.deger ?? 0);
    const [kim = '', makine = '', pid = '', zaman = ''] = (m.find((x) => x.anahtar === 'son_degistiren')?.deger ?? '').split('|');
    return { surum, kim, makine, zaman, ben: makine === os.hostname() && Number(pid) === process.pid };
  }

  // ------------------------------------------------------------- yedek
  /** Günlük yedek: her gün uygulamanın ilk açılışında (o güne ait yedek yoksa) veri dosyası yedeklenir; son 14 günlük yedek tutulur. */
  private otomatikYedek() {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const bugun = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    if (this.yedekler().some((y) => y.ad.startsWith(`hakedis_${bugun}_`) && /_(gunluk|otomatik)\.db$/.test(y.ad))) return;
    this.yedekAl('gunluk');
  }

  yedekAl(neden: string): string | null {
    try {
      fs.mkdirSync(this.yedekKlasor, { recursive: true });
      const d = new Date();
      const p2 = (n: number) => String(n).padStart(2, '0');
      const ad = `hakedis_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}_${neden}.db`;
      const hedef = path.join(this.yedekKlasor, ad);
      if (fs.existsSync(this.dosya)) fs.copyFileSync(this.dosya, hedef);
      else { fs.writeFileSync(hedef, this.db.export()); this.db.run('PRAGMA foreign_keys = ON'); }
      this.yedekTemizle(14);
      return hedef;
    } catch {
      return null;
    }
  }

  yedekler(): { ad: string; yol: string; boyut: number; tarih: string }[] {
    if (!fs.existsSync(this.yedekKlasor)) return [];
    return fs
      .readdirSync(this.yedekKlasor)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const yol = path.join(this.yedekKlasor, f);
        const st = fs.statSync(yol);
        return { ad: f, yol, boyut: st.size, tarih: st.mtime.toISOString() };
      })
      .sort((a, b) => b.tarih.localeCompare(a.tarih));
  }

  private yedekTemizle(tut: number) {
    // Yükseltme öncesi yedekleri silinmez (sayıya dahil değil). Günlük yedekler son 'tut' adet; diğer yedekler (geri yükleme öncesi vb.) ayrıca 'tut' x 2 adet tutulur.
    const adaylar = this.yedekler().filter((x) => !x.ad.includes('yukseltme-oncesi'));
    const gunluk = adaylar.filter((x) => /_(gunluk|otomatik)\.db$/.test(x.ad));
    const digerleri = adaylar.filter((x) => !/_(gunluk|otomatik)\.db$/.test(x.ad));
    for (const y of [...gunluk.slice(tut), ...digerleri.slice(tut * 2)]) {
      try { fs.unlinkSync(y.yol); } catch { /* */ }
    }
  }

  /** Yedekten geri yükle: önce mevcut hali yedekler, sonra yedeği yükler ve kaydeder */
  yedektenYukle(yol: string, sonra?: () => void) {
    const S = SQL as SqlJsStatic;
    const yeni = new S.Database(fs.readFileSync(yol));
    const r = yeni.exec('PRAGMA integrity_check');
    if (r[0]?.values?.[0]?.[0] !== 'ok') throw new Error('Seçilen yedek dosyası bozuk.');
    this.yedekAl('geri-yukleme-oncesi');
    this.kilitAl();
    this.txIcinde = true;
    try {
      try { this.db.close(); } catch { /* */ }
      this.db = yeni;
      this.db.run('PRAGMA foreign_keys = ON');
      migrate(this.db);
      sonra?.();
      this.kaydet();
    } finally {
      this.txIcinde = false;
      this.kilitBirak();
    }
  }

  // ------------------------------------------------------------- sorgu yardımcıları
  all<T = any>(sql: string, params: any[] = []): T[] {
    const st = this.db.prepare(sql);
    try {
      st.bind(params);
      const out: T[] = [];
      while (st.step()) out.push(st.getAsObject() as T);
      return out;
    } finally {
      st.free();
    }
  }

  get<T = any>(sql: string, params: any[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  run(sql: string, params: any[] = []): { lastId: number; changes: number } {
    this.db.run(sql, params);
    const lastId = Number(this.db.exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0] ?? 0);
    return { lastId, changes: this.db.getRowsModified() };
  }
}
