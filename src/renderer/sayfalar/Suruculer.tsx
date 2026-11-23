import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Search, Users, Truck, CalendarClock, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { useBaglam } from '../lib/baglam';
import { Alan, Modal, useBildirim, useIslem, useOnay, BosDurum } from '../ui/temel';
import { tarihTR, ayAdi } from '../lib/bicim';

export interface SurucuRow {
  id?: number; ad_soyad: string; tc_no: string; telefon: string; varsayilan_arac_id: number | null; ucret_grubu: 'surucu' | 'operator';
  emekli: number; yol_hakki: number; ise_giris: string; isten_cikis: string; sira?: number; aktif: number; notlar: string;
}
const BOS: SurucuRow = { ad_soyad: '', tc_no: '', telefon: '', varsayilan_arac_id: null, ucret_grubu: 'surucu', emekli: 0, yol_hakki: 1, ise_giris: '', isten_cikis: '', aktif: 1, notlar: '' };

export default function Suruculer() {
  const { oturum, yenile, veri, ay, yonetici } = useBaglam();
  const [ham, setListe] = useState<SurucuRow[]>([]);
  const [atamalar, setAtamalar] = useState<any[]>([]);
  const [araclar, setAraclar] = useState<any[]>([]);
  const [duzen, setDuzen] = useState<SurucuRow | null>(null);
  const [tcAcik, setTcAcik] = useState(false);
  useEffect(() => { setTcAcik(false); }, [duzen?.id]);
  const [arama, setArama] = useState('');
  const [pasifGoster, setPasifGoster] = useState(false);
  const islem = useIslem();
  const onay = useOnay();
  const bildir = useBildirim();
  const salt = oturum.saltOkunur;
  const yukle = async () => {
    const [s, a, at] = await Promise.all([api<SurucuRow[]>('suruculer'), api<any[]>('araclar'), api<any[]>('atamalar')]);
    setListe(s); setAraclar(a); setAtamalar(at);
  };
  useEffect(() => { yukle(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && e.key.toLowerCase() === 'n' && !salt) { e.preventDefault(); setDuzen({ ...BOS }); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [salt]);
  // Seçili ayın araç eşleşmesi (dönem bazlı atamalardan)
  const liste = useMemo(() => {
    const m = new Map((veri?.suruculer ?? []).map((x) => [x.id, x.varsayilanAracId]));
    return ham.map((x) => (m.has(x.id!) ? { ...x, varsayilan_arac_id: m.get(x.id!) ?? null } : x));
  }, [ham, veri]);
  const aracAd = useMemo(() => new Map(araclar.map((a) => [a.id, a.plaka])), [araclar]);
  const kullanan = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const s of liste) if (s.varsayilan_arac_id && s.aktif) m.set(s.varsayilan_arac_id, [...(m.get(s.varsayilan_arac_id) ?? []), s.ad_soyad]);
    return m;
  }, [liste]);
  const gorunen = liste.filter((s) => (pasifGoster || s.aktif) && (!arama || s.ad_soyad.toLocaleLowerCase('tr-TR').includes(arama.toLocaleLowerCase('tr-TR')) || (aracAd.get(s.varsayilan_arac_id ?? -1) ?? '').toLocaleLowerCase('tr-TR').includes(arama.toLocaleLowerCase('tr-TR'))));

  const kaydet = async () => {
    if (!duzen) return;
    const r = await islem(() => api('surucuKaydet', duzen), 'Sürücü kaydedildi');
    if (r !== undefined) { setDuzen(null); await yukle(); yenile(); }
  };
  const sil = async (s: SurucuRow) => {
    if (!(await onay({ baslik: 'Sürücüyü sil', metin: `${s.ad_soyad} silinsin mi?\nPuantaj kaydı varsa silinmez, pasif yapılır (geçmiş hesaplar korunur).`, evet: 'Sil', tehlike: true }))) return;
    const r = await islem(() => api('surucuSil', s.id));
    if (r) { bildir('ok', r.silindi ? 'Sürücü silindi.' : 'Sürücünün kayıtları olduğu için pasif yapıldı.'); await yukle(); yenile(); }
  };
  const tasi = async (i: number, yon: -1 | 1) => {
    const aktifler = liste.filter((s) => s.aktif);
    const j = i + yon;
    if (j < 0 || j >= aktifler.length) return;
    const ids = aktifler.map((s) => s.id!);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await islem(() => api('siraKaydet', 'suruculer', ids));
    await yukle(); yenile();
  };

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="satir">
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
          <input className="girdi" style={{ paddingLeft: 32 }} placeholder="Ad veya plaka ara…" value={arama} onChange={(e) => setArama(e.target.value)} />
        </div>
        <label className="onay"><input type="checkbox" checked={pasifGoster} onChange={(e) => setPasifGoster(e.target.checked)} /> Pasifleri göster</label>
        <div className="bosluk" />
        <span className="soluk">{liste.filter((s) => s.aktif).length} aktif sürücü</span>
        <button className="btn birincil" disabled={salt} onClick={() => setDuzen({ ...BOS })}><Plus size={16} /> Yeni sürücü <kbd style={{ marginLeft: 4 }}>Ctrl+N</kbd></button>
      </div>
      <div className="kart tablo-sar">
        {!liste.length ? <BosDurum ikon={<Users size={36} />} baslik="Kayıtlı sürücü yok" metin="Yeni sürücü ekleyin veya Veritabanı ekranından Excel içe aktarın." /> : (
          <table className="tablo">
            <thead><tr><th style={{ width: 70 }}>Sıra</th><th>Ad Soyad</th><th>Aracı ({ayAdi(ay)})</th><th>Ücret grubu</th><th>Emekli</th><th>Yol ücreti</th><th>İşe giriş</th><th>Telefon</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {gorunen.map((s) => {
                const ai = liste.filter((x) => x.aktif).findIndex((x) => x.id === s.id);
                const paylasan = s.varsayilan_arac_id ? (kullanan.get(s.varsayilan_arac_id) ?? []).filter((x) => x !== s.ad_soyad) : [];
                return (
                  <tr key={s.id} className="tikla" onDoubleClick={() => !salt && setDuzen({ ...s })} style={{ opacity: s.aktif ? 1 : 0.55 }}>
                    <td>
                      {s.aktif ? <div className="satir" style={{ gap: 0, flexWrap: 'nowrap' }}>
                        <span className="soluk" style={{ width: 22 }}>{ai + 1}</span>
                        <button className="btn ikon kucuk hayalet" disabled={salt || ai === 0} onClick={() => tasi(ai, -1)}><ArrowUp size={13} /></button>
                        <button className="btn ikon kucuk hayalet" disabled={salt} onClick={() => tasi(ai, 1)}><ArrowDown size={13} /></button>
                      </div> : '—'}
                    </td>
                    <td className="kalin">{s.ad_soyad}</td>
                    <td>{aracAd.get(s.varsayilan_arac_id ?? -1) ?? <span className="rozet uyari">atanmamış</span>} {paylasan.length > 0 && <span className="rozet mavi" title={paylasan.join(', ')}>+{paylasan.length} paylaşıyor</span>}</td>
                    <td>{s.ucret_grubu === 'operator' ? <span className="rozet mavi">Operatör</span> : 'Sürücü'}</td>
                    <td>{s.emekli ? <span className="rozet">Evet</span> : 'Hayır'}</td>
                    <td>{s.yol_hakki ? 'Alır' : <span className="rozet uyari">Almaz</span>}</td>
                    <td>{tarihTR(s.ise_giris)}</td>
                    <td>{s.telefon}</td>
                    <td>{s.aktif ? <span className="rozet ok">Aktif</span> : <span className="rozet">Pasif</span>}</td>
                    <td className="sag">
                      <button className="btn ikon kucuk hayalet" disabled={salt} onClick={() => setDuzen({ ...s })} title="Düzenle"><Pencil size={14} /></button>
                      <button className="btn ikon kucuk hayalet tehlike" disabled={salt || !yonetici} onClick={() => sil(s)} title={yonetici ? 'Sil' : 'Silme yetkisi yalnız yöneticidedir'}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {duzen && (
        <Modal baslik={duzen.id ? 'Sürücüyü düzenle' : 'Yeni sürücü'} kapat={() => setDuzen(null)} boyut="genis"
          alt={<><button className="btn" onClick={() => setDuzen(null)}>Vazgeç</button><button className="btn birincil" onClick={kaydet}>Kaydet</button></>}>
          <form onSubmit={(e) => { e.preventDefault(); kaydet(); }} className="izgara k3">
            <Alan etiket="Ad Soyad *"><input className="girdi" autoFocus value={duzen.ad_soyad} onChange={(e) => setDuzen({ ...duzen, ad_soyad: e.target.value.toLocaleUpperCase('tr-TR') })} /></Alan>
            {duzen.id ? (
              <Alan etiket="Aracı (dönem bazlı)" style={{ gridColumn: '1 / -1' }} ipucu="Sürücü, günlük girişte her zaman o ayın aracıyla açılır. Nadiren başka plaka girmek için günlük formda araç satırından plakayı değiştirmeniz yeterli; burada kalıcı değişiklik yapılır.">
                <AtamaPaneli surucuId={duzen.id} atamalar={atamalar.filter((x) => x.surucu_id === duzen.id)} araclar={araclar} suruculer={liste} baslangicAy={ay} degisti={async () => { await yukle(); yenile(); }} />
              </Alan>
            ) : (
              <Alan etiket="Aracı" ipucu="Puantajda her gün otomatik seçilir. Sonradan 'şu aydan itibaren' başka araca atanabilir.">
                <select className="girdi" value={duzen.varsayilan_arac_id ?? ''} onChange={(e) => setDuzen({ ...duzen, varsayilan_arac_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— seçiniz —</option>
                  {araclar.filter((a) => a.aktif).map((a) => <option key={a.id} value={a.id}>{a.plaka} — {a.arac_tipi}</option>)}
                </select>
              </Alan>
            )}
            <Alan etiket="Ücret grubu" ipucu="Operatör: operatör ücret tablosu ve bordro çarpanı uygulanır.">
              <select className="girdi" value={duzen.ucret_grubu} onChange={(e) => setDuzen({ ...duzen, ucret_grubu: e.target.value as any })}>
                <option value="surucu">Sürücü</option>
                <option value="operator">Operatör (kamyon / iş makinesi)</option>
              </select>
            </Alan>
            <Alan etiket="T.C. Kimlik No" ipucu={duzen.tc_no.includes("*") ? "Gizli gösterilir. Göster, her kullanımda Değişiklik Kaydına yazılır." : undefined}>
              <div className="satir" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <input className="girdi" value={duzen.tc_no} maxLength={11} readOnly={duzen.tc_no.includes('*')} style={{ flex: 1 }}
                  onChange={(e) => setDuzen({ ...duzen, tc_no: e.target.value.replace(/\D/g, '') })} />
                {duzen.tc_no.includes('*') && duzen.id && !tcAcik && (
                  <button type="button" className="btn" title="T.C. kimlik numarasını göster"
                    onClick={async () => { try { const tc = await api<string>('surucuTcGoster', duzen.id); setDuzen({ ...duzen, tc_no: tc }); setTcAcik(true); } catch (e: any) { bildir('hata', e.message); } }}>
                    <Eye size={15} /> Göster
                  </button>
                )}
              </div>
            </Alan>
            <Alan etiket="Telefon"><input className="girdi" value={duzen.telefon} onChange={(e) => setDuzen({ ...duzen, telefon: e.target.value })} /></Alan>
            <Alan etiket="İşe giriş tarihi" ipucu="Vergi indirimi 'çalışma ayı' bu tarihten hesaplanır."><input type="date" className="girdi" value={duzen.ise_giris} onChange={(e) => setDuzen({ ...duzen, ise_giris: e.target.value })} /></Alan>
            <Alan etiket="Emekli mi?" ipucu="Emekli: SGDP %7,5, işsizlik yok."><label className="onay" style={{ height: 34 }}><input type="checkbox" checked={!!duzen.emekli} onChange={(e) => setDuzen({ ...duzen, emekli: e.target.checked ? 1 : 0 })} /> Emekli (SGDP)</label></Alan>
            <Alan etiket="Yol ücreti" ipucu="Almıyorsa günlük yol otomatik 0 olur (gün bazında değiştirilebilir)."><label className="onay" style={{ height: 34 }}><input type="checkbox" checked={!!duzen.yol_hakki} onChange={(e) => setDuzen({ ...duzen, yol_hakki: e.target.checked ? 1 : 0 })} /> Yol ücreti alır</label></Alan>
            <Alan etiket="Durum"><label className="onay" style={{ height: 34 }}><input type="checkbox" checked={!!duzen.aktif} onChange={(e) => setDuzen({ ...duzen, aktif: e.target.checked ? 1 : 0 })} /> Aktif</label></Alan>
            <Alan etiket="İşten çıkış tarihi"><input type="date" className="girdi" value={duzen.isten_cikis} onChange={(e) => setDuzen({ ...duzen, isten_cikis: e.target.value })} /></Alan>
            <Alan etiket="Notlar" style={{ gridColumn: 'span 2' }}><input className="girdi" value={duzen.notlar} onChange={(e) => setDuzen({ ...duzen, notlar: e.target.value })} /></Alan>
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </div>
  );
}


function AtamaPaneli(p: { surucuId: number; atamalar: any[]; araclar: any[]; suruculer: SurucuRow[]; baslangicAy: string; degisti: () => void }) {
  const { yonetici } = useBaglam();
  const [ay, setAy] = useState(p.baslangicAy);
  const [aracId, setAracId] = useState<string>('');
  const islem = useIslem();
  const onay = useOnay();
  const plaka = (id: number | null) => (id ? p.araclar.find((a) => a.id === id)?.plaka ?? '?' : 'araç yok');
  const sirali = [...p.atamalar].sort((a, b) => a.baslangic.localeCompare(b.baslangic));
  const kullanan = aracId ? p.suruculer.filter((x) => x.aktif && x.id !== p.surucuId && x.varsayilan_arac_id === Number(aracId)).map((x) => x.ad_soyad) : [];
  const ata = async () => {
    if (!/^\d{4}-\d{2}$/.test(ay)) return;
    const r = await islem(() => api('atamaKaydet', p.surucuId, ay, aracId ? Number(aracId) : null), `${ayAdi(ay)} itibarıyla ${aracId ? plaka(Number(aracId)) : 'araç yok'} olarak atandı.`);
    if (r !== undefined) { setAracId(''); p.degisti(); }
  };
  return (
    <div className="izgara" style={{ gap: 10 }}>
      <table className="tablo">
        <thead><tr><th>Geçerlilik</th><th>Araç</th><th>Atayan</th><th></th></tr></thead>
        <tbody>
          {sirali.map((x, i) => (
            <tr key={x.id}>
              <td className="kalin">{x.baslangic === '2000-01' ? 'En baştan beri' : `${ayAdi(x.baslangic)} ve sonrası`}{i === sirali.length - 1 && <span className="rozet ok" style={{ marginLeft: 6 }}>güncel</span>}</td>
              <td><Truck size={13} style={{ verticalAlign: -2 }} /> <b>{plaka(x.arac_id)}</b></td>
              <td className="soluk">{x.olusturan}</td>
              <td className="sag">{yonetici && sirali.length > 1 && <button type="button" className="btn ikon kucuk hayalet tehlike" title="Bu atamayı sil" onClick={async () => {
                if (await onay({ baslik: 'Atamayı sil', metin: `${x.baslangic} ayından itibaren geçerli ${plaka(x.arac_id)} ataması silinecek; o aylarda bir önceki atama geçerli olur.`, evet: 'Sil', tehlike: true })) { await islem(() => api('atamaSil', x.id)); p.degisti(); }
              }}><Trash2 size={13} /></button>}</td>
            </tr>
          ))}
          {!sirali.length && <tr><td colSpan={4} className="soluk">Atama kaydı yok.</td></tr>}
        </tbody>
      </table>
      {!yonetici && <div className="uyari-oge bilgi">Araç atamasını yalnız yönetici değiştirebilir; siz görüntüleyebilirsiniz.</div>}
      {yonetici && <div className="satir" style={{ alignItems: 'flex-end', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 9, padding: 10 }}>
        <div className="alan"><label><CalendarClock size={12} /> Bu aydan itibaren</label><input type="month" className="girdi" style={{ width: 160 }} value={ay} onChange={(e) => setAy(e.target.value)} /></div>
        <div className="alan" style={{ minWidth: 220 }}>
          <label>Yeni araç</label>
          <select className="girdi" value={aracId} onChange={(e) => setAracId(e.target.value)}>
            <option value="">— araç yok —</option>
            {p.araclar.filter((a) => a.aktif).map((a) => <option key={a.id} value={a.id}>{a.plaka} — {a.arac_tipi}</option>)}
          </select>
        </div>
        <button type="button" className="btn birincil" onClick={ata}>Ata</button>
      </div>}
      {kullanan.length > 0 && <div className="uyari-oge uyari">Bu araç {ayAdi(p.baslangicAy)} döneminde {kullanan.join(', ')} adlı sürücüye de atalı; araç iki sürücü arasında paylaşılmış olur.</div>}
      <div className="soluk kucuk-yazi">Geçmiş aylar değişmez: atama yalnız seçtiğiniz aydan itibaren geçerli olur. Kapalı bir dönemi etkileyen atama yapılamaz.</div>
    </div>
  );
}
