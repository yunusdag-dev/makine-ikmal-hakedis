import type { Database } from 'sql.js';
import { VARSAYILAN_PARAMS } from '../src/engine/params';
import { varsayilanTatiller } from '../src/engine/tatilVarsayilan';

export const SCHEMA_VERSION = 4;

/** v2: kullanıcı adı + şifre + rol (çok kullanıcılı oturum) */
const V2 = [
  "ALTER TABLE kullanicilar ADD COLUMN kullanici_adi TEXT",
  "ALTER TABLE kullanicilar ADD COLUMN sifre_hash TEXT",
  "ALTER TABLE kullanicilar ADD COLUMN sifre_tuz TEXT",
  "ALTER TABLE kullanicilar ADD COLUMN rol TEXT NOT NULL DEFAULT 'kullanici'",
  "ALTER TABLE kullanicilar ADD COLUMN sifre_degistirmeli INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE kullanicilar ADD COLUMN son_giris TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE kullanicilar ADD COLUMN olusturma TEXT NOT NULL DEFAULT ''",
  "CREATE UNIQUE INDEX IF NOT EXISTS ux_kullanici_adi ON kullanicilar(kullanici_adi COLLATE NOCASE)",
  "INSERT OR IGNORE INTO meta (anahtar, deger) VALUES ('surum', '0')",
];

/** v4: görev (sefer) başına saat / fazla mesai / harici km / sıra; ortak personel ve görev yeri listeleri */
const V4_SEFER_KOLONLARI: [string, string][] = [
  ['cikis_saat', "TEXT NOT NULL DEFAULT ''"], ['donus_saat', "TEXT NOT NULL DEFAULT ''"], ['fazla_mesai', 'REAL NOT NULL DEFAULT 0'],
  ['mesai_mod', "TEXT NOT NULL DEFAULT 'oto'"], ['harici_km', 'REAL'], ['sira', 'INTEGER NOT NULL DEFAULT 0'],
];
const V4_LISTELER = [
  `CREATE TABLE IF NOT EXISTS personel_listesi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    ad_norm TEXT NOT NULL UNIQUE,
    olusturma TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS yer_listesi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    ad_norm TEXT NOT NULL UNIQUE,
    olusturma TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`,
];

/** v3: sürücü-araç atamaları dönem bazlı ("şu aydan itibaren bu araç") */
const V3 = [
  `CREATE TABLE IF NOT EXISTS surucu_arac_atamalari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    surucu_id INTEGER NOT NULL REFERENCES suruculer(id) ON DELETE CASCADE,
    baslangic TEXT NOT NULL,            -- YYYY-MM: bu aydan itibaren geçerli
    arac_id INTEGER REFERENCES araclar(id) ON DELETE SET NULL,  -- NULL = aracı yok
    olusturan TEXT NOT NULL DEFAULT '',
    olusturma TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE (surucu_id, baslangic)
  )`,
  // mevcut eşleşmeler "en baştan beri" geçerli sayılır
  `INSERT OR IGNORE INTO surucu_arac_atamalari (surucu_id, baslangic, arac_id, olusturan)
   SELECT id, '2000-01', varsayilan_arac_id, 'sistem (geçiş)' FROM suruculer WHERE varsayilan_arac_id IS NOT NULL`,
];

