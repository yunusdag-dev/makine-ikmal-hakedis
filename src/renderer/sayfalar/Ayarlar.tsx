import React, { useEffect, useMemo, useState } from 'react';
import { Save, Plus, Trash2, CalendarPlus, Copy, Percent } from 'lucide-react';
import { api } from '../lib/api';
import { useBaglam } from '../lib/baglam';
import { Alan, Modal, SayiGirdi, useBildirim, useIslem, useOnay } from '../ui/temel';
import { ayAdi, tarihTR, zamanTR, GUN_KISA, sayi } from '../lib/bicim';
import type { Params } from '../../engine/params';
import HizliAyar from './HizliAyar';
import { OZELLIKLER } from '../../engine/ozellik';
import { TEMALAR, temaOku, temaUygula } from '../lib/tema';

type Tip = 'sayi' | 'metin' | 'tarih' | 'bool';
type Alanlar = [string, string, Tip, string?, number?][]; // yol, etiket, tip, ipucu, ondalik

const BOLUMLER: { baslik: string; alanlar: Alanlar }[] = [
  { baslik: 'Ödeme kalemleri (aç / kapat)', alanlar: OZELLIKLER.map((o) => [`ozellikler.${o.anahtar}`, o.ad, 'bool', o.ipucu] as [string, string, Tip, string]) },
  { baslik: 'Kurum ve sözleşme', alanlar: [
    ['kurum.kurumAdi', 'Kurum adı', 'metin'], ['kurum.bolgeAdi', 'Bölge müdürlüğü', 'metin'], ['kurum.firmaAdi', 'Yüklenici firma (tam unvan)', 'metin'],
    ['kurum.firmaKisaAdi', 'Yüklenici firma (kısa ad)', 'metin'], ['kurum.firmaAdresi', 'Yüklenici adresi', 'metin'],
    ['sozlesme.ihaleTarihi', 'İhale tarihi', 'tarih'], ['sozlesme.sozlesmeTarihi', 'Sözleşme tarihi', 'tarih'], ['sozlesme.iseBaslamaTarihi', 'İşe başlama tarihi', 'tarih'],
    ['sozlesme.gunlukCalismaSaati', 'Günlük çalışma saati (formda)', 'sayi'], ['sozlesme.yakitCinsi', 'Yakıt cinsi', 'metin'],
  ] },
  { baslik: 'Takvim ve puantaj', alanlar: [
    ['takvim.cumartesiIsGunu', 'Cumartesi iş günü sayılır (Seçim=1)', 'bool', 'Excel "Seçim" anahtarı; kapalı = Seçim 2'],
    ['takvim.agirlikRTA', 'Resmi tatil arifesi iş günü ağırlığı', 'sayi', 'Excel: 1'], ['takvim.agirlikDBA', 'Dini bayram arifesi iş günü ağırlığı', 'sayi', 'Excel: 0,5'],
    ['puantaj.haftaTatiliSaat', 'Hafta tatili günü → mesai saati', 'sayi', 'Excel: 7,5'], ['puantaj.disGorevKismi', 'Kısmi (⅔) dış görev değeri', 'sayi', 'Excel: 0,66', 4],
    ['puantaj.disGorevdeYemekYol', 'Dış görev / konaklama günlerinde de yemek ve yol ver', 'bool', 'Açık: sürücü çalıştığı her gün yemek ve yol alır. Kapalı: Excel kuralı, tam dış görev ve konaklama günlerinde verilmez.'],
    ['puantaj.fazlaMesaiBaslangic', 'Fazla mesai başlangıç saati', 'metin', 'Görev bu saatten sonra bitiyorsa fazla mesai sayılır (ör. 18:00)'],
    ['puantaj.mesaiYukariDk', 'Saati yukarı yuvarlama eşiği (dakika)', 'sayi', 'Otomatik yuvarlamada artan dakika bu değeri aşarsa bir saat daha eklenir (45)', 0],
  ] },
  { baslik: 'Fiyat farkı ve endeksler', alanlar: [
    ['fiyatFarki.a1', 'a1', 'sayi', '', 5], ['fiyatFarki.a2', 'a2 (İn/İo)', 'sayi', '', 5], ['fiyatFarki.b1', 'b1', 'sayi', '', 5], ['fiyatFarki.b2', 'b2', 'sayi', '', 5],
    ['fiyatFarki.b3', 'b3 (Yi-ÜFE Gn/Go)', 'sayi', '', 5], ['fiyatFarki.c', 'c (Malzeme Mn/Mo)', 'sayi', '', 5], ['fiyatFarki.B', 'Sabit katsayı B', 'sayi', '', 5],
    ['fiyatFarki.Go', 'Yi-ÜFE temel endeks (Go)', 'sayi'], ['fiyatFarki.Gn', 'Yi-ÜFE güncel endeks (Gn)', 'sayi'], ['fiyatFarki.Io', 'Temel asgari ücret (İo)', 'sayi'],
    ['fiyatFarki.In', 'Güncel asgari ücret (İn)', 'sayi'], ['fiyatFarki.Mo', 'Malzeme-ekipman temel (Mo)', 'sayi'], ['fiyatFarki.Mn', 'Malzeme-ekipman güncel (Mn)', 'sayi'],
    ['fiyatFarki.asgariUcretFarki', 'Asgari ücret farkı (TL)', 'sayi'], ['epdkYakitFiyati', 'EPDK motorin fiyatı (TL/lt)', 'sayi', '', 5],
    ['fiyatFarki.operatorSurucuTablosunuKullan', 'Operatör fiyat farkında sürücü tablosu kullanılsın', 'bool', "Excel'deki davranış: açık"],
  ] },
  { baslik: 'Vergi ve kesintiler (hakediş)', alanlar: [
    ['vergi.kdv', 'KDV oranı', 'sayi', '0,20 = %20'], ['vergi.iscilikTevkifat', 'İşçilik KDV tevkifatı', 'sayi', '0,9 = 9/10'], ['vergi.aracTevkifat', 'Araç kiralama tevkifatı', 'sayi', '0,5 = 5/10'],
    ['vergi.konaklamaKdv', 'Konaklama KDV oranı', 'sayi'], ['vergi.konaklamaKdvTevkifatliNet', 'Konaklama KDV (tevkifatlı net oran)', 'sayi', '0,01'], ['vergi.konaklamaTevkifat', 'Konaklama tevkifatı', 'sayi'],
    ['vergi.konaklamaEsik', 'Konaklama tevkifat eşiği (TL)', 'sayi'], ['vergi.konaklamaEsikBolen', 'Eşik böleni', 'sayi', 'Excel: 1,01'], ['vergi.damgaHakedis', 'Damga vergisi (hakediş)', 'sayi', '0,00948', 6],
  ] },
  { baslik: 'Bordro (net maaş)', alanlar: [
    ['bordro.asgariUcretBrut', 'Brüt asgari ücret (TL)', 'sayi'], ['bordro.carpanSurucu', 'Sürücü ücret çarpanı', 'sayi', 'asgari × 1,35'], ['bordro.carpanOperator', 'Operatör ücret çarpanı', 'sayi', 'asgari × 1,65'],
    ['bordro.aylikSaat', 'Aylık çalışma saati', 'sayi', '225'], ['bordro.fazlaMesaiZam', 'Fazla mesai zammı', 'sayi', '1,5'], ['bordro.ayGun', 'Ay gün sayısı (bordro)', 'sayi', '30'],
    ['bordro.yemekGunluk', 'Yemek (günlük, bordro)', 'sayi'], ['bordro.yolGunluk', 'Yol (günlük, bordro)', 'sayi'], ['bordro.yemekIstisnaGunluk', 'Yemek SGK/GV istisnası (günlük)', 'sayi'],
    ['bordro.sgkIsci', 'SGK işçi payı', 'sayi', '0,14'], ['bordro.sgdpIsci', 'SGDP (emekli) işçi payı', 'sayi', '0,075'], ['bordro.issizlikIsci', 'İşsizlik işçi payı', 'sayi', '0,01'],
    ['bordro.issizlikEmekli', 'İşsizlik (emekli)', 'sayi'], ['bordro.damga', 'Damga vergisi (bordro)', 'sayi', '0,00759', 6], ['bordro.gvMatrahOrani', 'Asgari ücret GV matrah oranı', 'sayi', '0,85'],
    ['bordro.konaklamaCarpanStandart', 'Konaklama çarpanı (standart fiyat)', 'sayi', '1,10'], ['bordro.konaklamaCarpanDiger', 'Konaklama çarpanı (farklı fiyat)', 'sayi', '1,12'],
  ] },
];

