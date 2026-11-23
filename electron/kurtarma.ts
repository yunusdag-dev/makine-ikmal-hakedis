import fs from 'node:fs';
import path from 'node:path';

/** Bozuk veritabanı için kurtarma yetkisi: yalnız bağlantı denemesinde "bozuk" bulunan dosya ve o anda listelenen yedekler */
export interface KurtarmaIzni { db: string; yollar: Set<string> }

export function kurtarmaIzniOlustur(db: string, yedekYollari: string[]): KurtarmaIzni {
  return { db: path.resolve(db), yollar: new Set(yedekYollari.filter(Boolean).map((y) => path.resolve(y))) };
}

/**
 * Bozuk veritabanını (yeniden adlandırarak saklayıp) seçilen yedekle değiştirir.
 * Yalnızca bozuk bulunan veritabanı ve listelenen yedekler kabul edilir; yedeğin bütünlüğü doğrulanmadan hiçbir şey değiştirilmez.
 */
export function bozukKurtarUygula(izin: KurtarmaIzni | null, dbYolu: string, yedekYolu: string, butunMu: (yol: string) => boolean): { bozukDosya: string } {
  if (!izin) throw new Error('Kurtarma yetkisi yok: önce veritabanına bağlanmayı deneyin.');
  const db = path.resolve(String(dbYolu ?? ''));
  const yedek = path.resolve(String(yedekYolu ?? ''));
  if (db !== izin.db) throw new Error('Kurtarma yalnızca bozuk bulunan veritabanı dosyası için yapılabilir.');
  if (!izin.yollar.has(yedek)) throw new Error('Seçilen dosya kurtarma listesindeki yedeklerden biri değil.');
  if (!fs.existsSync(yedek)) throw new Error('Yedek dosyası bulunamadı.');
  if (!butunMu(yedek)) throw new Error('Seçilen yedek dosyası da bozuk görünüyor; başka bir yedek deneyin.');
  const bozuk = `${db}.bozuk-${Date.now()}`;
  if (fs.existsSync(db)) fs.renameSync(db, bozuk);
  fs.copyFileSync(yedek, db);
  return { bozukDosya: bozuk };
}
