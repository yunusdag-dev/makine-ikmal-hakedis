/**
 * Hata günlüğü: beklenmeyen hatalar makine başına bir dosyaya yazılır (sorun giderme için).
 * Günlüğe yalnız hata iletisi, işlem adı ve çağrı yığını girer; şifre, kişisel veri ya da işlem argümanları YAZILMAZ.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const AZAMI_BOYUT = 1024 * 1024; // 1 MB; aşılınca eski dosya ".1" olur (en çok 2 dosya tutulur)

let klasor = '';
export function gunlukKlasoruAyarla(k: string) { klasor = k; }
export function gunlukDosyasi(): string {
  return path.join(klasor, `hata-${os.hostname().replace(/[^\w.-]/g, '_')}.log`);
}

/** Yığın/iletilerdeki olası gizli bilgiyi (e-posta, uzun rakam dizisi = T.C. no vb.) maskeler */
export function maskele(s: string): string {
  return s.replace(/\b\d{11}\b/g, '***********').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***@***');
}

export function hataYaz(kaynak: string, e: unknown): void {
  try {
    if (!klasor) return;
    fs.mkdirSync(klasor, { recursive: true });
    const f = gunlukDosyasi();
    try {
      if (fs.existsSync(f) && fs.statSync(f).size > AZAMI_BOYUT) fs.renameSync(f, f + '.1');
    } catch { /* döndürme başarısızsa sürdür */ }
    const err = e as any;
    const satir = `[${new Date().toISOString()}] ${kaynak}: ${maskele(String(err?.message ?? err))}\n${maskele(String(err?.stack ?? '').split('\n').slice(1, 6).join('\n'))}\n`;
    fs.appendFileSync(f, satir, 'utf8');
  } catch { /* günlük yazılamıyorsa uygulama etkilenmesin */ }
}

/** Teknik (veritabanı / dosya sistemi) hataları kullanıcıya anlaşılır biçimde gösterilir. Kendi doğrulama iletilerimiz aynen geçer. */
const TEKNIK = /constraint failed|SQLITE|sqlite|no such (table|column)|syntax error|database disk image|malformed|Atomics|\b(EPERM|EBUSY|ENOENT|EACCES|ENOSPC|EMFILE|ENETUNREACH|ENETDOWN|ETIMEDOUT|EIO)\b|is not a function|Cannot read prop|undefined|RangeError|TypeError|ReferenceError/;

export function kullaniciMesaji(e: unknown): { mesaj: string; teknik: boolean } {
  const m = String((e as any)?.message ?? e ?? 'Bilinmeyen hata');
  if (!TEKNIK.test(m)) return { mesaj: m, teknik: false };
  let ipucu = 'Beklenmeyen bir hata oluştu. İşlemi tekrar deneyin; sürerse yöneticinize bildirin.';
  if (/EPERM|EACCES/.test(m)) ipucu = 'Dosyaya erişim izni yok. Veri klasörünün yazma iznini kontrol edin.';
  else if (/ENOSPC/.test(m)) ipucu = 'Diskte yer kalmamış. Boş yer açıp tekrar deneyin.';
  else if (/ENETUNREACH|ENETDOWN|ETIMEDOUT|EIO|EBUSY/.test(m)) ipucu = 'Ağ klasörüne şu an ulaşılamıyor veya dosya meşgul. Bağlantıyı kontrol edip tekrar deneyin.';
  else if (/constraint failed/.test(m)) ipucu = 'Girilen değer kabul edilmedi (eksik ya da geçersiz alan). Bilgileri kontrol edip tekrar deneyin.';
  else if (/malformed|disk image/.test(m)) ipucu = 'Veritabanı dosyası zarar görmüş olabilir. Yedekten geri yükleme gerekebilir.';
  return { mesaj: ipucu, teknik: true };
}
