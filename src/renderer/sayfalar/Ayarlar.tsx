import React, { useEffect, useMemo, useState } from 'react';
import { Save, Plus, Trash2, CalendarPlus, Copy } from 'lucide-react';
import { api } from '../lib/api';
import { useBaglam } from '../lib/baglam';
import { Alan, Modal, SayiGirdi, useBildirim, useIslem, useOnay } from '../ui/temel';
import { ayAdi, tarihTR, zamanTR, GUN_KISA } from '../lib/bicim';
import type { Params } from '../../engine/params';
import HizliAyar from './HizliAyar';
import { OZELLIKLER } from '../../engine/ozellik';

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
  const [sekme, setSekme] = useState<'param' | 'tatil'>('param');
  return (
    <div>
      <div className="sekmeler">
        <button className={sekme === 'param' ? 'aktif' : ''} onClick={() => setSekme('param')}>Parametreler (dönem bazlı)</button>
        <button className={sekme === 'tatil' ? 'aktif' : ''} onClick={() => setSekme('tatil')}>Resmi tatil ve bayramlar</button>
      </div>
      {!useBaglam().yonetici && <div className="uyari-oge bilgi" style={{ marginBottom: 14 }}>Parametreleri ve tatilleri yalnız yöneticiler değiştirebilir; siz görüntüleyebilirsiniz.</div>}
      {sekme === 'param' ? <Parametreler /> : <Tatiller />}
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
                  <div className="bolum-baslik" style={{ marginTop: 18 }}>Gelir vergisi dilimleri (kümülatif matrah)</div>
                  <table className="tablo" style={{ maxWidth: 520 }}>
                    <thead><tr><th>#</th><th className="sayi">Üst sınır (TL)</th><th className="sayi">Oran</th><th></th></tr></thead>
                    <tbody>
                      {p.bordro.gvDilimleri.map((d, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td><SayiGirdi className="hucre" deger={d.ust} disabled={salt} yerTutucu="sınırsız" degis={(v) => { const g = [...p.bordro.gvDilimleri]; g[i] = { ...d, ust: v }; setP(koy(p, 'bordro.gvDilimleri', g)); }} /></td>
                          <td><SayiGirdi className="hucre" deger={d.oran} disabled={salt} degis={(v) => { const g = [...p.bordro.gvDilimleri]; g[i] = { ...d, oran: v ?? 0 }; setP(koy(p, 'bordro.gvDilimleri', g)); }} /></td>
                          <td><button className="btn ikon kucuk hayalet" disabled={salt || p.bordro.gvDilimleri.length <= 1} onClick={() => setP(koy(p, 'bordro.gvDilimleri', p.bordro.gvDilimleri.filter((_, k) => k !== i)))}><Trash2 size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn kucuk" style={{ marginTop: 8 }} disabled={salt} onClick={() => {
                    const g = [...p.bordro.gvDilimleri];
                    const son = g[g.length - 1];
                    g.splice(g.length - 1, 0, { ust: (g[g.length - 2]?.ust ?? 0) * 2 || 1000000, oran: son.oran });
                    setP(koy(p, 'bordro.gvDilimleri', g));
                  }}><Plus size={13} /> Dilim ekle</button>
                  <div className="soluk kucuk-yazi" style={{ marginTop: 6 }}>Son dilimin üst sınırı boş (sınırsız) olmalıdır. Excel: 190.000 → %15, 400.000 → %20, üstü %27.</div>
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