const V1 = `
CREATE TABLE IF NOT EXISTS meta (anahtar TEXT PRIMARY KEY, deger TEXT);

CREATE TABLE IF NOT EXISTS kullanicilar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad TEXT NOT NULL UNIQUE,
  aktif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS araclar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plaka TEXT NOT NULL UNIQUE,
  marka_model TEXT NOT NULL DEFAULT '',
  model_yili INTEGER,
  arac_tipi TEXT NOT NULL DEFAULT '',
  gorev_yeri TEXT NOT NULL DEFAULT '',
  tuketim_orani REAL NOT NULL DEFAULT 0,
  kira_bedeli REAL NOT NULL DEFAULT 0,
  yakit_yansitma_carpani REAL NOT NULL DEFAULT 1,
  baslangic_km REAL,
  sira INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1,
  notlar TEXT NOT NULL DEFAULT '',
  olusturma TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS suruculer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_soyad TEXT NOT NULL,
  tc_no TEXT NOT NULL DEFAULT '',
  telefon TEXT NOT NULL DEFAULT '',
  varsayilan_arac_id INTEGER REFERENCES araclar(id) ON DELETE SET NULL,
  ucret_grubu TEXT NOT NULL DEFAULT 'surucu' CHECK (ucret_grubu IN ('surucu','operator')),
  emekli INTEGER NOT NULL DEFAULT 0,
  yol_hakki INTEGER NOT NULL DEFAULT 1,
  ise_giris TEXT NOT NULL DEFAULT '',
  isten_cikis TEXT NOT NULL DEFAULT '',
  sira INTEGER NOT NULL DEFAULT 0,
  aktif INTEGER NOT NULL DEFAULT 1,
  notlar TEXT NOT NULL DEFAULT '',
  olusturma TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tatiller (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tarih TEXT NOT NULL,
  tur TEXT NOT NULL CHECK (tur IN ('RT','RTA','DB','DBA')),
  ad TEXT NOT NULL DEFAULT '',
  UNIQUE (tarih, tur)
);

-- Dönem bazlı parametreler: 'gecerlilik' ayından itibaren (bir sonraki sürüme kadar) geçerli
CREATE TABLE IF NOT EXISTS parametreler (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gecerlilik TEXT NOT NULL UNIQUE,  -- YYYY-MM
  veri TEXT NOT NULL,               -- JSON (Params)
  aciklama TEXT NOT NULL DEFAULT '',
  guncelleme TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Sürücüye yazılan günlük kayıt (tarih + sürücü)
CREATE TABLE IF NOT EXISTS surucu_gunleri (
  surucu_id INTEGER NOT NULL REFERENCES suruculer(id) ON DELETE CASCADE,
  tarih TEXT NOT NULL,
  durum TEXT NOT NULL DEFAULT '',
  fazla_mesai REAL NOT NULL DEFAULT 0,
  hafta_tatili INTEGER NOT NULL DEFAULT 0,
  resmi_tatil REAL NOT NULL DEFAULT 0,
  dis_gorev REAL NOT NULL DEFAULT 0,
  konaklama INTEGER NOT NULL DEFAULT 0,
  yemek_override INTEGER,           -- NULL = otomatik
  yol_override INTEGER,             -- NULL = otomatik
  cikis_saat TEXT NOT NULL DEFAULT '',
  donus_saat TEXT NOT NULL DEFAULT '',
  notlar TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (surucu_id, tarih)
);

-- Araca yazılan kayıt (tarih + sürücü + araç). Bir günde birden çok araç olabilir.
CREATE TABLE IF NOT EXISTS seferler (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tarih TEXT NOT NULL,
  surucu_id INTEGER REFERENCES suruculer(id) ON DELETE SET NULL,
  arac_id INTEGER NOT NULL REFERENCES araclar(id) ON DELETE CASCADE,
  km_cikis REAL,
  km_donus REAL,
  arac_ig INTEGER NOT NULL DEFAULT 0,
  arac_igd REAL NOT NULL DEFAULT 0,
  gorevli TEXT NOT NULL DEFAULT '',
  gorev_yeri TEXT NOT NULL DEFAULT '',
  cikis_saat TEXT NOT NULL DEFAULT '',
  donus_saat TEXT NOT NULL DEFAULT '',
  fazla_mesai REAL NOT NULL DEFAULT 0,
  mesai_mod TEXT NOT NULL DEFAULT 'oto',
  harici_km REAL,
  sira INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_seferler_tarih ON seferler(tarih);
CREATE INDEX IF NOT EXISTS ix_seferler_arac ON seferler(arac_id, tarih);
CREATE INDEX IF NOT EXISTS ix_seferler_surucu ON seferler(surucu_id, tarih);

-- Aylık araç girdileri (Aşama 2 elle alanları)
CREATE TABLE IF NOT EXISTS arac_aylari (
  arac_id INTEGER NOT NULL REFERENCES araclar(id) ON DELETE CASCADE,
  ay TEXT NOT NULL,
  onceki_km REAL,                   -- NULL = otomatik (önceki ayların en büyük KM'si)
  hizmet_disi_gun REAL NOT NULL DEFAULT 0,
  km_duzeltme REAL NOT NULL DEFAULT 0,
  km_duzeltme_aciklama TEXT NOT NULL DEFAULT '',
  kira_bedeli REAL,                 -- NULL = araç kartı
  tuketim_orani REAL,               -- NULL = araç kartı
  yakit_yansitma_carpani REAL,      -- NULL = araç kartı
  PRIMARY KEY (arac_id, ay)
);

-- Aylık sürücü girdileri (Aşama 2 / bordro elle alanları)
CREATE TABLE IF NOT EXISTS surucu_aylari (
  surucu_id INTEGER NOT NULL REFERENCES suruculer(id) ON DELETE CASCADE,
  ay TEXT NOT NULL,
  hizmet_disi_gun REAL NOT NULL DEFAULT 0,
  fazla_mesai_duzeltme REAL NOT NULL DEFAULT 0,
  konaklama_birim_fiyat REAL,       -- NULL = ücret tablosu
  kumulatif_gvm REAL,               -- NULL = önceki ayın kapanışından otomatik
  calisma_ayi INTEGER,              -- NULL = otomatik
  ozel_sigorta REAL NOT NULL DEFAULT 0,
  kapanis_kumulatif_gvm REAL,       -- dönem kapatılınca yazılır (sonraki ayın açılışı)
  PRIMARY KEY (surucu_id, ay)
);

CREATE TABLE IF NOT EXISTS donemler (
  ay TEXT PRIMARY KEY,
  durum TEXT NOT NULL DEFAULT 'acik' CHECK (durum IN ('acik','kapali')),
  kapatan TEXT NOT NULL DEFAULT '',
  kapanis_zamani TEXT NOT NULL DEFAULT '',
  notlar TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS degisiklik_kaydi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zaman TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  kullanici TEXT NOT NULL,
  makine TEXT NOT NULL DEFAULT '',
  islem TEXT NOT NULL,
  varlik TEXT NOT NULL,
  varlik_id TEXT NOT NULL DEFAULT '',
  ozet TEXT NOT NULL DEFAULT '',
  once TEXT,
  sonra TEXT
);
CREATE INDEX IF NOT EXISTS ix_kayit_zaman ON degisiklik_kaydi(zaman);
`;

