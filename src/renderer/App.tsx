import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, Truck, Users, ClipboardList, Receipt, Wallet, FileSpreadsheet, Settings, Database, History, LogOut, Gauge, FolderOpen,
  Eye, KeyRound, ShieldCheck, UserCog, Copy, Monitor, ArrowLeft, ClipboardPen, RefreshCw,
} from 'lucide-react';
import ikon from './assets/ikon.png';
import { kopru, coz, ApiHata, kimlik } from './lib/api';
import { BaglamSaglayici, Oturum, useBaglam, ROL_AD } from './lib/baglam';
import { Alan, AySecici, Modal, useBildirim } from './ui/temel';
import { zamanTR, ayAdi } from './lib/bicim';
import Panel from './sayfalar/Panel';
import Puantaj from './sayfalar/Puantaj';
import AracHareket from './sayfalar/AracHareket';
import Suruculer from './sayfalar/Suruculer';
import Araclar from './sayfalar/Araclar';
import Asama2 from './sayfalar/Asama2';
import Hakedis from './sayfalar/Hakedis';
import Bordro from './sayfalar/Bordro';
import Ciktilar from './sayfalar/Ciktilar';
import Ayarlar from './sayfalar/Ayarlar';
import Veritabani from './sayfalar/Veritabani';
import Kayitlar from './sayfalar/Kayitlar';
import Kullanicilar from './sayfalar/Kullanicilar';
import GunlukKayit from './sayfalar/GunlukKayit';

type Sayfa = 'panel' | 'gunluk' | 'puantaj' | 'arac' | 'asama2' | 'hakedis' | 'bordro' | 'ciktilar' | 'suruculer' | 'araclar' | 'ayarlar' | 'veritabani' | 'kayitlar' | 'kullanicilar';

const MENU: { grup: string; ogeler: { id: Sayfa; ad: string; ikon: any; kisa?: string; tam?: boolean; yonetici?: boolean }[] }[] = [
  { grup: 'Günlük', ogeler: [
    { id: 'panel', ad: 'Genel Bakış', ikon: LayoutDashboard, kisa: 'F1' },
    { id: 'gunluk', ad: 'Günlük Kayıt Formu', ikon: ClipboardPen, kisa: 'F2' },
    { id: 'puantaj', ad: 'Sürücü Puantajı (aylık)', ikon: CalendarDays, kisa: 'F3', tam: true },
    { id: 'arac', ad: 'Araç Hareketleri', ikon: Gauge, kisa: 'F4', tam: true },
  ] },
  { grup: 'Hakediş', ogeler: [
    { id: 'asama2', ad: 'Hakediş Girişleri', ikon: ClipboardList, kisa: 'F5' },
    { id: 'hakedis', ad: 'Hakediş (Ön Tablo)', ikon: Receipt, kisa: 'F6' },
    { id: 'bordro', ad: 'Bordro / Net Maaş', ikon: Wallet, kisa: 'F7' },
    { id: 'ciktilar', ad: 'Excel / PDF Çıktılar', ikon: FileSpreadsheet, kisa: 'F8' },
  ] },
  { grup: 'Kayıtlar', ogeler: [
    { id: 'suruculer', ad: 'Sürücüler', ikon: Users, kisa: 'F9' },
    { id: 'araclar', ad: 'Araçlar', ikon: Truck },
  ] },
  { grup: 'Sistem', ogeler: [
    { id: 'ayarlar', ad: 'Ayarlar & Parametreler', ikon: Settings },
    { id: 'kullanicilar', ad: 'Kullanıcılar', ikon: UserCog, yonetici: true },
    { id: 'veritabani', ad: 'Veritabanı & Yedek', ikon: Database },
    { id: 'kayitlar', ad: 'Değişiklik Kaydı', ikon: History },
  ] },
];
const TUM = MENU.flatMap((g) => g.ogeler);

