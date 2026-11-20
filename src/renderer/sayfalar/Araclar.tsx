import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Search, Truck } from 'lucide-react';
import { api } from '../lib/api';
import { useBaglam } from '../lib/baglam';
import { Alan, Modal, SayiGirdi, useBildirim, useIslem, useOnay, BosDurum } from '../ui/temel';
import { sayi, tl, ayAdi } from '../lib/bicim';

interface AracRow {
  id?: number; plaka: string; marka_model: string; model_yili: number | null; arac_tipi: string; gorev_yeri: string; tuketim_orani: number;
  kira_bedeli: number; yakit_yansitma_carpani: number; baslangic_km: number | null; aktif: number; notlar: string; sira?: number;
}
const BOS: AracRow = { plaka: '', marka_model: '', model_yili: null, arac_tipi: '', gorev_yeri: '', tuketim_orani: 0, kira_bedeli: 0, yakit_yansitma_carpani: 1, baslangic_km: null, aktif: 1, notlar: '' };
const TIPLER = ['BİNEK (4+1)', 'KOMBİ (4+1)', 'KAMYONET (4+1)', 'KAMYONET (5+1)', 'KAMYONET (6+1)', 'KAMYONET (4X4)', 'MİNİBÜS (16+1)', 'KAMYON (H.PLATFORM)', 'YSİP'];

