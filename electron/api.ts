/**
 * Ana süreç veri API'si. Arayüz yalnız bu metotları IPC ile çağırır.
 * Her değişiklik: işlem (transaction) + değişiklik kaydı (kim/ne zaman/ne) + atomik dosya kaydı.
 */
import os from 'node:os';
import { Store } from './store';
import { etkinParams } from '../src/engine/ozellik';
import { tarihKontrol, ayKontrol, sayiKontrol, metinKontrol, gunKontrol, tcMaske, tcMaskeleyici } from './dogrulama';
import { Params, paramsTamamla } from '../src/engine/params';
import type { Tatil } from '../src/engine/calendar';
import { DonemVerisi, donemHesapla, DonemSonucu, ayinGunleri } from '../src/engine/donem';
import type { AracSefer, Durum, SurucuGun } from '../src/engine/types';

const b = (x: any) => (x ? 1 : 0);
const nn = (x: any) => (x === '' || x === undefined || x === null || Number.isNaN(Number(x)) ? null : Number(x));

export function oncekiAy(ay: string): string {
  const [y, m] = ay.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export interface AracRow {
  id: number; plaka: string; marka_model: string; model_yili: number | null; arac_tipi: string; gorev_yeri: string;
  tuketim_orani: number; kira_bedeli: number; yakit_yansitma_carpani: number; baslangic_km: number | null;
  sira: number; aktif: number; notlar: string;
}
export interface SurucuRow {
  id: number; ad_soyad: string; tc_no: string; telefon: string; varsayilan_arac_id: number | null; ucret_grubu: 'surucu' | 'operator';
  emekli: number; yol_hakki: number; ise_giris: string; isten_cikis: string; sira: number; aktif: number; notlar: string;
}

export class Api {
  constructor(public store: Store) {}

  private get s() { return this.store; }

  private kayit(islem: string, varlik: string, id: any, ozet: string, once?: any, sonra?: any) {
    this.s.run(
      'INSERT INTO degisiklik_kaydi (kullanici, makine, islem, varlik, varlik_id, ozet, once, sonra) VALUES (?,?,?,?,?,?,?,?)',
      [this.s.kullanici, os.hostname(), islem, varlik, String(id ?? ''), ozet, once === undefined ? null : JSON.stringify(once, tcMaskeleyici), sonra === undefined ? null : JSON.stringify(sonra, tcMaskeleyici)],
    );
  }

  private donemKapaliMi(ay: string): boolean {
    return this.s.get<{ durum: string }>('SELECT durum FROM donemler WHERE ay=?', [ay])?.durum === 'kapali';
  }
  private donemAcikOlmali(tarihVeyaAy: string) {
    const ay = tarihVeyaAy.slice(0, 7);
    if (this.donemKapaliMi(ay)) throw new Error(`${ay} dönemi kapatılmış. Değişiklik için önce dönemi açın (Hakediş ekranı).`);
  }

  // ------------------------------------------------------------- oturum
  oturum() {
    return {
      kullanici: this.s.kullanici,
      kullaniciId: this.s.kullaniciId,
      rol: this.s.rol,
      dosya: this.s.dosya,
      saltOkunur: this.s.saltOkunur,
      sonKayit: this.s.sonKayit?.toISOString() ?? null,
      makine: os.hostname(),
    };
  }

  /** Arayüzün birkaç saniyede bir yokladığı değişiklik bilgisi + açık oturumlar */
  surumBilgisi() {
    if (Date.now() - this.oturumOnbellekZaman > 15_000) { this.oturumOnbellek = this.s.acikOturumlar(); this.oturumOnbellekZaman = Date.now(); }
    return { ...this.s.surumBilgisi(), oturumlar: this.oturumOnbellek };
  }
  private oturumOnbellek: ReturnType<Store['acikOturumlar']> = [];
  private oturumOnbellekZaman = 0;

  // ------------------------------------------------------------- araçlar
  araclar(): AracRow[] {
    return this.s.all<AracRow>('SELECT * FROM araclar ORDER BY aktif DESC, sira, plaka');
  }

  aracKaydet(a: Partial<AracRow>): number {
    const plaka = String(a.plaka ?? '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
    if (!plaka) throw new Error('Plaka boş olamaz.');
    metinKontrol(plaka, 'Plaka', 20);
    sayiKontrol(a.kira_bedeli ?? 0, 'Kira bedeli', 0, 100_000_000);
    sayiKontrol(a.tuketim_orani ?? 0, 'Tüketim oranı', 0, 1000);
    sayiKontrol(a.yakit_yansitma_carpani ?? 1, 'Yakıt yansıtma çarpanı', 0, 100);
    sayiKontrol(a.model_yili, 'Model yılı', 1950, 2100);
    sayiKontrol(a.baslangic_km, 'Başlangıç KM', 0, 9_999_999);
    return this.s.tx(() => {
      const ayni = this.s.get<AracRow>('SELECT * FROM araclar WHERE plaka=? AND id<>?', [plaka, a.id ?? 0]);
      if (ayni) throw new Error(`${plaka} plakalı araç zaten kayıtlı.`);
      const v = [
        plaka, a.marka_model ?? '', nn(a.model_yili), a.arac_tipi ?? '', a.gorev_yeri ?? '', Number(a.tuketim_orani ?? 0),
        Number(a.kira_bedeli ?? 0), Number(a.yakit_yansitma_carpani ?? 1), nn(a.baslangic_km), Number(a.sira ?? 0), a.aktif === 0 ? 0 : 1, a.notlar ?? '',
      ];
      if (a.id) {
        const once = this.s.get('SELECT * FROM araclar WHERE id=?', [a.id]);
        this.s.run(
          `UPDATE araclar SET plaka=?, marka_model=?, model_yili=?, arac_tipi=?, gorev_yeri=?, tuketim_orani=?, kira_bedeli=?,
           yakit_yansitma_carpani=?, baslangic_km=?, sira=?, aktif=?, notlar=? WHERE id=?`, [...v, a.id]);
        this.kayit('güncelle', 'araç', a.id, plaka, once, a);
        return a.id;
      }
      const maxSira = this.s.get<{ m: number }>('SELECT COALESCE(MAX(sira),0)+1 AS m FROM araclar')!.m;
      v[9] = a.sira ?? maxSira;
      const { lastId } = this.s.run(
        `INSERT INTO araclar (plaka, marka_model, model_yili, arac_tipi, gorev_yeri, tuketim_orani, kira_bedeli, yakit_yansitma_carpani, baslangic_km, sira, aktif, notlar)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, v);
      this.kayit('ekle', 'araç', lastId, plaka, undefined, a);
      return lastId;
    });
  }

  aracSil(id: number) {
    return this.s.tx(() => {
      const once = this.s.get<AracRow>('SELECT * FROM araclar WHERE id=?', [id]);
      const kullanim = this.s.get<{ n: number }>('SELECT COUNT(*) n FROM seferler WHERE arac_id=?', [id])!.n;
      if (kullanim > 0) {
        this.s.run('UPDATE araclar SET aktif=0 WHERE id=?', [id]);
        this.kayit('pasifleştir', 'araç', id, `${once?.plaka} (${kullanim} sefer kaydı olduğu için silinmedi, pasif yapıldı)`, once);
        return { silindi: false, pasif: true };
      }
      this.s.run('DELETE FROM araclar WHERE id=?', [id]);
      this.kayit('sil', 'araç', id, once?.plaka ?? '', once);
      return { silindi: true, pasif: false };
    });
  }

  // ------------------------------------------------------------- sürücüler
  // ------------------------------------------------------------- sürücü-araç atamaları (dönem bazlı)
  /** Tüm atamalar (sürücü, başlangıç ayı sıralı) */
  atamalar(): { id: number; surucu_id: number; baslangic: string; arac_id: number | null; olusturan: string; olusturma: string }[] {
    return this.s.all('SELECT * FROM surucu_arac_atamalari ORDER BY surucu_id, baslangic');
  }

  /** Bir sürücünün belirli bir ay için aracı: o aydan önce/o ay başlayan en son atama. Kayıt hiç yoksa kart değeri. */
  private atamaCoz(surucuId: number, ay: string, tumu: { surucu_id: number; baslangic: string; arac_id: number | null }[], kart: number | null): number | null {
    let secilen: { arac_id: number | null } | null = null;
    let var_ = false;
    for (const a of tumu) {
      if (a.surucu_id !== surucuId) continue;
      var_ = true;
      if (a.baslangic <= ay) secilen = a;   // liste baslangic sıralı: sonuncusu kazanır
    }
    if (secilen) return secilen.arac_id;
    return var_ ? null : kart;
  }

  /** suruculer.varsayilan_arac_id = en son (en büyük başlangıçlı) atama: listelerde "güncel araç" göstermek için */
  private atamaSenkron(surucuId: number) {
    const son = this.s.get<{ arac_id: number | null }>('SELECT arac_id FROM surucu_arac_atamalari WHERE surucu_id=? ORDER BY baslangic DESC LIMIT 1', [surucuId]);
    this.s.run('UPDATE suruculer SET varsayilan_arac_id=? WHERE id=?', [son ? son.arac_id : null, surucuId]);
  }

  /** "baslangic ayından itibaren" sürücüye araç ata (aracId null = aracı yok). Geçmiş aylar etkilenmez. */
  atamaKaydet(surucuId: number, baslangic: string, aracId: number | null) {
    if (!/^\d{4}-\d{2}$/.test(baslangic)) throw new Error('Başlangıç ayı YYYY-AA biçiminde olmalı.');
    return this.s.tx(() => {
      const s = this.s.get<{ ad_soyad: string }>('SELECT ad_soyad FROM suruculer WHERE id=?', [surucuId]);
      if (!s) throw new Error('Sürücü bulunamadı.');
      const arac = aracId ? this.s.get<{ plaka: string }>('SELECT plaka FROM araclar WHERE id=?', [aracId]) : null;
      if (aracId && !arac) throw new Error('Araç bulunamadı.');
      // başlangıç ayı kapalı bir dönemse hesaplar değişir: engelle
      for (const d of this.s.all<{ ay: string }>("SELECT ay FROM donemler WHERE durum='kapali' AND ay >= ?", [baslangic])) {
        throw new Error(`${d.ay} dönemi kapalı. Atama değişikliği kapalı dönemlerin hesabını değiştirir; önce dönemi açın veya başlangıç ayını ${d.ay} sonrasına alın.`);
      }
      const once = this.s.get<any>('SELECT * FROM surucu_arac_atamalari WHERE surucu_id=? AND baslangic=?', [surucuId, baslangic]);
      this.s.run(
        `INSERT INTO surucu_arac_atamalari (surucu_id, baslangic, arac_id, olusturan) VALUES (?,?,?,?)
         ON CONFLICT(surucu_id, baslangic) DO UPDATE SET arac_id=excluded.arac_id, olusturan=excluded.olusturan, olusturma=datetime('now','localtime')`,
        [surucuId, baslangic, aracId, this.s.kullanici]);
      this.atamaSenkron(surucuId);
      this.kayit('atama', 'sürücü-araç', surucuId, `${s.ad_soyad}: ${baslangic} ayından itibaren → ${arac?.plaka ?? 'araç yok'}`, once, { baslangic, aracId });
    });
  }

  atamaSil(id: number) {
    return this.s.tx(() => {
      const a = this.s.get<any>('SELECT a.*, s.ad_soyad FROM surucu_arac_atamalari a JOIN suruculer s ON s.id=a.surucu_id WHERE a.id=?', [id]);
      if (!a) return;
      const sayi = this.s.get<{ n: number }>('SELECT COUNT(*) n FROM surucu_arac_atamalari WHERE surucu_id=?', [a.surucu_id])!.n;
      if (sayi <= 1) throw new Error('Sürücünün en az bir atama kaydı kalmalı; araç değiştirmek için yeni atama ekleyin.');
      for (const d of this.s.all<{ ay: string }>("SELECT ay FROM donemler WHERE durum='kapali' AND ay >= ?", [a.baslangic])) {
        throw new Error(`${d.ay} dönemi kapalı; bu atamayı silmek kapalı dönemin hesabını değiştirir.`);
      }
      this.s.run('DELETE FROM surucu_arac_atamalari WHERE id=?', [id]);
      this.atamaSenkron(a.surucu_id);
      this.kayit('atama sil', 'sürücü-araç', a.surucu_id, `${a.ad_soyad}: ${a.baslangic} atamasi silindi`, a);
    });
  }

  /** T.C. kimlik no listede maskeli döner; tam değer yalnız surucuTcGoster ile (denetim kaydıyla) alınır */
  suruculer(): SurucuRow[] {
    return this.s.all<SurucuRow>('SELECT * FROM suruculer ORDER BY aktif DESC, sira, ad_soyad').map((x) => ({ ...x, tc_no: tcMaske(x.tc_no) }));
  }

  /** Bir sürücünün tam T.C. kimlik numarasını gösterir; her görüntüleme Değişiklik Kaydı'na yazılır. İzleyici göremez. */
  surucuTcGoster(id: number): string {
    if (this.s.rol === 'izleyici' || this.s.saltOkunur) throw new Error('T.C. kimlik numarasını görmek için yetkiniz yok.');
    const r = this.s.get<{ ad_soyad: string; tc_no: string }>('SELECT ad_soyad, tc_no FROM suruculer WHERE id=?', [id]);
    if (!r) throw new Error('Sürücü bulunamadı.');
    this.s.tx(() => this.kayit('T.C. görüntüle', 'sürücü', id, `${r.ad_soyad} — T.C. kimlik no görüntülendi`));
    return r.tc_no;
  }

  surucuKaydet(d: Partial<SurucuRow>): number {
    const ad = String(d.ad_soyad ?? '').trim().replace(/\s+/g, ' ');
    if (!ad) throw new Error('Ad soyad boş olamaz.');
    metinKontrol(ad, 'Ad soyad', 100);
    if (d.tc_no && !String(d.tc_no).includes('*') && !/^\d{11}$/.test(String(d.tc_no))) throw new Error('T.C. kimlik no 11 haneli rakam olmalı.');
    metinKontrol(d.telefon, 'Telefon', 30);
    metinKontrol(d.notlar, 'Not', 1000);
    for (const [al, et] of [[d.ise_giris, 'İşe giriş tarihi'], [d.isten_cikis, 'İşten çıkış tarihi']] as const) if (al) tarihKontrol(al, et);
    return this.s.tx(() => {
      const v = [
        ad, String(d.tc_no ?? '').includes('*') ? '' : d.tc_no ?? '', d.telefon ?? '', nn(d.varsayilan_arac_id), d.ucret_grubu === 'operator' ? 'operator' : 'surucu',
        b(d.emekli), d.yol_hakki === 0 ? 0 : 1, d.ise_giris ?? '', d.isten_cikis ?? '', Number(d.sira ?? 0), d.aktif === 0 ? 0 : 1, d.notlar ?? '',
      ];
      if (d.id) {
        const once = this.s.get<any>('SELECT * FROM suruculer WHERE id=?', [d.id]);
        v[3] = once?.varsayilan_arac_id ?? null; // araç, "atama geçmişi" üzerinden (dönem bazlı) değiştirilir
        if (String(d.tc_no ?? '').includes('*')) v[1] = once?.tc_no ?? ''; // maskeli gelirse değişmemiş demektir: gerçek değer korunur
        this.s.run(
          `UPDATE suruculer SET ad_soyad=?, tc_no=?, telefon=?, varsayilan_arac_id=?, ucret_grubu=?, emekli=?, yol_hakki=?, ise_giris=?,
           isten_cikis=?, sira=?, aktif=?, notlar=? WHERE id=?`, [...v, d.id]);
        this.kayit('güncelle', 'sürücü', d.id, ad, once, d);
        return d.id;
      }
      const maxSira = this.s.get<{ m: number }>('SELECT COALESCE(MAX(sira),0)+1 AS m FROM suruculer')!.m;
      v[9] = d.sira ?? maxSira;
      const { lastId } = this.s.run(
        `INSERT INTO suruculer (ad_soyad, tc_no, telefon, varsayilan_arac_id, ucret_grubu, emekli, yol_hakki, ise_giris, isten_cikis, sira, aktif, notlar)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, v);
      if (d.varsayilan_arac_id) this.s.run("INSERT INTO surucu_arac_atamalari (surucu_id, baslangic, arac_id, olusturan) VALUES (?,?,?,?)", [lastId, '2000-01', d.varsayilan_arac_id, this.s.kullanici]);
      this.kayit('ekle', 'sürücü', lastId, ad, undefined, d);
      return lastId;
    });
  }

  surucuSil(id: number) {
    return this.s.tx(() => {
      const once = this.s.get<SurucuRow>('SELECT * FROM suruculer WHERE id=?', [id]);
      const n = this.s.get<{ n: number }>('SELECT COUNT(*) n FROM surucu_gunleri WHERE surucu_id=?', [id])!.n;
      if (n > 0) {
        this.s.run('UPDATE suruculer SET aktif=0 WHERE id=?', [id]);
        this.kayit('pasifleştir', 'sürücü', id, `${once?.ad_soyad} (${n} günlük kaydı olduğu için silinmedi, pasif yapıldı)`, once);
        return { silindi: false, pasif: true };
      }
      this.s.run('DELETE FROM suruculer WHERE id=?', [id]);
      this.kayit('sil', 'sürücü', id, once?.ad_soyad ?? '', once);
      return { silindi: true, pasif: false };
    });
  }

  siraKaydet(tablo: 'araclar' | 'suruculer', idler: number[]) {
    return this.s.tx(() => {
      idler.forEach((id, i) => this.s.run(`UPDATE ${tablo === 'araclar' ? 'araclar' : 'suruculer'} SET sira=? WHERE id=?`, [i + 1, id]));
      this.kayit('sırala', tablo === 'araclar' ? 'araç' : 'sürücü', '', `${idler.length} kayıt yeniden sıralandı`);
    });
  }

  // ------------------------------------------------------------- tatiller
  tatiller(yil?: number): (Tatil & { id: number })[] {
    if (yil) return this.s.all('SELECT * FROM tatiller WHERE tarih LIKE ? ORDER BY tarih', [`${yil}-%`]);
    return this.s.all('SELECT * FROM tatiller ORDER BY tarih');
  }

  tatilKaydet(t: { id?: number; tarih: string; tur: string; ad: string }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.tarih)) throw new Error('Tarih YYYY-AA-GG biçiminde olmalı.');
    if (!['RT', 'RTA', 'DB', 'DBA'].includes(t.tur)) throw new Error('Geçersiz tatil türü.');
    return this.s.tx(() => {
      if (t.id) {
        const once = this.s.get('SELECT * FROM tatiller WHERE id=?', [t.id]);
        this.s.run('UPDATE tatiller SET tarih=?, tur=?, ad=? WHERE id=?', [t.tarih, t.tur, t.ad, t.id]);
        this.kayit('güncelle', 'tatil', t.id, `${t.tarih} ${t.ad}`, once, t);
        return t.id;
      }
      const { lastId } = this.s.run('INSERT INTO tatiller (tarih, tur, ad) VALUES (?,?,?)', [t.tarih, t.tur, t.ad]);
      this.kayit('ekle', 'tatil', lastId, `${t.tarih} ${t.ad}`, undefined, t);
      return lastId;
    });
  }

  tatilSil(id: number) {
    return this.s.tx(() => {
      const once = this.s.get<any>('SELECT * FROM tatiller WHERE id=?', [id]);
      this.s.run('DELETE FROM tatiller WHERE id=?', [id]);
      this.kayit('sil', 'tatil', id, `${once?.tarih} ${once?.ad}`, once);
    });
  }

  // ------------------------------------------------------------- parametreler
  parametreSurumleri() {
    return this.s.all<{ id: number; gecerlilik: string; aciklama: string; guncelleme: string }>(
      'SELECT id, gecerlilik, aciklama, guncelleme FROM parametreler ORDER BY gecerlilik DESC');
  }

  parametreSurumu(id: number) {
    const r = this.s.get<any>('SELECT * FROM parametreler WHERE id=?', [id]);
    return r ? { ...r, veri: paramsTamamla(JSON.parse(r.veri)) } : null;
  }

  /** Belirli bir ay için geçerli parametreler */
  parametreler(ay: string): Params {
    const r = this.s.get<{ veri: string }>('SELECT veri FROM parametreler WHERE gecerlilik<=? ORDER BY gecerlilik DESC LIMIT 1', [ay])
      ?? this.s.get<{ veri: string }>('SELECT veri FROM parametreler ORDER BY gecerlilik ASC LIMIT 1');
    // Kapalı ödeme kalemlerinin birim ücretleri sıfırlanmış ("etkin") hal: hesap, ekran ve Excel çıktıları bunu kullanır.
    // Ayarlar ekranı ham değerleri parametreSurumu ile okur.
    return etkinParams(paramsTamamla(r ? JSON.parse(r.veri) : undefined));
  }

  parametreKaydet(gecerlilik: string, veri: Params, aciklama: string) {
    if (!/^\d{4}-\d{2}$/.test(gecerlilik)) throw new Error('Geçerlilik ayı YYYY-AA biçiminde olmalı.');
    return this.s.tx(() => {
      const once = this.s.get<any>('SELECT * FROM parametreler WHERE gecerlilik=?', [gecerlilik]);
      if (once) {
        this.s.run("UPDATE parametreler SET veri=?, aciklama=?, guncelleme=datetime('now','localtime') WHERE id=?", [JSON.stringify(veri), aciklama, once.id]);
        this.kayit('güncelle', 'parametre', gecerlilik, aciklama, JSON.parse(once.veri), veri);
      } else {
        this.s.run('INSERT INTO parametreler (gecerlilik, veri, aciklama) VALUES (?,?,?)', [gecerlilik, JSON.stringify(veri), aciklama]);
        this.kayit('ekle', 'parametre', gecerlilik, aciklama, undefined, veri);
      }
    });
  }

  parametreSil(id: number) {
    return this.s.tx(() => {
      const n = this.s.get<{ n: number }>('SELECT COUNT(*) n FROM parametreler')!.n;
      if (n <= 1) throw new Error('En az bir parametre sürümü bulunmalı.');
      const once = this.s.get<any>('SELECT * FROM parametreler WHERE id=?', [id]);
      this.s.run('DELETE FROM parametreler WHERE id=?', [id]);
      this.kayit('sil', 'parametre', once?.gecerlilik, once?.aciklama ?? '', once ? JSON.parse(once.veri) : undefined);
    });
  }

  // ------------------------------------------------------------- günlük puantaj
  surucuAyi(surucuId: number, ay: string) {
    const gunler = this.s.all<any>('SELECT * FROM surucu_gunleri WHERE surucu_id=? AND tarih LIKE ? ORDER BY tarih', [surucuId, `${ay}-%`]);
    const seferler = this.s.all<any>('SELECT * FROM seferler WHERE surucu_id=? AND tarih LIKE ? ORDER BY tarih, id', [surucuId, `${ay}-%`]);
    return { gunler, seferler };
  }

  aracAyi(aracId: number, ay: string) {
    return this.s.all<any>(
      `SELECT s.*, d.ad_soyad FROM seferler s LEFT JOIN suruculer d ON d.id=s.surucu_id
       WHERE s.arac_id=? AND s.tarih LIKE ? ORDER BY s.tarih, s.km_cikis, s.id`, [aracId, `${ay}-%`]);
  }

  /**
   * Bir sürücünün bir gününü (sürücü alanları + o günkü tüm araç seferleri) tek işlemde kaydeder.
   */
  gunKaydet(surucuId: number, tarih: string, gun: any, seferler: any[]) {
    gunKontrol(tarih, gun, seferler);
    this.donemAcikOlmali(tarih);
    return this.s.tx(() => {
      const once = {
        gun: this.s.get('SELECT * FROM surucu_gunleri WHERE surucu_id=? AND tarih=?', [surucuId, tarih]),
        seferler: this.s.all('SELECT * FROM seferler WHERE surucu_id=? AND tarih=?', [surucuId, tarih]),
      };
      const bos = !gun || (!gun.durum && !gun.fazla_mesai && !gun.hafta_tatili && !gun.resmi_tatil && !gun.dis_gorev && !gun.konaklama
        && gun.yemek_override == null && gun.yol_override == null && !gun.notlar && !gun.cikis_saat && !gun.donus_saat);
      this.s.run('DELETE FROM surucu_gunleri WHERE surucu_id=? AND tarih=?', [surucuId, tarih]);
      if (!bos) {
        this.s.run(
          `INSERT INTO surucu_gunleri (surucu_id, tarih, durum, fazla_mesai, hafta_tatili, resmi_tatil, dis_gorev, konaklama, yemek_override, yol_override, cikis_saat, donus_saat, notlar)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [surucuId, tarih, gun.durum ?? '', Number(gun.fazla_mesai || 0), b(gun.hafta_tatili), Number(gun.resmi_tatil || 0), Number(gun.dis_gorev || 0),
            b(gun.konaklama), gun.yemek_override == null ? null : b(gun.yemek_override), gun.yol_override == null ? null : b(gun.yol_override),
            gun.cikis_saat ?? '', gun.donus_saat ?? '', gun.notlar ?? ''],
        );
      }
      this.s.run('DELETE FROM seferler WHERE surucu_id=? AND tarih=?', [surucuId, tarih]);
      for (const x of seferler ?? []) {
        if (!x.arac_id) continue;
        if (!this.s.get('SELECT id FROM araclar WHERE id=?', [x.arac_id])) throw new Error('Seçilen araç bulunamadı.');
        this.s.run(
          `INSERT INTO seferler (tarih, surucu_id, arac_id, km_cikis, km_donus, arac_ig, arac_igd, gorevli, gorev_yeri) VALUES (?,?,?,?,?,?,?,?,?)`,
          [tarih, surucuId, x.arac_id, nn(x.km_cikis), nn(x.km_donus), b(x.arac_ig), Number(x.arac_igd || 0), x.gorevli ?? '', x.gorev_yeri ?? ''],
        );
      }
      const ad = this.s.get<{ ad_soyad: string }>('SELECT ad_soyad FROM suruculer WHERE id=?', [surucuId])?.ad_soyad ?? '';
      this.kayit('puantaj', 'günlük kayıt', `${surucuId}/${tarih}`, `${ad} ${tarih}`, once, { gun, seferler });
    });
  }

  /** Bir sürücünün tüm ayına toplu işlem (ör. "iş günlerini X ile doldur") */
  ayTopluKaydet(surucuId: number, ay: string, kayitlar: { tarih: string; gun: any; seferler: any[] }[], aciklama: string) {
    ayKontrol(ay);
    for (const k of kayitlar ?? []) {
      gunKontrol(k.tarih, k.gun, k.seferler);
      if (!String(k.tarih).startsWith(ay + '-')) throw new Error(`Kayıt tarihi (${k.tarih}) seçilen ayın (${ay}) dışında: tarih geçersiz.`);
    }
    this.donemAcikOlmali(ay);
    return this.s.tx(() => {
      for (const k of kayitlar) {
        this.s.run('DELETE FROM surucu_gunleri WHERE surucu_id=? AND tarih=?', [surucuId, k.tarih]);
        const g = k.gun;
        if (g && (g.durum || g.fazla_mesai || g.hafta_tatili || g.resmi_tatil || g.dis_gorev || g.konaklama || g.yemek_override != null || g.yol_override != null || g.notlar)) {
          this.s.run(
            `INSERT INTO surucu_gunleri (surucu_id, tarih, durum, fazla_mesai, hafta_tatili, resmi_tatil, dis_gorev, konaklama, yemek_override, yol_override, cikis_saat, donus_saat, notlar)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [surucuId, k.tarih, g.durum ?? '', Number(g.fazla_mesai || 0), b(g.hafta_tatili), Number(g.resmi_tatil || 0), Number(g.dis_gorev || 0),
              b(g.konaklama), g.yemek_override == null ? null : b(g.yemek_override), g.yol_override == null ? null : b(g.yol_override),
              g.cikis_saat ?? '', g.donus_saat ?? '', g.notlar ?? ''],
          );
        }
        this.s.run('DELETE FROM seferler WHERE surucu_id=? AND tarih=?', [surucuId, k.tarih]);
        for (const x of k.seferler ?? []) {
          if (!x.arac_id) continue;
          this.s.run(
            `INSERT INTO seferler (tarih, surucu_id, arac_id, km_cikis, km_donus, arac_ig, arac_igd, gorevli, gorev_yeri) VALUES (?,?,?,?,?,?,?,?,?)`,
            [k.tarih, surucuId, x.arac_id, nn(x.km_cikis), nn(x.km_donus), b(x.arac_ig), Number(x.arac_igd || 0), x.gorevli ?? '', x.gorev_yeri ?? ''],
          );
        }
      }
      const ad = this.s.get<{ ad_soyad: string }>('SELECT ad_soyad FROM suruculer WHERE id=?', [surucuId])?.ad_soyad ?? '';
      this.kayit('puantaj (toplu)', 'günlük kayıt', `${surucuId}/${ay}`, `${ad} ${ay}: ${aciklama} (${kayitlar.length} gün)`);
    });
  }

  // ------------------------------------------------------------- aylık girdiler (Aşama 2)
  aylikGirdiler(ay: string) {
    return {
      araclar: this.s.all<any>('SELECT * FROM arac_aylari WHERE ay=?', [ay]),
      suruculer: this.s.all<any>('SELECT * FROM surucu_aylari WHERE ay=?', [ay]),
    };
  }

  /** v: yalnız değişen alanlar gönderilebilir; diğer alanlar veritabanındaki güncel değerden alınır */
  aracAyKaydet(aracId: number, ay: string, degisen: any) {
    ayKontrol(ay);
    const dg = degisen ?? {};
    sayiKontrol(dg.hizmet_disi_gun, 'Hizmet dışı gün', 0, 31);
    sayiKontrol(dg.km_duzeltme, 'KM düzeltme', -9_999_999, 9_999_999);
    sayiKontrol(dg.onceki_km, 'Önceki KM', 0, 9_999_999);
    sayiKontrol(dg.kira_bedeli, 'Kira bedeli', 0, 100_000_000);
    sayiKontrol(dg.tuketim_orani, 'Tüketim oranı', 0, 1000);
    sayiKontrol(dg.yakit_yansitma_carpani, 'Yakıt yansıtma çarpanı', 0, 100);
    metinKontrol(dg.km_duzeltme_aciklama, 'Açıklama', 500);
    this.donemAcikOlmali(ay);
    return this.s.tx(() => {
      const once = this.s.get<any>('SELECT * FROM arac_aylari WHERE arac_id=? AND ay=?', [aracId, ay]);
      const v = { onceki_km: null, hizmet_disi_gun: 0, km_duzeltme: 0, km_duzeltme_aciklama: '', kira_bedeli: null, tuketim_orani: null, yakit_yansitma_carpani: null, ...(once ?? {}), ...degisen };
      this.s.run(
        `INSERT INTO arac_aylari (arac_id, ay, onceki_km, hizmet_disi_gun, km_duzeltme, km_duzeltme_aciklama, kira_bedeli, tuketim_orani, yakit_yansitma_carpani)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(arac_id, ay) DO UPDATE SET onceki_km=excluded.onceki_km, hizmet_disi_gun=excluded.hizmet_disi_gun, km_duzeltme=excluded.km_duzeltme,
           km_duzeltme_aciklama=excluded.km_duzeltme_aciklama, kira_bedeli=excluded.kira_bedeli, tuketim_orani=excluded.tuketim_orani,
           yakit_yansitma_carpani=excluded.yakit_yansitma_carpani`,
        [aracId, ay, nn(v.onceki_km), Number(v.hizmet_disi_gun || 0), Number(v.km_duzeltme || 0), v.km_duzeltme_aciklama ?? '', nn(v.kira_bedeli), nn(v.tuketim_orani), nn(v.yakit_yansitma_carpani)],
      );
      const plaka = this.s.get<{ plaka: string }>('SELECT plaka FROM araclar WHERE id=?', [aracId])?.plaka;
      this.kayit('aylık giriş', 'araç ayı', `${aracId}/${ay}`, `${plaka} ${ay}`, once, v);
    });
  }

  surucuAyKaydet(surucuId: number, ay: string, degisen: any) {
    ayKontrol(ay);
    const dg = degisen ?? {};
    sayiKontrol(dg.hizmet_disi_gun, 'Hizmet dışı gün', 0, 31);
    sayiKontrol(dg.fazla_mesai_duzeltme, 'Fazla mesai düzeltme', -744, 744);
    sayiKontrol(dg.konaklama_birim_fiyat, 'Konaklama birim fiyatı', 0, 10_000_000);
    sayiKontrol(dg.kumulatif_gvm, 'Kümülatif GV matrahı', 0, 10_000_000_000);
    sayiKontrol(dg.calisma_ayi, 'Çalışma ayı', 1, 12);
    sayiKontrol(dg.ozel_sigorta, 'Özel sigorta', 0, 10_000_000);
    this.donemAcikOlmali(ay);
    return this.s.tx(() => {
      const once = this.s.get<any>('SELECT * FROM surucu_aylari WHERE surucu_id=? AND ay=?', [surucuId, ay]);
      const v = { hizmet_disi_gun: 0, fazla_mesai_duzeltme: 0, konaklama_birim_fiyat: null, kumulatif_gvm: null, calisma_ayi: null, ozel_sigorta: 0, ...(once ?? {}), ...degisen };
      this.s.run(
        `INSERT INTO surucu_aylari (surucu_id, ay, hizmet_disi_gun, fazla_mesai_duzeltme, konaklama_birim_fiyat, kumulatif_gvm, calisma_ayi, ozel_sigorta)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(surucu_id, ay) DO UPDATE SET hizmet_disi_gun=excluded.hizmet_disi_gun, fazla_mesai_duzeltme=excluded.fazla_mesai_duzeltme,
           konaklama_birim_fiyat=excluded.konaklama_birim_fiyat, kumulatif_gvm=excluded.kumulatif_gvm, calisma_ayi=excluded.calisma_ayi,
           ozel_sigorta=excluded.ozel_sigorta`,
        [surucuId, ay, Number(v.hizmet_disi_gun || 0), Number(v.fazla_mesai_duzeltme || 0), nn(v.konaklama_birim_fiyat), nn(v.kumulatif_gvm), nn(v.calisma_ayi), Number(v.ozel_sigorta || 0)],
      );
      const ad = this.s.get<{ ad_soyad: string }>('SELECT ad_soyad FROM suruculer WHERE id=?', [surucuId])?.ad_soyad;
      this.kayit('aylık giriş', 'sürücü ayı', `${surucuId}/${ay}`, `${ad} ${ay}`, once, v);
    });
  }

  // ------------------------------------------------------------- dönem verisi + hesap
  private oncekiKmOtomatik(ay: string): Record<number, number> {
    const rows = this.s.all<{ arac_id: number; km: number }>(
      `SELECT arac_id, MAX(MAX(COALESCE(km_cikis,0), COALESCE(km_donus,0))) km FROM seferler WHERE tarih < ? GROUP BY arac_id`, [`${ay}-01`]);
    const o: Record<number, number> = {};
    for (const r of rows) if (r.km) o[r.arac_id] = r.km;
    return o;
  }

  private kumulatifOtomatik(ay: string, derinlik = 0): Record<number, number> {
    const [y, m] = ay.split('-').map(Number);
    if (m === 1 || derinlik > 12) return {};
    const onceki = oncekiAy(ay);
    const out: Record<number, number> = {};
    const kapali = this.donemKapaliMi(onceki);
    if (kapali) {
      for (const r of this.s.all<any>('SELECT surucu_id, kapanis_kumulatif_gvm FROM surucu_aylari WHERE ay=? AND kapanis_kumulatif_gvm IS NOT NULL', [onceki]))
        out[r.surucu_id] = r.kapanis_kumulatif_gvm;
      return out;
    }
    // önceki ayın hiç verisi yoksa ve elle kümülatif de yoksa zinciri derinleştirmeye gerek yok
    const veriVar = this.s.get<{ n: number }>('SELECT COUNT(*) n FROM surucu_gunleri WHERE tarih LIKE ?', [`${onceki}-%`])!.n
      + this.s.get<{ n: number }>('SELECT COUNT(*) n FROM surucu_aylari WHERE ay=?', [onceki])!.n;
    if (!veriVar) return y === Number(onceki.slice(0, 4)) ? this.kumulatifOtomatik(onceki, derinlik + 1) : {};
    const sonuc = donemHesapla(this.donemVerisiIc(onceki, derinlik + 1));
    for (const s of sonuc.firma.surucuFaaliyet) {
      const g = sonuc.giris.find((x) => x.key === s.key);
      if (g?.driverId != null) out[g.driverId] = s.AC_gvmYillik;
    }
    return out;
  }

  donemVerisi(ay: string): DonemVerisi {
    return this.donemVerisiIc(ay, 0);
  }

  private donemVerisiIc(ay: string, derinlik: number): DonemVerisi {
    const params = this.parametreler(ay);
    const [y] = ay.split('-').map(Number);
    const tatiller = this.s.all<any>('SELECT tarih, tur, ad FROM tatiller WHERE tarih BETWEEN ? AND ?', [`${y - 1}-01-01`, `${y + 1}-12-31`]);
    const ilk = `${ay}-01`, son = `${ay}-31`;
    const atamalar = this.atamalar();
    const suruculer = this.suruculer()
      .filter((s) => s.aktif || this.s.get<{ n: number }>('SELECT COUNT(*) n FROM surucu_gunleri WHERE surucu_id=? AND tarih BETWEEN ? AND ?', [s.id, ilk, son])!.n > 0)
      .map((s) => ({
        id: s.id, adSoyad: s.ad_soyad, varsayilanAracId: this.atamaCoz(s.id, ay, atamalar, s.varsayilan_arac_id), ucretGrubu: s.ucret_grubu, emekli: !!s.emekli,
        yolHakki: !!s.yol_hakki, sira: s.sira, aktif: !!s.aktif, iseGiris: s.ise_giris,
      }));
    const araclar = this.araclar()
      .filter((a) => a.aktif || this.s.get<{ n: number }>('SELECT COUNT(*) n FROM seferler WHERE arac_id=? AND tarih BETWEEN ? AND ?', [a.id, ilk, son])!.n > 0)
      .map((a) => ({
        id: a.id, plaka: a.plaka, markaModel: a.marka_model, modelYili: a.model_yili, aracTipi: a.arac_tipi, gorevYeri: a.gorev_yeri,
        tuketimOrani: a.tuketim_orani, kiraBedeli: a.kira_bedeli, yakitYansitmaCarpani: a.yakit_yansitma_carpani, sira: a.sira, aktif: !!a.aktif,
        baslangicKm: a.baslangic_km,
      }));
    const surucuGunleri: SurucuGun[] = this.s.all<any>('SELECT * FROM surucu_gunleri WHERE tarih BETWEEN ? AND ?', [ilk, son]).map((g) => ({
      driverId: g.surucu_id, tarih: g.tarih, durum: g.durum as Durum, fazlaMesai: g.fazla_mesai, haftaTatili: !!g.hafta_tatili,
      resmiTatil: g.resmi_tatil, disGorev: g.dis_gorev, konaklama: !!g.konaklama,
      yemekOverride: g.yemek_override == null ? null : !!g.yemek_override, yolOverride: g.yol_override == null ? null : !!g.yol_override,
    }));
    const seferler: AracSefer[] = this.s.all<any>('SELECT * FROM seferler WHERE tarih BETWEEN ? AND ? ORDER BY tarih, id', [ilk, son]).map((x) => ({
      driverId: x.surucu_id, vehicleId: x.arac_id, tarih: x.tarih, kmCikis: x.km_cikis, kmDonus: x.km_donus, aracIG: !!x.arac_ig, aracIGD: x.arac_igd,
    }));
    const aracAylari: DonemVerisi['aracAylari'] = {};
    for (const r of this.s.all<any>('SELECT * FROM arac_aylari WHERE ay=?', [ay])) {
      aracAylari[r.arac_id] = {
        oncekiKm: r.onceki_km, hizmetDisiGun: r.hizmet_disi_gun, kmDuzeltme: r.km_duzeltme, kmDuzeltmeAciklama: r.km_duzeltme_aciklama,
        kiraBedeli: r.kira_bedeli, tuketimOrani: r.tuketim_orani, yakitYansitmaCarpani: r.yakit_yansitma_carpani,
      };
    }
    const surucuAylari: DonemVerisi['surucuAylari'] = {};
    for (const r of this.s.all<any>('SELECT * FROM surucu_aylari WHERE ay=?', [ay])) {
      surucuAylari[r.surucu_id] = {
        hizmetDisiGun: r.hizmet_disi_gun, fazlaMesaiDuzeltme: r.fazla_mesai_duzeltme, konaklamaBirimFiyat: r.konaklama_birim_fiyat,
        kumulatifGvm: r.kumulatif_gvm, calismaAyi: r.calisma_ayi, ozelSigorta: r.ozel_sigorta,
      };
    }
    return {
      ay, params, tatiller, suruculer, araclar, surucuGunleri, seferler, aracAylari, surucuAylari,
      oncekiKmOtomatik: this.oncekiKmOtomatik(ay),
      oncekiKumulatifOtomatik: this.kumulatifOtomatik(ay, derinlik),
    };
  }

  hesapla(ay: string): DonemSonucu {
    return donemHesapla(this.donemVerisi(ay));
  }

  // ------------------------------------------------------------- dönem kapatma
  donemler() {
    return this.s.all<any>('SELECT * FROM donemler ORDER BY ay DESC');
  }

  donemDurumu(ay: string) {
    return this.s.get<any>('SELECT * FROM donemler WHERE ay=?', [ay]) ?? { ay, durum: 'acik' };
  }

  donemKapat(ay: string) {
    const sonuc = this.hesapla(ay);
    if (sonuc.veriYok) throw new Error(`${ay} için henüz puantaj girilmemiş; boş dönem kapatılamaz.`);
    const hatalar = sonuc.uyarilar.filter((u) => u.seviye === 'hata');
    if (hatalar.length) throw new Error(`Dönem kapatılamaz, ${hatalar.length} hata var:\n` + hatalar.slice(0, 5).map((h) => '• ' + h.mesaj).join('\n'));
    return this.s.tx(() => {
      for (const s of sonuc.firma.surucuFaaliyet) {
        const g = sonuc.giris.find((x) => x.key === s.key);
        if (g?.driverId == null) continue;
        this.s.run(
          `INSERT INTO surucu_aylari (surucu_id, ay, kapanis_kumulatif_gvm) VALUES (?,?,?)
           ON CONFLICT(surucu_id, ay) DO UPDATE SET kapanis_kumulatif_gvm=excluded.kapanis_kumulatif_gvm`, [g.driverId, ay, s.AC_gvmYillik]);
      }
      for (const g of sonuc.giris) {
        if (g.vehicleId == null || !g.aracVar) continue;
        // önceki KM'yi sabitle (sonraki ay açılışı otomatik hesaplanır; kayıt amaçlı)
        this.s.run(
          `INSERT INTO arac_aylari (arac_id, ay, onceki_km) VALUES (?,?,?) ON CONFLICT(arac_id, ay) DO UPDATE SET onceki_km=COALESCE(arac_aylari.onceki_km, excluded.onceki_km)`,
          [g.vehicleId, ay, g.oncekiKm]);
      }
      this.s.run(
        `INSERT INTO donemler (ay, durum, kapatan, kapanis_zamani) VALUES (?, 'kapali', ?, datetime('now','localtime'))
         ON CONFLICT(ay) DO UPDATE SET durum='kapali', kapatan=excluded.kapatan, kapanis_zamani=excluded.kapanis_zamani`, [ay, this.s.kullanici]);
      this.kayit('dönem kapat', 'dönem', ay, `${ay} kapatıldı. Fatura toplamı: ${sonuc.firma.fatura.faturaToplami.toFixed(2)} TL, net maaş toplamı: ${sonuc.firma.bordroToplam.toFixed(2)} TL`);
    });
  }

  donemAc(ay: string) {
    return this.s.tx(() => {
      this.s.run(`INSERT INTO donemler (ay, durum) VALUES (?, 'acik') ON CONFLICT(ay) DO UPDATE SET durum='acik'`, [ay]);
      this.kayit('dönem aç', 'dönem', ay, `${ay} yeniden düzenlemeye açıldı`);
    });
  }

  // ------------------------------------------------------------- kayıtlar / yedek
  kayitlar(f: { arama?: string; limit?: number; offset?: number }) {
    const q = `%${f.arama ?? ''}%`;
    return this.s.all<any>(
      `SELECT id, zaman, kullanici, makine, islem, varlik, varlik_id, ozet FROM degisiklik_kaydi
       WHERE (? = '%%' OR ozet LIKE ? OR kullanici LIKE ? OR varlik LIKE ? OR islem LIKE ?)
       ORDER BY id DESC LIMIT ? OFFSET ?`, [q, q, q, q, q, f.limit ?? 200, f.offset ?? 0]);
  }

  kayitDetay(id: number) {
    return this.s.get<any>('SELECT * FROM degisiklik_kaydi WHERE id=?', [id]);
  }

  yedekler() {
    return this.s.yedekler();
  }

  yedekAl() {
    const p = this.s.yedekAl('elle');
    if (!p) throw new Error('Yedek alınamadı.');
    this.s.tx(() => this.kayit('yedek', 'veritabanı', '', `Elle yedek: ${p}`));
    return p;
  }

  yedektenYukle(yol: string) {
    this.s.yedektenYukle(yol, () => this.kayit('geri yükle', 'veritabanı', '', `Yedekten geri yüklendi: ${yol}`));
  }

  istatistik() {
    const n = (sql: string) => this.s.get<{ n: number }>(sql)!.n;
    return {
      arac: n('SELECT COUNT(*) n FROM araclar WHERE aktif=1'),
      surucu: n('SELECT COUNT(*) n FROM suruculer WHERE aktif=1'),
      gunKaydi: n('SELECT COUNT(*) n FROM surucu_gunleri'),
      sefer: n('SELECT COUNT(*) n FROM seferler'),
      kayit: n('SELECT COUNT(*) n FROM degisiklik_kaydi'),
      kullanici: n('SELECT COUNT(*) n FROM kullanicilar WHERE aktif=1 AND sifre_hash IS NOT NULL'),
      sonAylar: this.s.all<{ ay: string; n: number }>("SELECT substr(tarih,1,7) ay, COUNT(*) n FROM surucu_gunleri GROUP BY ay ORDER BY ay DESC LIMIT 12"),
    };
  }

  ayinGunleri(ay: string) {
    return ayinGunleri(ay);
  }
}
