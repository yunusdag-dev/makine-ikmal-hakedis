/**
 * Mevcut Excel dosyalarını veritabanına aktarır.
 * Kurum puantaj dosyası: araç/sürücü listesi, günlük puantaj, tatiller.
 * Firma hakediş dosyası (isteğe bağlı): araç marka/kira/tüketim, önceki KM, hizmet dışı günler,
 *   parametreler (ücretler, endeksler, imzacılar), bordro bilgileri (emekli, kümülatif matrah, çalışma ayı).
 * Aktarım sonrası uygulamanın hesapladığı ay, firma dosyasındaki rakamlarla birebir aynı olur.
 */
import ExcelJS from 'exceljs';
import os from 'node:os';
import { Store } from './store';
import { cv, parseFirma, parseKurum, plakaKey } from '../src/importer/excelImport';
import { yemekOtomatik } from '../src/engine/kurum';
import { Params, paramsTamamla } from '../src/engine/params';

export interface AktarimRaporu {
  ay: string;
  aracEklenen: number;
  aracGuncellenen: number;
  surucuEklenen: number;
  surucuGuncellenen: number;
  gunKaydi: number;
  sefer: number;
  tatil: number;
  parametre: boolean;
  notlar: string[];
}

function tipDuzelt(t: string): string {
  return t.replace(/KAMTONET/g, 'KAMYONET');
}