export default function Araclar() {
  const { oturum, yenile, veri, ay, yonetici } = useBaglam();
  const [liste, setListe] = useState<AracRow[]>([]);
  const [suruculer, setSuruculer] = useState<any[]>([]);
  const [duzen, setDuzen] = useState<AracRow | null>(null);
  const [arama, setArama] = useState('');
  const [pasifGoster, setPasifGoster] = useState(false);
  const islem = useIslem();
  const onay = useOnay();
  const bildir = useBildirim();
  const salt = oturum.saltOkunur;
  const yukle = async () => {
    const [a, s] = await Promise.all([api<AracRow[]>('araclar'), api<any[]>('suruculer')]);
    setListe(a); setSuruculer(s);
  };
  useEffect(() => { yukle(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && e.key.toLowerCase() === 'n' && !salt) { e.preventDefault(); setDuzen({ ...BOS }); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [salt]);
  const surucuAd = useMemo(() => {
    const m = new Map<number, string[]>();
    const ayMap = new Map((veri?.suruculer ?? []).map((x) => [x.id, x.varsayilanAracId]));
    for (const s of suruculer) {
      const aid = ayMap.has(s.id) ? ayMap.get(s.id) : s.varsayilan_arac_id; // seçili ayın (dönem bazlı) eşleşmesi
      if (s.aktif && aid) m.set(aid, [...(m.get(aid) ?? []), s.ad_soyad]);
    }
    return m;
  }, [suruculer, veri]);
  const tipler = useMemo(() => [...new Set([...TIPLER, ...liste.map((a) => a.arac_tipi).filter(Boolean)])], [liste]);
  const gorevYerleri = useMemo(() => [...new Set(liste.map((a) => a.gorev_yeri).filter(Boolean))].sort(), [liste]);
  const norm = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s/g, '');
  const gorunen = liste.filter((a) => (pasifGoster || a.aktif) && (!arama || norm(a.plaka).includes(norm(arama)) || norm(a.arac_tipi).includes(norm(arama)) || norm(a.gorev_yeri).includes(norm(arama))));

  const kaydet = async () => {
    if (!duzen) return;
    const r = await islem(() => api('aracKaydet', duzen), 'Araç kaydedildi');
    if (r !== undefined) { setDuzen(null); await yukle(); yenile(); }
  };
  const sil = async (a: AracRow) => {
    if (!(await onay({ baslik: 'Aracı sil', metin: `${a.plaka} silinsin mi?\nSefer kaydı varsa silinmez, pasif yapılır.`, evet: 'Sil', tehlike: true }))) return;
    const r = await islem(() => api('aracSil', a.id));
    if (r) { bildir('ok', r.silindi ? 'Araç silindi.' : 'Aracın kayıtları olduğu için pasif yapıldı.'); await yukle(); yenile(); }
  };
  const tasi = async (i: number, yon: -1 | 1) => {
    const aktifler = liste.filter((a) => a.aktif);
    const j = i + yon;
    if (j < 0 || j >= aktifler.length) return;
    const ids = aktifler.map((a) => a.id!);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await islem(() => api('siraKaydet', 'araclar', ids));
    await yukle(); yenile();
  };

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="satir">
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
          <input className="girdi" style={{ paddingLeft: 32 }} placeholder="Plaka, tip veya görev yeri ara…" value={arama} onChange={(e) => setArama(e.target.value)} />
        </div>
        <label className="onay"><input type="checkbox" checked={pasifGoster} onChange={(e) => setPasifGoster(e.target.checked)} /> Pasifleri göster</label>
        <div className="bosluk" />
        <span className="soluk">{liste.filter((a) => a.aktif).length} aktif araç</span>
        <button className="btn birincil" disabled={salt} onClick={() => setDuzen({ ...BOS })}><Plus size={16} /> Yeni araç <kbd style={{ marginLeft: 4 }}>Ctrl+N</kbd></button>
      </div>
      <div className="kart tablo-sar">
        {!liste.length ? <BosDurum ikon={<Truck size={36} />} baslik="Kayıtlı araç yok" metin="Yeni araç ekleyin veya Veritabanı ekranından Excel içe aktarın." /> : (
          <table className="tablo">
            <thead><tr><th style={{ width: 70 }}>Sıra</th><th>Plaka</th><th>Marka / Model</th><th>Yıl</th><th>Araç tipi</th><th>Görev yeri</th><th>Sürücü ({ayAdi(ay)})</th><th className="sayi">Tüketim (lt/km)</th><th className="sayi">Kira bedeli</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {gorunen.map((a) => {
                const ai = liste.filter((x) => x.aktif).findIndex((x) => x.id === a.id);
                const s = surucuAd.get(a.id!) ?? [];
                return (
                  <tr key={a.id} className="tikla" onDoubleClick={() => !salt && setDuzen({ ...a })} style={{ opacity: a.aktif ? 1 : 0.55 }}>
                    <td>{a.aktif ? <div className="satir" style={{ gap: 0, flexWrap: 'nowrap' }}>
                      <span className="soluk" style={{ width: 22 }}>{ai + 1}</span>
                      <button className="btn ikon kucuk hayalet" disabled={salt || ai === 0} onClick={() => tasi(ai, -1)}><ArrowUp size={13} /></button>
                      <button className="btn ikon kucuk hayalet" disabled={salt} onClick={() => tasi(ai, 1)}><ArrowDown size={13} /></button>
                    </div> : '—'}</td>
                    <td className="kalin">{a.plaka}</td>
                    <td>{a.marka_model}</td>
                    <td>{a.model_yili ?? ''}</td>
                    <td>{a.arac_tipi}</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.gorev_yeri}>{a.gorev_yeri}</td>
                    <td>{s.length ? s.join(', ') : <span className="soluk">—</span>}</td>
                    <td className="sayi">{sayi(a.tuketim_orani, 3)}</td>
                    <td className="sayi">{tl(a.kira_bedeli)}</td>
                    <td>{a.aktif ? <span className="rozet ok">Aktif</span> : <span className="rozet">Pasif</span>}{a.yakit_yansitma_carpani !== 1 && <span className="rozet uyari" title="Yakıt yansıtma çarpanı">×{a.yakit_yansitma_carpani}</span>}</td>
                    <td className="sag">
                      <button className="btn ikon kucuk hayalet" disabled={salt} onClick={() => setDuzen({ ...a })} title="Düzenle"><Pencil size={14} /></button>
                      <button className="btn ikon kucuk hayalet tehlike" disabled={salt || !yonetici} onClick={() => sil(a)} title={yonetici ? 'Sil' : 'Silme yetkisi yalnız yöneticidedir'}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {duzen && (
        <Modal baslik={duzen.id ? `Araç: ${duzen.plaka}` : 'Yeni araç'} kapat={() => setDuzen(null)} boyut="genis"
          alt={<><button className="btn" onClick={() => setDuzen(null)}>Vazgeç</button><button className="btn birincil" onClick={kaydet}>Kaydet</button></>}>
          <form onSubmit={(e) => { e.preventDefault(); kaydet(); }} className="izgara k3">
            <Alan etiket="Plaka *"><input className="girdi" autoFocus value={duzen.plaka} placeholder="06 ABC 123" onChange={(e) => setDuzen({ ...duzen, plaka: e.target.value.toLocaleUpperCase('tr-TR') })} /></Alan>
            <Alan etiket="Marka / Model"><input className="girdi" value={duzen.marka_model} onChange={(e) => setDuzen({ ...duzen, marka_model: e.target.value.toLocaleUpperCase('tr-TR') })} /></Alan>
            <Alan etiket="Model yılı"><SayiGirdi deger={duzen.model_yili} ondalik={0} degis={(v) => setDuzen({ ...duzen, model_yili: v })} /></Alan>
            <Alan etiket="Araç tipi">
              <input className="girdi" list="tipler" value={duzen.arac_tipi} onChange={(e) => setDuzen({ ...duzen, arac_tipi: e.target.value.toLocaleUpperCase('tr-TR') })} />
              <datalist id="tipler">{tipler.map((t) => <option key={t} value={t} />)}</datalist>
            </Alan>
            <Alan etiket="Görev yeri" style={{ gridColumn: 'span 2' }}>
              <input className="girdi" list="gorevler" value={duzen.gorev_yeri} onChange={(e) => setDuzen({ ...duzen, gorev_yeri: e.target.value.toLocaleUpperCase('tr-TR') })} />
              <datalist id="gorevler">{gorevYerleri.map((t) => <option key={t} value={t} />)}</datalist>
            </Alan>
            <Alan etiket="Yakıt tüketim oranı (lt/km)" ipucu="Hizmet dışı KM yakıt yansıtmasında kullanılır."><SayiGirdi deger={duzen.tuketim_orani} ondalik={4} degis={(v) => setDuzen({ ...duzen, tuketim_orani: v ?? 0 })} /></Alan>
            <Alan etiket="Aylık kira bedeli (TL)"><SayiGirdi deger={duzen.kira_bedeli} degis={(v) => setDuzen({ ...duzen, kira_bedeli: v ?? 0 })} /></Alan>
            <Alan etiket="Başlangıç KM" ipucu="İlk ay için 'önceki ay kapanış KM' (sonra otomatik)."><SayiGirdi deger={duzen.baslangic_km} ondalik={1} degis={(v) => setDuzen({ ...duzen, baslangic_km: v })} /></Alan>
            <Alan etiket="Yakıt yansıtma çarpanı" ipucu="Normalde 1. Excel'de bazı araçlarda 2 kullanılmış."><SayiGirdi deger={duzen.yakit_yansitma_carpani} ondalik={3} degis={(v) => setDuzen({ ...duzen, yakit_yansitma_carpani: v ?? 1 })} /></Alan>
            <Alan etiket="Durum"><label className="onay" style={{ height: 34 }}><input type="checkbox" checked={!!duzen.aktif} onChange={(e) => setDuzen({ ...duzen, aktif: e.target.checked ? 1 : 0 })} /> Aktif</label></Alan>
            <Alan etiket="Notlar"><input className="girdi" value={duzen.notlar} onChange={(e) => setDuzen({ ...duzen, notlar: e.target.value })} /></Alan>
            <button type="submit" hidden />
          </form>
        </Modal>
      )}
    </div>
  );
}