function SifreDegistir({ kapat, zorunlu }: { kapat: () => void; zorunlu?: boolean }) {
  const [eski, setEski] = useState('');
  const [yeni, setYeni] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [hata, setHata] = useState('');
  const bildir = useBildirim();
  const kaydet = async () => {
    setHata('');
    if (yeni.length < 6) { setHata('Yeni şifre en az 6 karakter olmalı.'); return; }
    if (yeni !== tekrar) { setHata('Yeni şifreler aynı değil.'); return; }
    try { await kimlik('sifremiDegistir', eski, yeni); bildir('ok', 'Şifreniz değiştirildi.'); kapat(); }
    catch (e: any) { setHata(e.message); }
  };
  return (
    <Modal baslik={zorunlu ? 'Yeni şifrenizi belirleyin' : 'Şifremi değiştir'} kapat={zorunlu ? () => {} : kapat} ikon={<KeyRound size={20} />}
      alt={<>{!zorunlu && <button className="btn" onClick={kapat}>Vazgeç</button>}<button className="btn birincil" onClick={kaydet}>Kaydet</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); kaydet(); }} className="izgara" style={{ gap: 12 }}>
        {zorunlu && <div className="uyari-oge bilgi">Hesabınıza yönetici tarafından geçici bir şifre atandı. Devam etmek için kendi şifrenizi belirleyin.</div>}
        <Alan etiket={zorunlu ? 'Geçici (mevcut) şifre' : 'Mevcut şifre'}><input type="password" className="girdi" autoFocus value={eski} onChange={(e) => setEski(e.target.value)} /></Alan>
        <Alan etiket="Yeni şifre" ipucu="En az 6 karakter"><input type="password" className="girdi" value={yeni} onChange={(e) => setYeni(e.target.value)} /></Alan>
        <Alan etiket="Yeni şifre (tekrar)"><input type="password" className="girdi" value={tekrar} onChange={(e) => setTekrar(e.target.value)} /></Alan>
        {hata && <div className="uyari-oge hata">{hata}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function Kabuk({ sifreZorunlu }: { sifreZorunlu: boolean }) {
  const { oturum, ay, setAy, kapali, cikis, yonetici, acikOturumlar, yenile, yukleniyor, sonuc } = useBaglam();
  const bildir = useBildirim();
  const [guncelleniyor, setGuncelleniyor] = useState(false);
  const guncelle = async () => {
    setGuncelleniyor(true);
    try {
      await yenile();
      bildir('ok', `${ayAdi(ay)} güncel verilerle yeniden hesaplandı.`);
    } catch (e: any) { bildir('hata', e.message); }
    finally { setGuncelleniyor(false); }
  };
  const [sayfa, setSayfa] = useState<Sayfa>(() => (localStorage.getItem('sayfa') as Sayfa) || 'panel');
  const [sifreModal, setSifreModal] = useState(sifreZorunlu);
  const [zorunlu, setZorunlu] = useState(sifreZorunlu);
  const git = (s: Sayfa) => { setSayfa(s); localStorage.setItem('sayfa', s); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const m = TUM.find((x) => x.kisa === e.key);
      if (m && !e.ctrlKey && !e.altKey) { e.preventDefault(); git(m.id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const gorunurSayfa = TUM.find((x) => x.id === sayfa && (!x.yonetici || yonetici)) ?? TUM[0];
  const ayGerekli = !['ayarlar', 'veritabani', 'kayitlar', 'kullanicilar'].includes(gorunurSayfa.id);
  const digerleri = acikOturumlar.filter((o) => !o.ben);
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <img className="brand-logo" src={ikon} alt="" width={40} height={40} />
          <div>
            <div className="brand-t">Makine İkmal</div>
            <div className="brand-s">Araç / Sürücü Hakediş</div>
          </div>
        </div>
        <nav className="nav">
          {MENU.map((g) => (
            <div key={g.grup}>
              <div className="nav-grup">{g.grup}</div>
              {g.ogeler.filter((o) => !o.yonetici || yonetici).map((o) => (
                <button key={o.id} className={gorunurSayfa.id === o.id ? 'aktif' : ''} onClick={() => git(o.id)}>
                  <o.ikon size={17} /> {o.ad} {o.kisa && <span className="kbd">{o.kisa}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-alt">
          <div><span className={`durum-nokta ${oturum.saltOkunur ? 'ro' : ''}`} /><b>{oturum.kullanici}</b></div>
          <div style={{ marginTop: 3 }}>{ROL_AD[oturum.rol]}{oturum.saltOkunur && <> · <Eye size={11} /></>}</div>
          {digerleri.length > 0 && (
            <div style={{ marginTop: 6 }} title={digerleri.map((o) => `${o.kullanici} — ${o.makine}`).join('\n')}>
              <Monitor size={11} style={{ verticalAlign: -1 }} /> Açık: {digerleri.map((o) => o.kullanici).join(', ')}
            </div>
          )}
          <div className="satir" style={{ gap: 2, marginTop: 8 }}>
            <button className="btn kucuk hayalet" style={{ color: '#c4cddc', paddingLeft: 0 }} onClick={() => { setZorunlu(false); setSifreModal(true); }}><KeyRound size={14} /> Şifrem</button>
            <button className="btn kucuk hayalet" style={{ color: '#c4cddc' }} onClick={cikis}><LogOut size={14} /> Çıkış</button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1>{gorunurSayfa.ad}</h1>
          <div className="bosluk" />
          {digerleri.length > 0 && <span className="rozet mavi" title={digerleri.map((o) => `${o.kullanici} — ${o.makine}`).join('\n')}><Users size={12} /> {digerleri.length + 1} kişi açık</span>}
          {oturum.saltOkunur && <span className="rozet uyari"><Eye size={12} /> Salt okunur</span>}
          {ayGerekli && <AySecici ay={ay} setAy={setAy} kapali={kapali} />}
          {ayGerekli && (
            <button className="btn" onClick={guncelle} disabled={guncelleniyor || yukleniyor} title="Seçili ayın verilerini yeniden yükle ve hesapla (başkalarının girdiği veriler dahil)">
              <RefreshCw size={15} className={guncelleniyor || yukleniyor ? 'don' : ''} /> Güncelle
            </button>
          )}
        </header>
        <div className={`icerik ${gorunurSayfa.tam ? 'tam' : ''}`}>
          {gorunurSayfa.id === 'panel' && <Panel git={git} />}
          {gorunurSayfa.id === 'gunluk' && <GunlukKayit />}
          {gorunurSayfa.id === 'puantaj' && <Puantaj />}
          {gorunurSayfa.id === 'arac' && <AracHareket />}
          {gorunurSayfa.id === 'asama2' && <Asama2 />}
          {gorunurSayfa.id === 'hakedis' && <Hakedis />}
          {gorunurSayfa.id === 'bordro' && <Bordro />}
          {gorunurSayfa.id === 'ciktilar' && <Ciktilar />}
          {gorunurSayfa.id === 'suruculer' && <Suruculer />}
          {gorunurSayfa.id === 'araclar' && <Araclar />}
          {gorunurSayfa.id === 'ayarlar' && <Ayarlar />}
          {gorunurSayfa.id === 'kullanicilar' && <Kullanicilar />}
          {gorunurSayfa.id === 'veritabani' && <Veritabani />}
          {gorunurSayfa.id === 'kayitlar' && <Kayitlar />}
        </div>
      </main>
      <div className="imza-yazi" aria-hidden="true">Developed by <b>Yunus Dağ</b></div>
      {sifreModal && <SifreDegistir zorunlu={zorunlu} kapat={() => { setSifreModal(false); setZorunlu(false); }} />}
    </div>
  );
}

// ------------------------------------------------------------ giriş
type Adim = 'yukleniyor' | 'db' | 'kurulum' | 'giris' | 'kurtar';

function GirisEkrani({ acildi }: { acildi: (o: Oturum, sifreZorunlu: boolean) => void }) {
  const [bas, setBas] = useState<any>(null);
  const [adim, setAdim] = useState<Adim>('yukleniyor');
  const [dbYolu, setDbYolu] = useState('');
  const [bagliDosya, setBagliDosya] = useState('');
  const [kullaniciAdi, setKullaniciAdi] = useState('');
  const [sifre, setSifre] = useState('');
  const [kurulum, setKurulum] = useState({ kullaniciAdi: '', ad: '', sifre: '', tekrar: '' });
  const [kurtar, setKurtar] = useState({ kod: '', kullaniciAdi: '', yeniSifre: '', tekrar: '' });
  const [kurtarmaKodu, setKurtarmaKodu] = useState<{ kod: string; oturum: Oturum } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [bozuk, setBozuk] = useState<any>(null);
  const [hata, setHata] = useState('');
  const bildir = useBildirim();

  const baglan = async (yol: string) => {
    setHata('');
    setMesgul(true);
    try {
      const r = coz(await kopru.dbBaglan(yol));
      setBagliDosya(r.dosya);
      setAdim(r.kurulumGerekli ? 'kurulum' : 'giris');
    } catch (e: any) {
      if (e instanceof ApiHata && e.kod === 'BOZUK') setBozuk(e.ek);
      setHata(e.message);
      setAdim('db');
    } finally {
      setMesgul(false);
    }
  };

  useEffect(() => {
    kopru.baslangic().then((r) => {
      const b = coz(r);
      if (b.oturum) { acildi(b.oturum, false); return; }
      setBas(b);
      setKullaniciAdi(b.sonKullanici || '');
      setDbYolu(b.dbYolu);
      // Bu bilgisayarda daha önce veritabanı seçilmediyse (ilk kurulum) önce konumu sorulur
      if (b.dbKayitli) baglan(b.dbYolu); else setAdim('db');
    });
  }, []);

  const girisYap = async () => {
    setHata('');
    if (!kullaniciAdi.trim() || !sifre) { setHata('Kullanıcı adı ve şifre giriniz.'); return; }
    setMesgul(true);
    try {
      const o = coz(await kopru.girisYap({ kullaniciAdi, sifre }));
      acildi(o, !!o.sifreDegistirmeli);
    } catch (e: any) { setHata(e.message); setSifre(''); }
    finally { setMesgul(false); }
  };
  const kurulumYap = async () => {
    setHata('');
    if (kurulum.sifre.length < 6) { setHata('Şifre en az 6 karakter olmalı.'); return; }
    if (kurulum.sifre !== kurulum.tekrar) { setHata('Şifreler aynı değil.'); return; }
    setMesgul(true);
    try {
      const r = coz(await kopru.ilkKurulum({ kullaniciAdi: kurulum.kullaniciAdi, ad: kurulum.ad, sifre: kurulum.sifre }));
      setKurtarmaKodu({ kod: r.kurtarmaKodu, oturum: r.oturum });
    } catch (e: any) { setHata(e.message); }
    finally { setMesgul(false); }
  };
  const kurtarYap = async () => {
    setHata('');
    if (kurtar.yeniSifre.length < 6) { setHata('Yeni şifre en az 6 karakter olmalı.'); return; }
    if (kurtar.yeniSifre !== kurtar.tekrar) { setHata('Şifreler aynı değil.'); return; }
    setMesgul(true);
    try {
      coz(await kopru.kurtar({ kod: kurtar.kod, kullaniciAdi: kurtar.kullaniciAdi, yeniSifre: kurtar.yeniSifre }));
      bildir('ok', 'Şifre sıfırlandı; hesap yönetici yapıldı. Yeni şifrenizle giriş yapın.');
      setKullaniciAdi(kurtar.kullaniciAdi);
      setSifre('');
      setAdim('giris');
    } catch (e: any) { setHata(e.message); }
    finally { setMesgul(false); }
  };

  if (!bas || adim === 'yukleniyor') return <div className="yukleniyor">Veritabanına bağlanılıyor…</div>;
  const dosyaKisa = bagliDosya || dbYolu;
  return (
    <div className="giris-ekran">
      <div className="imza-yazi" aria-hidden="true">Developed by <b>Yunus Dağ</b></div>
      <div className="giris-kart">
        <img className="logo" src={ikon} alt="Makine İkmal Hakediş" width={64} height={64} />
        <h1>Makine İkmal Hakediş</h1>
        <p>Araç / sürücü puantajı, hakediş ve bordro</p>

        {adim === 'giris' && (
          <form onSubmit={(e) => { e.preventDefault(); girisYap(); }} className="izgara" style={{ gap: 14 }}>
            <Alan etiket="Kullanıcı adı"><input className="girdi" autoFocus={!kullaniciAdi} value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} autoComplete="username" /></Alan>
            <Alan etiket="Şifre"><input type="password" className="girdi" autoFocus={!!kullaniciAdi} value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete="current-password" /></Alan>
            {hata && <div className="uyari-oge hata">{hata}</div>}
            <button className="btn birincil" style={{ height: 40, justifyContent: 'center' }} disabled={mesgul}>{mesgul ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
            <div className="satir ara kucuk-yazi">
              <a href="#" onClick={(e) => { e.preventDefault(); setHata(''); setAdim('db'); }}>Veritabanı: {dosyaKisa.split(/[\\/]/).slice(-2).join('\\')}</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setHata(''); setKurtar({ kod: '', kullaniciAdi, yeniSifre: '', tekrar: '' }); setAdim('kurtar'); }}>Şifremi unuttum</a>
            </div>
            <div className="soluk kucuk-yazi" style={{ textAlign: 'center' }}>Şifresini unutan kullanıcı, yöneticiden yeni şifre isteyebilir. Sürüm {bas.surum} · {bas.makine}</div>
          </form>
        )}

        {adim === 'kurulum' && (
          <form onSubmit={(e) => { e.preventDefault(); kurulumYap(); }} className="izgara" style={{ gap: 12 }}>
            <div className="uyari-oge bilgi"><ShieldCheck size={16} style={{ flex: 'none' }} /><span>Bu veritabanında henüz hesap yok. İlk <b>yönetici</b> hesabını oluşturun; diğer kullanıcıları içeride siz eklersiniz.</span></div>
            <Alan etiket="Ad soyad"><input className="girdi" autoFocus value={kurulum.ad} onChange={(e) => setKurulum({ ...kurulum, ad: e.target.value })} /></Alan>
            <Alan etiket="Kullanıcı adı" ipucu="ör. ahmet.yilmaz (boşluksuz)"><input className="girdi" value={kurulum.kullaniciAdi} onChange={(e) => setKurulum({ ...kurulum, kullaniciAdi: e.target.value })} /></Alan>
            <div className="izgara k2">
              <Alan etiket="Şifre" ipucu="En az 6 karakter"><input type="password" className="girdi" value={kurulum.sifre} onChange={(e) => setKurulum({ ...kurulum, sifre: e.target.value })} /></Alan>
              <Alan etiket="Şifre (tekrar)"><input type="password" className="girdi" value={kurulum.tekrar} onChange={(e) => setKurulum({ ...kurulum, tekrar: e.target.value })} /></Alan>
            </div>
            {hata && <div className="uyari-oge hata">{hata}</div>}
            <button className="btn birincil" style={{ height: 40, justifyContent: 'center' }} disabled={mesgul}>Yönetici hesabını oluştur</button>
            <a href="#" className="kucuk-yazi" onClick={(e) => { e.preventDefault(); setAdim('db'); }}>Veritabanı: {dosyaKisa}</a>
          </form>
        )}

        {adim === 'kurtar' && (
          <form onSubmit={(e) => { e.preventDefault(); kurtarYap(); }} className="izgara" style={{ gap: 12 }}>
            <div className="uyari-oge bilgi"><span>İlk kurulumda verilen <b>kurtarma kodu</b> ile bir hesabın şifresi sıfırlanır ve hesap yönetici yapılır. Kod yoksa başka bir yöneticiden yeni şifre isteyin.</span></div>
            <Alan etiket="Kurtarma kodu"><input className="girdi" autoFocus placeholder="XXXX-XXXX-XXXX" value={kurtar.kod} onChange={(e) => setKurtar({ ...kurtar, kod: e.target.value.toUpperCase() })} /></Alan>
            <Alan etiket="Kullanıcı adı"><input className="girdi" value={kurtar.kullaniciAdi} onChange={(e) => setKurtar({ ...kurtar, kullaniciAdi: e.target.value })} /></Alan>
            <div className="izgara k2">
              <Alan etiket="Yeni şifre"><input type="password" className="girdi" value={kurtar.yeniSifre} onChange={(e) => setKurtar({ ...kurtar, yeniSifre: e.target.value })} /></Alan>
              <Alan etiket="Yeni şifre (tekrar)"><input type="password" className="girdi" value={kurtar.tekrar} onChange={(e) => setKurtar({ ...kurtar, tekrar: e.target.value })} /></Alan>
            </div>
            {hata && <div className="uyari-oge hata">{hata}</div>}
            <button className="btn birincil" style={{ height: 40, justifyContent: 'center' }} disabled={mesgul}>Şifreyi sıfırla</button>
            <a href="#" className="kucuk-yazi" onClick={(e) => { e.preventDefault(); setHata(''); setAdim('giris'); }}><ArrowLeft size={12} /> Girişe dön</a>
          </form>
        )}

        {adim === 'db' && (
          <form onSubmit={(e) => { e.preventDefault(); baglan(dbYolu); }} className="izgara" style={{ gap: 14 }}>
            {!bas.dbKayitli && <div className="uyari-oge bilgi"><span><b>İlk kurulum:</b> Verilerin saklanacağı yeri seçin. Birkaç kişi ortak kullanacaksa <b>ortak ağ klasöründe</b> bir konum seçin (ör. <code>{'\\\\sunucu\\MakineIkmal\\hakedis.db'}</code>); diğer bilgisayarlarda "Mevcut dosyayı seç" ile aynı dosya gösterilir. Dosya yoksa araç ve sürücü kayıtları hazır olarak oluşturulur.</span></div>}
            <Alan etiket="Veritabanı dosyası" ipucu="Ortak ağ klasöründeki dosyayı seçin; tüm kullanıcılar aynı dosyayı kullanmalı. Dosya yoksa oluşturulur.">
              <div className="satir" style={{ flexWrap: 'nowrap' }}>
                <input className="girdi" autoFocus value={dbYolu} onChange={(e) => setDbYolu(e.target.value)} title={dbYolu} />
                <button type="button" className="btn ikon" title="Mevcut dosyayı seç" onClick={async () => {
                  const r = coz(await kopru.dosyaSec({ baslik: 'Veritabanı dosyası seçin', filtre: [{ name: 'Hakediş veritabanı', extensions: ['db'] }] }));
                  if (r) setDbYolu(r);
                }}><FolderOpen size={16} /></button>
              </div>
            </Alan>
            <div className="satir kucuk-yazi" style={{ gap: 10 }}>
              <a href="#" onClick={async (e) => { e.preventDefault(); const r = coz(await kopru.dosyaSec({ baslik: 'Yeni veritabanı konumu', kaydet: true, varsayilan: 'hakedis.db', filtre: [{ name: 'Veritabanı', extensions: ['db'] }] })); if (r) setDbYolu(r); }}>Yeni konum…</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setDbYolu(bas.varsayilanDbYolu); }}>Varsayılan konum</a>
            </div>
            {bas.sonDbler?.length > 0 && (
              <div className="satir" style={{ gap: 6 }}>
                {bas.sonDbler.slice(0, 4).map((d: string) => (
                  <button type="button" key={d} className="btn kucuk" title={d} onClick={() => setDbYolu(d)} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.split(/[\\/]/).slice(-2).join('\\')}</button>
                ))}
              </div>
            )}
            {hata && <div className="uyari-oge hata">{hata}</div>}
            <button className="btn birincil" style={{ height: 40, justifyContent: 'center' }} disabled={mesgul}>{mesgul ? 'Bağlanılıyor…' : 'Bağlan'}</button>
          </form>
        )}
      </div>

      {kurtarmaKodu && (
        <Modal baslik="Kurtarma kodunuz" kapat={() => {}} ikon={<ShieldCheck size={20} color="var(--ok)" />}
          alt={<button className="btn birincil" onClick={() => { const o = kurtarmaKodu.oturum; setKurtarmaKodu(null); acildi(o, false); }}>Kodu not aldım, devam et</button>}>
          <p style={{ marginTop: 0 }}>Tüm yöneticiler şifresini unutursa bu kodla bir yönetici şifresi sıfırlanabilir. <b>Kod yalnız bir kez gösterilir</b>; güvenli bir yere yazın (ör. kasadaki bir zarf).</p>
          <div className="satir" style={{ justifyContent: 'center', margin: '18px 0' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700, letterSpacing: 2, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 18px' }}>{kurtarmaKodu.kod}</span>
            <button className="btn ikon" title="Kopyala" onClick={() => { navigator.clipboard?.writeText(kurtarmaKodu.kod); bildir('ok', 'Kopyalandı'); }}><Copy size={16} /></button>
          </div>
          <p className="soluk kucuk-yazi">Yöneticiler Kullanıcılar ekranından istediği zaman yeni kurtarma kodu oluşturabilir (eskisi geçersiz olur).</p>
        </Modal>
      )}

      {bozuk && (
        <Modal baslik="Veritabanı bozuk görünüyor" kapat={() => setBozuk(null)} ikon={<Database size={20} color="var(--err)" />} boyut="genis">
          <p style={{ marginTop: 0 }}>Dosyanın bütünlük kontrolü başarısız oldu. Aşağıdaki yedeklerden birini seçerek kurtarabilirsiniz. Bozuk dosya silinmez, ".bozuk-…" uzantısıyla saklanır.</p>
          <div className="tablo-sar kart" style={{ maxHeight: 360 }}>
            <table className="tablo">
              <thead><tr><th>Yedek</th><th>Tarih</th><th className="sayi">Boyut</th><th></th></tr></thead>
              <tbody>
                {[...(bozuk.bak ? [{ ad: 'Son kayıttan önceki sürüm (.bak)', yol: bozuk.bak, tarih: '', boyut: 0 }] : []), ...bozuk.yedekler].map((y: any) => (
                  <tr key={y.yol}><td>{y.ad}</td><td>{zamanTR(y.tarih)}</td><td className="sayi">{y.boyut ? `${Math.round(y.boyut / 1024)} KB` : ''}</td>
                    <td><button className="btn kucuk birincil" onClick={async () => {
                      try { coz(await kopru.bozukKurtar({ dbYolu, yedekYolu: y.yol })); setBozuk(null); bildir('ok', 'Yedek geri yüklendi.'); baglan(dbYolu); } catch (e: any) { bildir('hata', e.message); }
                    }}>Bu yedeği kullan</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function App() {
  const [oturum, setOturum] = useState<{ o: Oturum; sifreZorunlu: boolean } | null>(null);
  if (!oturum) return <GirisEkrani acildi={(o, sifreZorunlu) => setOturum({ o, sifreZorunlu })} />;
  return (
    <BaglamSaglayici oturum={oturum.o} cikis={async () => { await kopru.oturumKapat(); setOturum(null); }}>
      <Kabuk sifreZorunlu={oturum.sifreZorunlu} />
    </BaglamSaglayici>
  );
}