const UCRET_ALANLARI: [keyof Params['ucret']['surucu'], string][] = [
  ['ucretBrut', 'Aylık ücret (brüt)'], ['ucretKesinti', 'Ücretten düşülen'], ['resmiTatil', 'Resmi/genel tatil (gün)'], ['haftaTatili', 'Hafta tatili (saat)'],
  ['fazlaCalisma', 'Fazla çalışma (saat)'], ['konaklama', 'Konaklama (gün)'], ['disGorev', 'Dış görev (gün)'], ['yemek', 'Yemek (gün)'], ['yol', 'Yol (gün)'],
];

const al = (o: any, yol: string) => yol.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
function koy<T>(o: T, yol: string, v: any): T {
  const c: any = JSON.parse(JSON.stringify(o));
  const ks = yol.split('.');
  let x = c;
  for (const k of ks.slice(0, -1)) x = x[k];
  x[ks[ks.length - 1]] = v;
  return c;
}

export default function Ayarlar() {
  const [sekme, setSekme] = useState<'param' | 'tatil' | 'listeler' | 'veri' | 'gorunum'>('param');
  return (
    <div>
      <div className="sekmeler">
        <button className={sekme === 'param' ? 'aktif' : ''} onClick={() => setSekme('param')}>Parametreler (dönem bazlı)</button>
        <button className={sekme === 'tatil' ? 'aktif' : ''} onClick={() => setSekme('tatil')}>Resmi tatil ve bayramlar</button>
        <button className={sekme === 'listeler' ? 'aktif' : ''} onClick={() => setSekme('listeler')}>Personel ve görev yerleri</button>
        <button className={sekme === 'veri' ? 'aktif' : ''} onClick={() => setSekme('veri')}>Veri klasörü</button>
        <button className={sekme === 'gorunum' ? 'aktif' : ''} onClick={() => setSekme('gorunum')}>Görünüm (tema)</button>
      </div>
      {!useBaglam().yonetici && (sekme === 'param' || sekme === 'tatil') && <div className="uyari-oge bilgi" style={{ marginBottom: 14 }}>Parametreleri ve tatilleri yalnız yöneticiler değiştirebilir; siz görüntüleyebilirsiniz.</div>}
      {sekme === 'param' ? <Parametreler /> : sekme === 'tatil' ? <Tatiller /> : sekme === 'listeler' ? <Listeler /> : sekme === 'veri' ? <VeriKlasoru /> : <Gorunum />}
    </div>
  );
}

