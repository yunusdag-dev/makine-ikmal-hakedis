import fs from 'node:fs';
import path from 'node:path';

/**
 * İlk kurulumda veritabanı dosyası yoksa, kurulumla gelen hazır başlangıç verisini (araçlar, sürücüler, atamalar,
 * parametreler, tatiller; kullanıcı hesabı ve puantaj YOK) hedef konuma kopyalar.
 * @returns true: hazır veriyle oluşturuldu
 */
export function tohumdanOlustur(hedef: string, tohum: string): boolean {
  if (!hedef || fs.existsSync(hedef) || !fs.existsSync(tohum)) return false;
  fs.mkdirSync(path.dirname(hedef), { recursive: true });
  const tmp = `${hedef}.tohum-${process.pid}`;
  fs.copyFileSync(tohum, tmp);
  try {
    fs.renameSync(tmp, hedef); // başka bir bilgisayar aynı anda oluşturduysa üzerine yazmaz
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* */ }
    return false;
  }
  return true;
}