export function migrate(db: Database): { degisti: boolean } {
  const v = Number(db.exec('PRAGMA user_version')[0]?.values?.[0]?.[0] ?? 0);
  if (v >= SCHEMA_VERSION) return { degisti: false };
  db.run('BEGIN');
  try {
    if (v < 1) {
      db.run(V1);
      // varsayılan parametreler ve tatiller
      db.run('INSERT OR IGNORE INTO parametreler (gecerlilik, veri, aciklama) VALUES (?,?,?)', [
        '2026-01',
        JSON.stringify(VARSAYILAN_PARAMS),
        'İlk kurulum (Ağustos 2026 örnek dosyalarındaki değerler)',
      ]);
      for (const t of varsayilanTatiller()) {
        db.run('INSERT OR IGNORE INTO tatiller (tarih, tur, ad) VALUES (?,?,?)', [t.tarih, t.tur, t.ad]);
      }
      db.run("INSERT OR REPLACE INTO meta (anahtar, deger) VALUES ('olusturma', datetime('now','localtime'))");
    }
    if (v < 2) {
      const kolonlar = (db.exec('PRAGMA table_info(kullanicilar)')[0]?.values ?? []).map((r) => r[1]);
      for (const q of V2) {
        const m = q.match(/ADD COLUMN (\w+)/);
        if (m && kolonlar.includes(m[1])) continue;
        db.run(q);
      }
    }
    if (v < 3) for (const q of V3) db.run(q);
    if (v < 4) {
      const sk = (db.exec('PRAGMA table_info(seferler)')[0]?.values ?? []).map((r) => r[1]);
      for (const [ad, tip] of V4_SEFER_KOLONLARI) if (!sk.includes(ad)) db.run(`ALTER TABLE seferler ADD COLUMN ${ad} ${tip}`);
      for (const q of V4_LISTELER) db.run(q);
    }
    db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { degisti: true };
}
