/**
 * Kurulum paketine konacak "hazır başlangıç veritabanını" üretir:
 *   araçlar + sürücüler + sürücü-araç atamaları + parametreler + tatiller  (puantaj, kullanıcı hesabı, değişiklik kaydı YOK)
 * Kullanım: node scripts/hazir-veri.mjs "<kurum.xlsx>" "<firma.xlsx>"
 * Çıktı: hazir-veri/hakedis.db  (gerçek kişi adları içerir; .gitignore ile repodan hariç)
 */
import fs from 'node:fs';
import path from 'node:path';
import { Store } from '../electron/store';
import { Api } from '../electron/api';
import { excelIceAktar } from '../electron/importDb';

const [kurum, firma, wasm, cikti] = process.argv.slice(2);
(async () => {
  const tmpDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'tohum-'));
  const db = path.join(tmpDir, 'hakedis.db');
  const s = new Store(db);
  await s.ac(wasm, { kullanici: 'Hazır veri' });
  const api = new Api(s);
  await excelIceAktar(s, kurum, firma, api.parametreler('2026-08'));
  s.tx(() => {
    // Hazır veriye yalnız "tanımlar" kalır
    for (const t of ['surucu_gunleri', 'seferler', 'arac_aylari', 'surucu_aylari', 'donemler', 'degisiklik_kaydi', 'kullanicilar'])
      s.run(`DELETE FROM ${t}`);
    s.run("DELETE FROM meta WHERE anahtar IN ('kurtarma','son_degistiren')");
    s.run("UPDATE meta SET deger='0' WHERE anahtar='surum'");
    // Parametreler: Ağustos 2026 Excel değerleri tek sürüm olarak en baştan geçerli
    s.run("DELETE FROM parametreler WHERE gecerlilik='2026-01'");
    s.run("UPDATE parametreler SET gecerlilik='2026-01', aciklama='İlk kurulum (Ağustos 2026 Excel değerleri)' WHERE gecerlilik='2026-08'");
    s.run("UPDATE surucu_arac_atamalari SET olusturan='ilk kurulum'");
    // Yeni kural: sürücü çalıştığı her gün (dış görev / konaklama günleri dahil) yemek ve yol alır
    const pr = s.get<{ veri: string }>("SELECT veri FROM parametreler WHERE gecerlilik='2026-01'")!;
    const pj = JSON.parse(pr.veri);
    pj.puantaj = { ...pj.puantaj, disGorevdeYemekYol: true };
    s.run("UPDATE parametreler SET veri=? WHERE gecerlilik='2026-01'", [JSON.stringify(pj)]);
  });
  const say = (t: string) => s.get<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`)!.n;
  const ozet = { arac: say('araclar'), surucu: say('suruculer'), atama: say('surucu_arac_atamalari'), parametre: say('parametreler'), tatil: say('tatiller'), kullanici: say('kullanicilar'), gun: say('surucu_gunleri') };
  s.kapat();
  fs.mkdirSync(path.dirname(cikti), { recursive: true });
  fs.copyFileSync(db, cikti);
  console.log('hazır veri:', cikti, JSON.stringify(ozet));
})().catch((e) => { console.error('HATA', e); process.exit(1); });
