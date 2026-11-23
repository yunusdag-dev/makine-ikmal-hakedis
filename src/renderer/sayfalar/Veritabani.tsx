import React, { useEffect, useState } from 'react';
import { Database, Download, RotateCcw, FolderOpen, FileUp, ShieldCheck, Lock } from 'lucide-react';
import { api, kopru, coz } from '../lib/api';
import { useBaglam } from '../lib/baglam';
import { Alan, Modal, useBildirim, useOnay } from '../ui/temel';
import { ayAdi, zamanTR } from '../lib/bicim';

export default function Veritabani() {
  const { oturum, yonetici, yenile, setAy, acikOturumlar } = useBaglam();
  const [yedekler, setYedekler] = useState<any[]>([]);
  const [ist, setIst] = useState<any>(null);
  const [aktar, setAktar] = useState<{ kurum: string; firma: string; yalnizKartlar?: boolean } | null>(null);
  const [rapor, setRapor] = useState<any>(null);
  const [mesgul, setMesgul] = useState(false);
  const bildir = useBildirim();
  const onay = useOnay();
  const salt = oturum.saltOkunur;
  const yukle = async () => {
    const [y, i] = await Promise.all([api<any[]>('yedekler'), api<any>('istatistik')]);
    setYedekler(y); setIst(i);
  };
  useEffect(() => { yukle(); }, []);

  const yedekAl = async () => {
    try { const p = await api<string>('yedekAl'); bildir('ok', 'Yedek alındı.', [{ ad: 'Klasörde göster', fn: () => kopru.klasordeGoster(p) }]); yukle(); }
    catch (e: any) { bildir('hata', e.message); }
  };
  const geriYukle = async (y: any) => {
    if (!(await onay({ baslik: 'Yedekten geri yükle', metin: `"${y.ad}" yedeği geri yüklenecek.\nMevcut veriler önce otomatik yedeklenir, sonra seçilen yedekle değiştirilir.`, evet: 'Geri yükle', tehlike: true }))) return;
    try { await api('yedektenYukle', y.yol); bildir('ok', 'Yedek geri yüklendi.'); await yenile(); yukle(); } catch (e: any) { bildir('hata', e.message); }
  };
  const iceAktar = async () => {
    if (!aktar?.kurum) { bildir('hata', 'Kurum puantaj dosyasını seçin.'); return; }
    if (!(await onay({ baslik: "Excel'den içe aktar", metin: aktar.yalnizKartlar
      ? "Excel'deki araç ve sürücü kayıtları eklenecek / güncellenecek. Puantaj ve aylık girişlere dokunulmaz. İşlemden önce otomatik yedek alınır."
      : 'Dosyadaki ayın mevcut puantaj kayıtları (aynı sürücüler için) silinip Excel\'deki verilerle değiştirilecek.\nAraç ve sürücü kartları güncellenecek / eklenecek. İşlemden önce otomatik yedek alınır.', evet: 'İçe aktar' }))) return;
    setMesgul(true);
    try {
      await api('yedekAl');
      const r = coz(await kopru.excelIceAktar({ kurum: aktar.kurum, firma: aktar.firma || null, yalnizKartlar: !!aktar.yalnizKartlar }));
      setRapor(r);
      setAktar(null);
      if (!aktar.yalnizKartlar) setAy(r.ay);
      await yenile();
      yukle();
    } catch (e: any) { bildir('hata', e.message); }
    finally { setMesgul(false); }
  };
  const dosya = async (alan: 'kurum' | 'firma') => {
    const r = coz(await kopru.dosyaSec({ baslik: alan === 'kurum' ? 'Kurum puantaj dosyası (ör. Ağustos 2026.xlsx)' : 'Firma hakediş dosyası', filtre: [{ name: 'Excel', extensions: ['xlsx', 'xlsm'] }] }));
    if (r) setAktar((a) => ({ kurum: a?.kurum ?? '', firma: a?.firma ?? '', [alan]: r }));
  };

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="izgara k2">
        <div className="kart">
          <div className="kart-b"><Database size={18} /><h3>Veritabanı</h3></div>
          <div className="kart-g izgara" style={{ gap: 10 }}>
            <div><div className="soluk kucuk-yazi">Dosya</div><div style={{ wordBreak: 'break-all' }}>{oturum.dosya}</div></div>
            <div className="satir">
              <button className="btn kucuk" onClick={() => kopru.klasordeGoster(oturum.dosya)}><FolderOpen size={14} /> Klasörü aç</button>
              <span className="rozet ok"><ShieldCheck size={12} /> Atomik kayıt + otomatik yedek</span>
            </div>
            <div><div className="soluk kucuk-yazi">Şu an açık oturumlar</div>
              {acikOturumlar.map((o) => <div key={o.makine + o.baslangic}><Lock size={12} style={{ visibility: 'hidden' }} /> {o.kullanici} · {o.makine} · {zamanTR(o.baslangic)} {o.ben && <span className="rozet mavi">siz</span>}</div>)}
            </div>
            {ist && <div className="satir" style={{ gap: 6 }}>
              <span className="rozet">{ist.arac} araç</span><span className="rozet">{ist.surucu} sürücü</span><span className="rozet">{ist.gunKaydi} gün kaydı</span>
              <span className="rozet">{ist.sefer} sefer</span><span className="rozet">{ist.kayit} değişiklik kaydı</span><span className="rozet">{ist.kullanici} kullanıcı</span>
            </div>}
            <div className="soluk kucuk-yazi" style={{ lineHeight: 1.6 }}>
              Her değişiklik anında diske atomik olarak yazılır (önce geçici dosya, sonra yer değiştirme); önceki sürüm ".bak" olarak tutulur.
              Açılışta ve her 2 saatte bir "yedekler" klasörüne zaman damgalı kopya alınır (son 60 yedek saklanır).
              Dosya standart SQLite biçimindedir; uygulama bozulsa bile herhangi bir SQLite aracıyla açılabilir.
              Birden fazla kişi aynı anda çalışabilir: her kayıt, diskteki en güncel veriye kısa bir yazma kilidiyle eklenir; ekranlar başkalarının değişikliklerini birkaç saniyede bir çeker.
            </div>
          </div>
        </div>
        <div className="kart">
          <div className="kart-b"><FileUp size={18} /><h3>Excel'den içe aktar</h3></div>
          <div className="kart-g izgara" style={{ gap: 10 }}>
            <div className="soluk" style={{ lineHeight: 1.55 }}>
              Mevcut Excel dosyalarınızı (kurum puantajı ve isteğe bağlı firma hakediş dosyası) uygulamaya aktarır: araçlar, sürücüler, o ayın günlük puantajı,
              tatiller ve firma dosyası seçilirse ücretler, endeksler, imzacılar, önceki KM, hizmet dışı günler, emekli/kümülatif matrah bilgileri.
              Aktarılan ay, Excel'deki rakamlarla kuruşu kuruşuna aynı hesaplanır.
            </div>
            <button className="btn birincil" style={{ alignSelf: 'start' }} disabled={salt || !yonetici} onClick={() => setAktar({ kurum: '', firma: '' })}><FileUp size={15} /> Dosyaları seç…</button>
            {!yonetici && <div className="soluk kucuk-yazi">İçe aktarma yalnız yöneticiler içindir.</div>}
          </div>
        </div>
      </div>
      <div className="kart">
        <div className="kart-b"><h3>Yedekler</h3><div className="bosluk" /><button className="btn" disabled={salt} onClick={yedekAl}><Download size={15} /> Şimdi yedek al</button></div>
        <div className="tablo-sar" style={{ maxHeight: 420 }}>
          <table className="tablo">
            <thead><tr><th>Yedek dosyası</th><th>Tarih</th><th className="sayi">Boyut</th><th></th></tr></thead>
            <tbody>
              {yedekler.map((y) => (
                <tr key={y.yol}>
                  <td>{y.ad}</td><td>{zamanTR(y.tarih)}</td><td className="sayi">{Math.round(y.boyut / 1024)} KB</td>
                  <td className="sag">
                    <button className="btn kucuk hayalet" onClick={() => kopru.klasordeGoster(y.yol)}><FolderOpen size={13} /></button>
                    <button className="btn kucuk" disabled={salt || !yonetici} title={yonetici ? '' : 'Yalnız yönetici'} onClick={() => geriYukle(y)}><RotateCcw size={13} /> Geri yükle</button>
                  </td>
                </tr>
              ))}
              {!yedekler.length && <tr><td colSpan={4} className="soluk" style={{ padding: 16 }}>Henüz yedek yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {aktar && (
        <Modal baslik="Excel'den içe aktar" kapat={() => setAktar(null)} boyut="genis"
          alt={<><button className="btn" onClick={() => setAktar(null)}>Vazgeç</button><button className="btn birincil" disabled={mesgul || !aktar.kurum} onClick={iceAktar}>{mesgul ? 'Aktarılıyor…' : 'İçe aktar'}</button></>}>
          <div className="izgara" style={{ gap: 14 }}>
            <Alan etiket="Kurum puantaj dosyası *" ipucu="Giriş, plaka sayfaları, Sürücü Puantaj, HAKEDİŞ içeren dosya (ör. Ağustos 2026.xlsx)">
              <div className="satir" style={{ flexWrap: 'nowrap' }}><input className="girdi" readOnly value={aktar.kurum} placeholder="seçilmedi" /><button className="btn" onClick={() => dosya('kurum')}>Seç…</button></div>
            </Alan>
            <label className="onay"><input type="checkbox" checked={!!aktar.yalnizKartlar} onChange={(e) => setAktar({ ...aktar, yalnizKartlar: e.target.checked })} /> Yalnız araç ve sürücü kayıtlarını aktar (puantaj, aylık girişler ve parametreler aktarılmaz)</label>
            <Alan etiket="Firma hakediş dosyası (isteğe bağlı)" ipucu="Giriş, ÖN TABLO, plaka formları, Sürücü Faaliyet içeren dosya">
              <div className="satir" style={{ flexWrap: 'nowrap' }}><input className="girdi" readOnly value={aktar.firma} placeholder="seçilmedi" /><button className="btn" onClick={() => dosya('firma')}>Seç…</button></div>
            </Alan>
          </div>
        </Modal>
      )}
      {rapor && (
        <Modal baslik={`İçe aktarma tamamlandı — ${ayAdi(rapor.ay)}`} kapat={() => setRapor(null)} boyut="genis" alt={<button className="btn birincil" onClick={() => setRapor(null)}>Tamam</button>}>
          <div className="satir" style={{ gap: 6, marginBottom: 12 }}>
            <span className="rozet ok">{rapor.aracEklenen} araç eklendi</span><span className="rozet">{rapor.aracGuncellenen} araç güncellendi</span>
            <span className="rozet ok">{rapor.surucuEklenen} sürücü eklendi</span><span className="rozet">{rapor.surucuGuncellenen} sürücü güncellendi</span>
            <span className="rozet mavi">{rapor.gunKaydi} gün kaydı</span><span className="rozet mavi">{rapor.sefer} sefer</span><span className="rozet">{rapor.tatil} yeni tatil</span>
            {rapor.parametre && <span className="rozet ok">{ayAdi(rapor.ay)} parametre sürümü oluşturuldu</span>}
          </div>
          {rapor.notlar.length > 0 && (
            <>
              <div className="bolum-baslik">Notlar ({rapor.notlar.length})</div>
              <div className="uyari-liste" style={{ maxHeight: 340, overflow: 'auto' }}>{rapor.notlar.map((n: string, i: number) => <div key={i} className="uyari-oge bilgi">{n}</div>)}</div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