/** opts.yalnizKartlar: yalnız araç ve sürücü kayıtları (puantaj, aylık girişler, parametreler aktarılmaz) */
export async function excelIceAktar(store: Store, kurumYol: string, firmaYol: string | null, mevcutParams: Params, opts: { yalnizKartlar?: boolean } = {}): Promise<AktarimRaporu> {
  const kwb = new ExcelJS.Workbook();
  await kwb.xlsx.readFile(kurumYol);
  const kurum = parseKurum(kwb);
  let firma: ReturnType<typeof parseFirma> | null = null;
  if (firmaYol) {
    const fwb = new ExcelJS.Workbook();
    await fwb.xlsx.readFile(firmaYol);
    firma = parseFirma(fwb);
  }
  const ay = `${kurum.yil}-${String(kurum.ay).padStart(2, '0')}`;
  if (firma && firma.hakedisTarihi && firma.hakedisTarihi.slice(0, 7) !== ay) {
    throw new Error(`Dosyaların ayı uyuşmuyor: kurum ${ay}, firma ${firma.hakedisTarihi.slice(0, 7)}`);
  }
  const rapor: AktarimRaporu = { ay, aracEklenen: 0, aracGuncellenen: 0, surucuEklenen: 0, surucuGuncellenen: 0, gunKaydi: 0, sefer: 0, tatil: 0, parametre: false, notlar: [] };
  const firmaByPlaka = new Map((firma?.satirlar ?? []).map((s) => [plakaKey(s.plaka), s]));

  // Tatiller (kurum 'Tatil' gizli sayfası)
  const tatiller: { tarih: string; tur: string; ad: string }[] = [];
  const T = kwb.getWorksheet('Tatil');
  if (T) {
    for (let r = 5; r <= 400; r++) {
      const add = (col: string, tur: string, adCol?: string, adSabit?: string) => {
        const v = cv(T, `${col}${r}`);
        if (v instanceof Date) tatiller.push({ tarih: v.toISOString().slice(0, 10), tur, ad: adCol ? String(cv(T, `${adCol}${r}`) ?? '') : adSabit ?? '' });
      };
      add('B', 'RT', 'C'); add('D', 'RTA', undefined, 'Cumhuriyet Bayramı Arifesi'); add('G', 'DB', 'H'); add('I', 'DBA', 'J');
    }
  }

  const kartlar = !!opts.yalnizKartlar;
  store.tx(() => {
    if (!kartlar) for (const t of tatiller) {
      const r = store.run('INSERT OR IGNORE INTO tatiller (tarih, tur, ad) VALUES (?,?,?)', [t.tarih, t.tur, t.tur === 'DBA' && t.ad && !/arife/i.test(t.ad) ? `${t.ad} Arifesi` : t.ad]);
      rapor.tatil += r.changes;
    }

    // Parametreler (firma dosyası varsa o ay için sürüm)
    if (firma && !kartlar) {
      const p = paramsTamamla(firma.params);
      p.kurum = { ...mevcutParams.kurum, ...p.kurum, firmaAdi: kurum.firmaAdi || p.kurum.firmaAdi };
      p.takvim = mevcutParams.takvim;
      store.run(
        `INSERT INTO parametreler (gecerlilik, veri, aciklama) VALUES (?,?,?)
         ON CONFLICT(gecerlilik) DO UPDATE SET veri=excluded.veri, aciklama=excluded.aciklama, guncelleme=datetime('now','localtime')`,
        [ay, JSON.stringify(p), `Excel'den aktarıldı (${ay})`]);
      rapor.parametre = true;
    }

    const aracId = new Map<string, number>();
    kurum.plakalar.forEach((kp, i) => {
      const f = firmaByPlaka.get(plakaKey(kp.plaka));
      const plaka = kp.plaka.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
      const mevcut = store.get<any>('SELECT * FROM araclar WHERE REPLACE(plaka,\' \',\'\')=?', [plakaKey(plaka)]);
      const tip = tipDuzelt(kp.aracTipi || f?.aracTipi || '');
      if (f) {
        if (f.aracTipi && tipDuzelt(f.aracTipi) !== tip) rapor.notlar.push(`${plaka}: araç tipi kurum dosyasında "${tip}", firma dosyasında "${f.aracTipi}" — kurum değeri kullanıldı.`);
        if (f.gorevYeri && f.gorevYeri !== kp.gorevYeri) rapor.notlar.push(`${plaka}: görev yeri kurum "${kp.gorevYeri}", firma "${f.gorevYeri}" — kurum değeri kullanıldı.`);
        if (f.modelYili && kp.modelYili && f.modelYili !== kp.modelYili) rapor.notlar.push(`${plaka}: model yılı kurum ${kp.modelYili}, firma ${f.modelYili} — kurum değeri kullanıldı.`);
      }
      const v = [plaka, f?.markaModel ?? mevcut?.marka_model ?? '', kp.modelYili ?? f?.modelYili ?? null, tip, kp.gorevYeri || f?.gorevYeri || '',
        f?.tuketimOrani ?? mevcut?.tuketim_orani ?? 0, f?.kiraBedeli ?? mevcut?.kira_bedeli ?? 0, i + 1];
      if (mevcut) {
        store.run('UPDATE araclar SET plaka=?, marka_model=?, model_yili=?, arac_tipi=?, gorev_yeri=?, tuketim_orani=?, kira_bedeli=?, sira=?, aktif=1 WHERE id=?', [...v, mevcut.id]);
        aracId.set(plakaKey(plaka), mevcut.id);
        rapor.aracGuncellenen++;
      } else {
        const { lastId } = store.run('INSERT INTO araclar (plaka, marka_model, model_yili, arac_tipi, gorev_yeri, tuketim_orani, kira_bedeli, sira) VALUES (?,?,?,?,?,?,?,?)', v);
        aracId.set(plakaKey(plaka), lastId);
        rapor.aracEklenen++;
      }
    });

    kurum.plakalar.forEach((kp, i) => {
      const f = firmaByPlaka.get(plakaKey(kp.plaka));
      const ad = kp.surucu.replace(/\s+/g, ' ').trim();
      if (!ad) return;
      const aid = aracId.get(plakaKey(kp.plaka))!;
      // Yol hakkı: otomatik yol hakkı olan her günde elle 0 yazılmışsa sürücü genelde yol almıyor demektir
      const otoGunler = kp.gunler.filter((g) => yemekOtomatik({ ...g, driverId: 0, yemekOverride: null, yolOverride: null } as any));
      const yolHakki = !(otoGunler.length > 0 && otoGunler.every((g) => g.yolElle === 0));
      const mevcut = store.get<any>('SELECT * FROM suruculer WHERE ad_soyad=?', [ad]);
      const grup = f?.ucretGrubu ?? 'surucu';
      let sid: number;
      if (mevcut) {
        store.run('UPDATE suruculer SET varsayilan_arac_id=?, ucret_grubu=?, emekli=?, yol_hakki=?, sira=?, aktif=1 WHERE id=?',
          [aid, grup, f ? (f.emekli ? 1 : 0) : mevcut.emekli, yolHakki ? 1 : 0, i + 1, mevcut.id]);
        sid = mevcut.id;
        rapor.surucuGuncellenen++;
      } else {
        sid = store.run('INSERT INTO suruculer (ad_soyad, varsayilan_arac_id, ucret_grubu, emekli, yol_hakki, sira) VALUES (?,?,?,?,?,?)',
          [ad, aid, grup, f?.emekli ? 1 : 0, yolHakki ? 1 : 0, i + 1]).lastId;
        rapor.surucuEklenen++;
      }
      if (kartlar) return;
      // dönem bazlı atama: hiç yoksa en baştan; farklıysa bu aydan itibaren
      const sonAtama = store.get<{ arac_id: number | null; baslangic: string }>('SELECT arac_id, baslangic FROM surucu_arac_atamalari WHERE surucu_id=? AND baslangic<=? ORDER BY baslangic DESC LIMIT 1', [sid, ay]);
      if (!store.get('SELECT 1 FROM surucu_arac_atamalari WHERE surucu_id=?', [sid])) {
        store.run("INSERT INTO surucu_arac_atamalari (surucu_id, baslangic, arac_id, olusturan) VALUES (?,?,?,?)", [sid, '2000-01', aid, store.kullanici]);
      } else if (!sonAtama || sonAtama.arac_id !== aid) {
        store.run("INSERT INTO surucu_arac_atamalari (surucu_id, baslangic, arac_id, olusturan) VALUES (?,?,?,?) ON CONFLICT(surucu_id, baslangic) DO UPDATE SET arac_id=excluded.arac_id", [sid, ay, aid, store.kullanici]);
        const gunc = store.get<{ arac_id: number | null }>('SELECT arac_id FROM surucu_arac_atamalari WHERE surucu_id=? ORDER BY baslangic DESC LIMIT 1', [sid]);
        store.run('UPDATE suruculer SET varsayilan_arac_id=? WHERE id=?', [gunc?.arac_id ?? null, sid]);
      }
      // Ayın mevcut kayıtlarını değiştir
      store.run('DELETE FROM surucu_gunleri WHERE surucu_id=? AND tarih LIKE ?', [sid, `${ay}-%`]);
      store.run('DELETE FROM seferler WHERE (surucu_id=? OR (surucu_id IS NULL AND arac_id=?)) AND tarih LIKE ?', [sid, aid, `${ay}-%`]);
      let fmToplam = 0;
      for (const g of kp.gunler) {
        const oto = yemekOtomatik({ ...g, driverId: sid, yemekOverride: null, yolOverride: null } as any);
        const yemekOv = g.yemekElle === null ? null : (g.yemekElle !== 0) === oto ? null : g.yemekElle !== 0;
        const yolOto = yolHakki && oto;
        const yolOv = g.yolElle === null ? (yolHakki ? null : oto ? 1 : null) : (g.yolElle !== 0) === yolOto ? null : g.yolElle !== 0;
        const notlar = g.not;
        const dolu = g.durum || g.fazlaMesai || g.haftaTatili || g.resmiTatil || g.disGorev || g.konaklama || yemekOv !== null || yolOv !== null || notlar || g.cikisSaat || g.donusSaat;
        fmToplam += g.fazlaMesai;
        if (dolu) {
          store.run(
            `INSERT INTO surucu_gunleri (surucu_id, tarih, durum, fazla_mesai, hafta_tatili, resmi_tatil, dis_gorev, konaklama, yemek_override, yol_override, cikis_saat, donus_saat, notlar)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [sid, g.tarih, g.durum, g.fazlaMesai, g.haftaTatili ? 1 : 0, g.resmiTatil, g.disGorev, g.konaklama ? 1 : 0,
              yemekOv === null ? null : yemekOv ? 1 : 0, yolOv === null ? null : yolOv ? 1 : 0, g.cikisSaat === '00:00' ? '' : g.cikisSaat, g.donusSaat === '00:00' ? '' : g.donusSaat, notlar]);
          rapor.gunKaydi++;
        }
        if (g.kmCikis != null || g.kmDonus != null || g.aracIG || g.aracIGD) {
          store.run(
            `INSERT INTO seferler (tarih, surucu_id, arac_id, km_cikis, km_donus, arac_ig, arac_igd, gorevli, gorev_yeri) VALUES (?,?,?,?,?,?,?,?,?)`,
            [g.tarih, sid, aid, g.kmCikis, g.kmDonus, g.aracIG ? 1 : 0, g.aracIGD, g.gorevli, g.gorevYeri]);
          rapor.sefer++;
        }
      }
      if (f) {
        store.run(
          `INSERT INTO arac_aylari (arac_id, ay, onceki_km, hizmet_disi_gun, km_duzeltme, km_duzeltme_aciklama, yakit_yansitma_carpani) VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(arac_id, ay) DO UPDATE SET onceki_km=excluded.onceki_km, hizmet_disi_gun=excluded.hizmet_disi_gun, km_duzeltme=excluded.km_duzeltme,
             km_duzeltme_aciklama=excluded.km_duzeltme_aciklama, yakit_yansitma_carpani=excluded.yakit_yansitma_carpani`,
          [aid, ay, f.oncekiKm, f.hizmetDisiGunArac, f.kmDuzeltme, f.kmDuzeltme ? "Excel'den aktarıldı (plaka formu G17 düzeltmesi)" : '', f.yakitYansitmaCarpani !== 1 ? f.yakitYansitmaCarpani : null]);
        const fmFark = Math.round((f.fazlaMesai - fmToplam) * 1000) / 1000;
        if (fmFark) rapor.notlar.push(`${ad}: firma dosyasındaki fazla mesai (${f.fazlaMesai}) puantajdan (${fmToplam}) farklı; fark ${fmFark > 0 ? '+' : ''}${fmFark} saat "fazla mesai düzeltmesi" olarak aktarıldı.`);
        store.run(
          `INSERT INTO surucu_aylari (surucu_id, ay, hizmet_disi_gun, fazla_mesai_duzeltme, konaklama_birim_fiyat, kumulatif_gvm, calisma_ayi, ozel_sigorta) VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(surucu_id, ay) DO UPDATE SET hizmet_disi_gun=excluded.hizmet_disi_gun, fazla_mesai_duzeltme=excluded.fazla_mesai_duzeltme,
             konaklama_birim_fiyat=excluded.konaklama_birim_fiyat, kumulatif_gvm=excluded.kumulatif_gvm, calisma_ayi=excluded.calisma_ayi, ozel_sigorta=excluded.ozel_sigorta`,
          [sid, ay, f.hizmetDisiGunSurucu, fmFark, f.konaklamaBirimFiyat, f.kumulatifGvm, f.calismaAyi, f.ozelSigorta]);
      }
    });

    store.run(
      'INSERT INTO degisiklik_kaydi (kullanici, makine, islem, varlik, varlik_id, ozet) VALUES (?,?,?,?,?,?)',
      [store.kullanici, os.hostname(), 'Excel içe aktar', 'dönem', ay,
        kartlar ? `Araç ve sürücü kayıtları: ${rapor.aracEklenen} araç eklendi, ${rapor.aracGuncellenen} güncellendi; ${rapor.surucuEklenen} sürücü eklendi, ${rapor.surucuGuncellenen} güncellendi`
          : `${ay}: ${rapor.aracEklenen + rapor.aracGuncellenen} araç, ${rapor.surucuEklenen + rapor.surucuGuncellenen} sürücü, ${rapor.gunKaydi} gün, ${rapor.sefer} sefer`]);
  });
  return rapor;
}