/** Ortak personel ve görev yeri listeleri: yanlış yazımı düzelt, birleştir, listeden sil */
function Listeler() {
  const { yonetici, oturum } = useBaglam();
  const salt = oturum.saltOkunur || !yonetici;
  const [l, setL] = useState<{ personel: { id: number; ad: string; kullanim: number }[]; yerler: { id: number; ad: string; kullanim: number }[] }>({ personel: [], yerler: [] });
  const islem = useIslem();
  const onay = useOnay();
  const yukle = () => api<any>('listeler').then(setL);
  useEffect(() => { yukle(); }, []);
  const duzelt = async (tur: 'personel' | 'yer', x: { id: number; ad: string }) => {
    const yeni = window.prompt(`"${x.ad}" için doğru yazımı girin.\n\nGeçmiş kayıtlardaki aynı ad da düzeltilir. Listede zaten varsa iki kayıt birleştirilir.`, x.ad);
    if (yeni == null || !yeni.trim() || yeni.trim() === x.ad) return;
    const r = await islem(() => api<any>('listeDuzelt', tur, x.id, yeni));
    if (r) { await yukle(); }
  };
  const sil = async (tur: 'personel' | 'yer', x: { id: number; ad: string; kullanim: number }) => {
    if (!(await onay({ baslik: 'Listeden sil', metin: `"${x.ad}" öneri listesinden kaldırılacak.\n\nGeçmiş kayıtlarda (${x.kullanim} kayıt) bu ad olduğu gibi kalır, bozulmaz. İsterseniz sonra yeniden yazıp ekleyebilirsiniz.`, evet: 'Sil', tehlike: true }))) return;
    await islem(() => api('listeSil', tur, x.id), 'Listeden silindi.');
    yukle();
  };
  const [ara, setAra] = useState('');
  const sut = (baslik: string, tur: 'personel' | 'yer', liste: { id: number; ad: string; kullanim: number }[]) => (
    <div className="kart">
      <div className="kart-b"><h3>{baslik}</h3><div className="bosluk" /><span className="soluk kucuk-yazi">{liste.length} kayıt</span></div>
      <div style={{ maxHeight: 'calc(100vh - 330px)', overflowY: 'auto' }}>
        <table className="tablo">
          <thead><tr><th>Ad</th><th className="sayi">Kullanım</th><th></th></tr></thead>
          <tbody>
            {liste.filter((x) => !ara || x.ad.toLocaleLowerCase('tr').includes(ara.toLocaleLowerCase('tr'))).map((x) => (
              <tr key={x.id}>
                <td className="kalin">{x.ad}</td><td className="sayi">{x.kullanim}</td>
                <td className="sag" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn kucuk hayalet" disabled={salt} onClick={() => duzelt(tur, x)}>Düzelt</button>
                  <button className="btn ikon kucuk hayalet tehlike" disabled={salt} title="Listeden sil" onClick={() => sil(tur, x)}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {!liste.length && <tr><td colSpan={3} className="soluk" style={{ padding: 16, textAlign: 'center' }}>Henüz kayıt yok. Günlük kayıt formunda yazılan adlar otomatik buraya eklenir.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <div className="izgara" style={{ gap: 14 }}>
      <input className="girdi" style={{ maxWidth: 360 }} placeholder="Listelerde ara…" value={ara} onChange={(e) => setAra(e.target.value)} />
      <div className="izgara" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
        {sut('Görevli personel', 'personel', l.personel)}
        {sut('Görev yerleri', 'yer', l.yerler)}
      </div>
      <div className="soluk kucuk-yazi">Günlük kayıt formunda yazılan her yeni ad bu listeye otomatik eklenir ve tüm kullanıcılara öneri olarak çıkar. Büyük/küçük harf, boşluk ve Türkçe karakter farkıyla aynı ad tekrar eklenmez.</div>
    </div>
  );
}

/** Veri klasörü: verinin tutulduğu yer; değiştirince uygulama yeniden başlar */
function VeriKlasoru() {
  const { yonetici } = useBaglam();
  const [b, setB] = useState<any>(null);
  const bildir = useBildirim();
  useEffect(() => { (window as any).hakedis.veriKlasoruBilgi().then((r: any) => setB(r?.ok ? r.veri : null)); }, []);
  const degistir = async () => {
    const r = await (window as any).hakedis.veriKlasoruDegistir();
    if (r && !r.ok) bildir('hata', r.hata);
  };
  if (!b) return <div className="yukleniyor">Yükleniyor…</div>;
  return (
    <div className="izgara" style={{ gap: 14, maxWidth: 820 }}>
      <div className="kart kart-g izgara" style={{ gap: 10 }}>
        <div className="bolum-baslik">Şu an kullanılan veri klasörü</div>
        <div className="kalin" style={{ wordBreak: 'break-all' }}>{b.klasor}</div>
        <div className="soluk kucuk-yazi">Kaynak: {b.kaynak}</div>
        <div className="satir" style={{ gap: 8, marginTop: 6 }}>
          <button className="btn birincil" disabled={!yonetici} onClick={degistir} title={yonetici ? undefined : 'Yalnız yöneticiler'}>Veri klasörünü değiştir…</button>
        </div>
      </div>
      <div className="soluk kucuk-yazi">
        Veri klasörü bu bilgisayarda saklanır ve paket klasöründeki <b>yapilandirma.json</b> dosyasındaki varsayılan yoldan önceliklidir. Yol erişilemezse açılışta klasör seçmeniz istenir.
        Seçilen klasör yoksa yalnızca siz onaylarsanız oluşturulur. Değişiklikten sonra uygulama yeniden başlar.
      </div>
    </div>
  );
}

/** Kümülatif vergi kesintisi dilimleri düzenleme penceresi */
function VergiModal({ dilimler, kapat, kaydet }: { dilimler: { ust: number | null; oran: number }[]; kapat: () => void; kaydet: (d: { ust: number | null; oran: number }[]) => Promise<boolean> }) {
  const [satirlar, setSatirlar] = useState(() => dilimler.map((d) => ({ ust: d.ust, yuzde: Math.round(d.oran * 10000) / 100 })));
  const hata = (() => {
    if (!satirlar.length) return 'En az bir dilim olmalı.';
    for (let i = 0; i < satirlar.length; i++) {
      const d = satirlar[i];
      if (!(d.yuzde >= 0 && d.yuzde <= 100)) return `${i + 1}. dilim: oran 0 ile 100 arasında olmalı.`;
      const son = i === satirlar.length - 1;
      if (son && d.ust != null) return 'Son dilimin üst sınırı boş (sınırsız) olmalı.';
      if (!son) {
        if (d.ust == null || !(d.ust > 0)) return `${i + 1}. dilimin üst sınırı girilmeli.`;
        if (i > 0 && d.ust <= (satirlar[i - 1].ust ?? 0)) return `${i + 1}. dilimin üst sınırı bir öncekinden büyük olmalı.`;
      }
    }
    return '';
  })();
  return (
    <Modal baslik="Kümülatif Vergi Kesintisi: dilimler" kapat={kapat} ikon={<Percent size={20} />}
      alt={<><button className="btn" onClick={kapat}>Vazgeç</button><button className="btn birincil" disabled={!!hata} onClick={async () => { if (await kaydet(satirlar.map((d) => ({ ust: d.ust, oran: Math.round(d.yuzde * 100) / 10000 })))) kapat(); }}>Kaydet</button></>}>
      <div className="izgara" style={{ gap: 12 }}>
        <table className="tablo">
          <thead><tr><th>#</th><th>Kümülatif kazanç aralığı</th><th className="sayi">Üst sınır (TL)</th><th className="sayi">Oran (%)</th><th></th></tr></thead>
          <tbody>
            {satirlar.map((d, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="soluk">{sayi(i ? satirlar[i - 1].ust ?? 0 : 0, 0)} – {d.ust == null ? 'üzeri' : sayi(d.ust, 0)}</td>
                <td><SayiGirdi className="hucre" deger={d.ust} ondalik={2} yerTutucu="sınırsız" disabled={i === satirlar.length - 1} degis={(v) => setSatirlar(satirlar.map((x, k) => (k === i ? { ...x, ust: v } : x)))} /></td>
                <td><SayiGirdi className="hucre" deger={d.yuzde} ondalik={2} degis={(v) => setSatirlar(satirlar.map((x, k) => (k === i ? { ...x, yuzde: v ?? 0 } : x)))} /></td>
                <td><button className="btn ikon kucuk hayalet" disabled={satirlar.length <= 1} onClick={() => setSatirlar(satirlar.filter((_, k) => k !== i).map((x, k, a) => (k === a.length - 1 ? { ...x, ust: null } : x)))}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <button className="btn kucuk" onClick={() => {
            const g = [...satirlar];
            const son = g[g.length - 1];
            const oncekiUst = g.length > 1 ? g[g.length - 2].ust ?? 0 : 0;
            g.splice(g.length - 1, 0, { ust: (oncekiUst || 100000) * 2, yuzde: son.yuzde });
            setSatirlar(g);
          }}><Plus size={13} /> Dilim ekle</button>
        </div>
        {hata && <div className="uyari-oge hata">{hata}</div>}
        <div className="soluk kucuk-yazi">Dilimler her yıl değişebilir. Vergi her sürücü için ayrı ve yıllık (1 Ocak'ta sıfırlanan) kümülatif matrahla hesaplanır; ay içinde sınır aşılırsa o ayın matrahı bölünür. Değişiklik, seçili parametre sürümünün geçerlilik ayından itibaren uygulanır.</div>
      </div>
    </Modal>
  );
}

/** Renk teması: bu bilgisayarda saklanır; uygulama yeniden açılınca korunur. Her kullanıcı kendi bilgisayarında seçer. */
function Gorunum() {
  const [tema, setTema] = useState(temaOku);
  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="bolum-baslik">Renk teması</div>
      <div className="tema-kartlar" role="group" aria-label="Renk teması">
        {TEMALAR.map((t) => (
          <button key={t.id} type="button" className={`tema-kart ${tema === t.id ? 'secili' : ''}`} aria-pressed={tema === t.id}
            style={{ ['--tk' as any]: t.renk, ['--tk-yan' as any]: t.yan }} onClick={() => { temaUygula(t.id); setTema(t.id); }}>
            <div className="onizle"><i /><b /></div>
            <b>{t.ad}</b>{tema === t.id && <span className="rozet mavi" style={{ marginLeft: 6 }}>seçili</span>}
          </button>
        ))}
      </div>
      <div className="soluk kucuk-yazi">Seçim bu bilgisayarda saklanır, uygulamayı yeniden açınca da korunur. Veriyi ve hesapları etkilemez.</div>
    </div>
  );
}

function Parametreler() {
  const { oturum, yonetici, yenile, ay } = useBaglam();
  const [surumler, setSurumler] = useState<any[]>([]);
  const [secili, setSecili] = useState<number | null>(null);
  const [p, setP] = useState<Params | null>(null);
  const [orijinal, setOrijinal] = useState<string>('');
  const [aciklama, setAciklama] = useState('');
  const [gecerlilik, setGecerlilik] = useState('');
  const [yeni, setYeni] = useState<{ ay: string; aciklama: string } | null>(null);
  const [vergiAcik, setVergiAcik] = useState(false);
  const islem = useIslem();
  const onay = useOnay();
  const salt = oturum.saltOkunur || !yonetici;
  const yukle = async (sec?: number) => {
    const l = await api<any[]>('parametreSurumleri');
    setSurumler(l);
    const hedef = sec ?? secili ?? l.find((x) => x.gecerlilik <= ay)?.id ?? l[0]?.id;
    if (hedef) sec2(hedef);
  };
  const sec2 = async (id: number) => {
    const r = await api<any>('parametreSurumu', id);
    setSecili(id); setP(r.veri); setOrijinal(JSON.stringify(r.veri)); setAciklama(r.aciklama); setGecerlilik(r.gecerlilik);
  };
  useEffect(() => { yukle(); }, []);
  const degisti = p && JSON.stringify(p) !== orijinal;
  const kayitli = useMemo<Params | null>(() => (orijinal ? JSON.parse(orijinal) : null), [orijinal]);
  const kaydet = async () => {
    if (!p) return;
    await islem(() => api('parametreKaydet', gecerlilik, p, aciklama), 'Parametreler kaydedildi.');
    setOrijinal(JSON.stringify(p));
    await yukle(secili ?? undefined);
    yenile();
  };
  const yeniKaydet = async () => {
    if (!p || !yeni) return;
    if (surumler.some((s) => s.gecerlilik === yeni.ay) && !(await onay({ baslik: 'Sürüm zaten var', metin: `${ayAdi(yeni.ay)} için parametre sürümü var. Üzerine yazılsın mı?`, evet: 'Üzerine yaz', tehlike: true }))) return;
    const r = await islem(() => api('parametreKaydet', yeni.ay, p, yeni.aciklama), `${ayAdi(yeni.ay)} itibarıyla geçerli yeni parametre sürümü oluşturuldu.`);
    if (r !== undefined || true) {
      setYeni(null);
      const l = await api<any[]>('parametreSurumleri');
      setSurumler(l);
      const s = l.find((x) => x.gecerlilik === yeni.ay);
      if (s) sec2(s.id);
      yenile();
    }
  };
  /** Yalnız vergi dilimlerini, kayıtlı sürüme uygular (diğer kaydedilmemiş düzenlemeler bu işleme karışmaz) */
  const vergiKaydet = async (dilimler: { ust: number | null; oran: number }[]): Promise<boolean> => {
    if (!p || !kayitli) return false;
    const ozet = dilimler.map((d, i) => `${sayi(i ? dilimler[i - 1].ust ?? 0 : 0, 0)} – ${d.ust == null ? 'üzeri' : sayi(d.ust, 0)} TL: %${Math.round(d.oran * 10000) / 100}`).join('\n');
    if (!(await onay({ baslik: 'Vergi dilimleri değişecek', metin: `${ayAdi(gecerlilik)} itibarıyla geçerli sürümde şu dilimler kullanılacak:\n\n${ozet}\n\nBu aydan itibaren tüm sürücülerin bordro ve vergi hesabı yeni dilimlerle yapılır.`, evet: 'Kaydet' }))) return false;
    const yeniKayitli = koy(kayitli, 'bordro.gvDilimleri', dilimler);
    const r = await islem(() => api('parametreKaydet', gecerlilik, yeniKayitli, aciklama || 'Vergi dilimleri güncellendi'), 'Vergi dilimleri kaydedildi.');
    if (r === undefined) return false;
    setP(koy(p, 'bordro.gvDilimleri', dilimler));
    setOrijinal(JSON.stringify(yeniKayitli));
    await yukle(secili ?? undefined);
    yenile();
    return true;
  };
  const sil = async () => {
    if (!secili) return;
    if (!(await onay({ baslik: 'Sürümü sil', metin: `${ayAdi(gecerlilik)} sürümü silinecek. Bu aydan itibaren bir önceki sürüm geçerli olur.`, evet: 'Sil', tehlike: true }))) return;
    await islem(() => api('parametreSil', secili), 'Sürüm silindi.');
    setSecili(null);
    await yukle();
    yenile();
  };

  if (!p) return <div className="yukleniyor">Yükleniyor…</div>;
  const alanCiz = ([yol, etiket, tip, ipucu, ondalik]: Alanlar[0]) => (
    <Alan key={yol} etiket={etiket} ipucu={ipucu}>
      {tip === 'sayi' && <SayiGirdi deger={al(p, yol)} ondalik={ondalik ?? 5} disabled={salt} degis={(v) => setP(koy(p, yol, v ?? 0))} />}
      {tip === 'metin' && <input className="girdi" disabled={salt} value={al(p, yol) ?? ''} onChange={(e) => setP(koy(p, yol, e.target.value))} />}
      {tip === 'tarih' && <input type="date" className="girdi" disabled={salt} value={al(p, yol) ?? ''} onChange={(e) => setP(koy(p, yol, e.target.value))} />}
      {tip === 'bool' && <label className="onay" style={{ height: 34 }}><input type="checkbox" disabled={salt} checked={!!al(p, yol)} onChange={(e) => setP(koy(p, yol, e.target.checked))} /> {al(p, yol) ? 'Evet' : 'Hayır'}</label>}
    </Alan>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      <div className="kart" style={{ position: 'sticky', top: 0 }}>
        <div className="kart-b"><h3>Sürümler</h3><div className="bosluk" />
          <button className="btn kucuk" disabled={salt} onClick={() => setYeni({ ay, aciklama: '' })} title="Mevcut değerlerden yeni dönem sürümü"><Plus size={14} /> Yeni</button></div>
        <div style={{ padding: 6 }}>
          {surumler.map((s) => (
            <div key={s.id} className={`pt-oge ${s.id === secili ? 'secili' : ''}`} onClick={() => sec2(s.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="ad">{ayAdi(s.gecerlilik)} itibarıyla</div>
                <div className="alt" title={s.aciklama}>{s.aciklama || '—'}</div>
                <div className="alt">{zamanTR(s.guncelleme)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="soluk kucuk-yazi" style={{ padding: '0 14px 14px' }}>Her ay, geçerlilik ayı o aydan küçük veya eşit olan en son sürümle hesaplanır. Eski aylar eski parametrelerle yeniden hesaplanabilir.</div>
      </div>
      <div className="izgara" style={{ gap: 14 }}>
        {kayitli && <HizliAyar p={kayitli} kaynak={`${ayAdi(gecerlilik)} itibarıyla sürüm${degisti ? ' (kaydedilmiş hali)' : ''}`} mevcutAylar={surumler.map((x) => x.gecerlilik)} salt={salt}
          bitti={async (yeniAy) => { const l = await api<any[]>('parametreSurumleri'); setSurumler(l); const sv = l.find((x) => x.gecerlilik === yeniAy); if (sv) sec2(sv.id); yenile(); }} />}
        <div className="kart kart-g satir yapiskan-ust" style={{ background: degisti ? '#fffbea' : undefined }}>
          <div><b>{ayAdi(gecerlilik)}</b> itibarıyla geçerli sürüm</div>
          <input className="girdi" style={{ maxWidth: 420 }} disabled={salt} value={aciklama} placeholder="Açıklama (ör. 2026 Temmuz asgari ücret artışı)" onChange={(e) => setAciklama(e.target.value)} />
          <div className="bosluk" />
          {degisti && <span className="rozet uyari">Kaydedilmemiş değişiklik</span>}
          <button className="btn" disabled={salt} onClick={() => setYeni({ ay, aciklama })}><Copy size={15} /> Farklı dönem olarak kaydet</button>
          <button className="btn birincil" disabled={salt || !degisti} onClick={kaydet}><Save size={15} /> Kaydet</button>
          <button className="btn ikon tehlike" disabled={salt || surumler.length <= 1} onClick={sil} title="Sürümü sil"><Trash2 size={15} /></button>
        </div>
        {BOLUMLER.map((b) => (
          <div key={b.baslik} className="kart">
            <div className="kart-b"><h3>{b.baslik}</h3></div>
            <div className="kart-g">
              <div className="param-izgara">{b.alanlar.map(alanCiz)}</div>
              {b.baslik === 'Bordro (net maaş)' && (
                <>
                  <div className="bolum-baslik" style={{ marginTop: 18 }}>Kümülatif vergi kesintisi (gelir vergisi dilimleri)</div>
                  <table className="tablo" style={{ maxWidth: 520 }}>
                    <thead><tr><th>Dilim</th><th>Kümülatif kazanç aralığı (TL)</th><th className="sayi">Oran</th></tr></thead>
                    <tbody>
                      {p.bordro.gvDilimleri.map((d, i) => (
                        <tr key={i}><td>{i + 1}</td>
                          <td>{sayi(i ? p.bordro.gvDilimleri[i - 1].ust ?? 0 : 0, 0)} – {d.ust == null ? 'üzeri' : sayi(d.ust, 0)}</td>
                          <td className="sayi kalin">%{Math.round(d.oran * 10000) / 100}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn" style={{ marginTop: 8 }} disabled={salt} onClick={() => setVergiAcik(true)}><Percent size={14} /> Kümülatif Vergi Kesintisi: dilimleri düzenle</button>
                  <div className="soluk kucuk-yazi" style={{ marginTop: 6 }}>Vergi her sürücü için ayrı ve yıllık hesaplanır (kümülatif matrah her 1 Ocak'ta sıfırlanır). Ay içinde bir sınır aşılırsa o ayın matrahı bölünür: sınıra kadar olan kısım eski oranla, aşan kısım yeni oranla vergilendirilir.</div>
                </>
              )}
            </div>
          </div>
        ))}
        <div className="kart">
          <div className="kart-b"><h3>Ücret tabloları (birim fiyatlar)</h3></div>
          <div className="kart-g">
            <table className="tablo">
              <thead><tr><th>Kalem</th><th className="sayi">Sürücü</th><th className="sayi">Operatör</th><th className="sayi">Sürücü (fiyat farkı)</th><th className="sayi">Operatör (fiyat farkı)</th></tr></thead>
              <tbody>
                {UCRET_ALANLARI.map(([k, e]) => (
                  <tr key={k}>
                    <td>{e}</td>
                    {(['surucu', 'operator', 'ffSurucu', 'ffOperator'] as const).map((t) => (
                      <td key={t}><SayiGirdi className="hucre" deger={p.ucret[t][k]} disabled={salt} degis={(v) => setP(koy(p, `ucret.${t}.${k}`, v ?? 0))} /></td>
                    ))}
                  </tr>
                ))}
                <tr><td className="kalin">Net sürücü ücreti</td>{(['surucu', 'operator', 'ffSurucu', 'ffOperator'] as const).map((t) => <td key={t} className="sayi kalin">{(p.ucret[t].ucretBrut - p.ucret[t].ucretKesinti).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>)}</tr>
              </tbody>
            </table>
            <div className="param-izgara" style={{ marginTop: 14 }}>
              {alanCiz(['ucret.yemekYolDusumGun', 'Sürücü ücretinden düşülen yemek+yol gün sayısı', 'sayi', 'Excel: 22 (sabit)'])}
              {alanCiz(['ucret.ayBolenGun', 'Kira / fiyat farkı ay böleni (gün)', 'sayi', 'Excel: 30'])}
            </div>
          </div>
        </div>
      </div>
      {vergiAcik && p && <VergiModal dilimler={p.bordro.gvDilimleri} kapat={() => setVergiAcik(false)} kaydet={vergiKaydet} />}
      {yeni && (
        <Modal baslik="Yeni dönem parametre sürümü" kapat={() => setYeni(null)}
          alt={<><button className="btn" onClick={() => setYeni(null)}>Vazgeç</button><button className="btn birincil" onClick={yeniKaydet}>Oluştur</button></>}>
          <div className="izgara" style={{ gap: 12 }}>
            <div className="soluk">Ekrandaki değerler (değişiklikler dahil) seçilen aydan itibaren geçerli yeni bir sürüm olarak kaydedilir. Önceki aylar eski sürümle hesaplanmaya devam eder.</div>
            <Alan etiket="Geçerlilik başlangıç ayı"><input type="month" className="girdi" value={yeni.ay} onChange={(e) => setYeni({ ...yeni, ay: e.target.value })} /></Alan>
            <Alan etiket="Açıklama"><input className="girdi" autoFocus value={yeni.aciklama} placeholder="ör. 2027 Ocak asgari ücret ve endeks güncellemesi" onChange={(e) => setYeni({ ...yeni, aciklama: e.target.value })} /></Alan>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Tatiller() {
  const { oturum, yonetici, yenile } = useBaglam();
  const [yil, setYil] = useState(new Date().getFullYear());
  const [liste, setListe] = useState<any[]>([]);
  const [yeni, setYeni] = useState<{ tarih: string; tur: string; ad: string } | null>(null);
  const islem = useIslem();
  const bildir = useBildirim();
  const salt = oturum.saltOkunur || !yonetici;
  const yukle = async () => setListe(await api<any[]>('tatiller', yil));
  useEffect(() => { yukle(); }, [yil]);
  const TUR: Record<string, string> = { RT: 'Resmi tatil', RTA: 'Resmi tatil arifesi', DB: 'Dini bayram', DBA: 'Dini bayram arifesi' };
  const kaydet = async () => {
    if (!yeni) return;
    const r = await islem(() => api('tatilKaydet', yeni), 'Tatil eklendi.');
    if (r !== undefined) { setYeni(null); yukle(); yenile(); }
  };
  const sabitler = async () => {
    const sabit: [string, string, string][] = [['01-01', 'RT', 'Yılbaşı'], ['04-23', 'RT', 'Ulusal Egemenlik ve Çocuk Bayramı'], ['05-01', 'RT', 'Emek ve Dayanışma Günü'],
      ['05-19', 'RT', "Atatürk'ü Anma Gençlik ve Spor Bayramı"], ['07-15', 'RT', 'Demokrasi ve Milli Birlik Günü'], ['08-30', 'RT', 'Zafer Bayramı'],
      ['10-28', 'RTA', 'Cumhuriyet Bayramı Arifesi'], ['10-29', 'RT', 'Cumhuriyet Bayramı']];
    let n = 0;
    for (const [md, tur, ad] of sabit) {
      if (liste.some((x) => x.tarih === `${yil}-${md}` && x.tur === tur)) continue;
      try { await api('tatilKaydet', { tarih: `${yil}-${md}`, tur, ad }); n++; } catch { /* */ }
    }
    bildir('ok', `${n} sabit tatil eklendi.`);
    yukle(); yenile();
  };
  return (
    <div className="izgara" style={{ gap: 14, maxWidth: 900 }}>
      <div className="satir">
        <select className="girdi" style={{ width: 120 }} value={yil} onChange={(e) => setYil(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => 2024 + i).map((y) => <option key={y}>{y}</option>)}
        </select>
        <div className="bosluk" />
        <button className="btn" disabled={salt} onClick={sabitler}><CalendarPlus size={15} /> {yil} sabit resmi tatillerini ekle</button>
        <button className="btn birincil" disabled={salt} onClick={() => setYeni({ tarih: `${yil}-01-01`, tur: 'DB', ad: '' })}><Plus size={15} /> Tatil ekle</button>
      </div>
      <div className="kart tablo-sar">
        <table className="tablo">
          <thead><tr><th>Tarih</th><th>Gün</th><th>Tür</th><th>Ad</th><th></th></tr></thead>
          <tbody>
            {liste.map((t) => {
              const [y, m, d] = t.tarih.split('-').map(Number);
              return (
                <tr key={t.id}>
                  <td className="kalin">{tarihTR(t.tarih)}</td><td>{GUN_KISA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}</td>
                  <td><span className={`rozet ${t.tur === 'RT' || t.tur === 'DB' ? 'hata' : 'uyari'}`}>{TUR[t.tur]}</span></td><td>{t.ad}</td>
                  <td className="sag"><button className="btn ikon kucuk hayalet tehlike" disabled={salt} onClick={async () => { await islem(() => api('tatilSil', t.id)); yukle(); yenile(); }}><Trash2 size={13} /></button></td>
                </tr>
              );
            })}
            {!liste.length && <tr><td colSpan={5} className="soluk" style={{ padding: 20, textAlign: 'center' }}>{yil} için tatil tanımlı değil.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="soluk kucuk-yazi">Dini bayram tarihleri her yıl Diyanet takviminden kontrol edilmelidir. Arife günleri yalnız hafta içine denk geliyorsa sayılır (Cumartesi iş günü ise Cumartesi de dahil).</div>
      {yeni && (
        <Modal baslik="Tatil ekle" kapat={() => setYeni(null)} alt={<><button className="btn" onClick={() => setYeni(null)}>Vazgeç</button><button className="btn birincil" onClick={kaydet}>Ekle</button></>}>
          <div className="izgara k3">
            <Alan etiket="Tarih"><input type="date" className="girdi" value={yeni.tarih} onChange={(e) => setYeni({ ...yeni, tarih: e.target.value })} /></Alan>
            <Alan etiket="Tür"><select className="girdi" value={yeni.tur} onChange={(e) => setYeni({ ...yeni, tur: e.target.value })}>{Object.entries(TUR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Alan>
            <Alan etiket="Ad"><input className="girdi" autoFocus value={yeni.ad} onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} /></Alan>
          </div>
        </Modal>
      )}
    </div>
  );
}
