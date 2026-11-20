/**
 * Günlük kayıt formu — Excel plaka puantaj satırının form hali:
 * Tarih | Görevli personel | Gidilen yer | Çıkış/Dönüş KM | Araç çalışma İG/İGD | Sürücü çalışma | Yemek | Yol |
 * Çıkış/Dönüş saati | Fazla mesai | Hafta tatili | Resmi tatil | Dış görev | Konaklama
 * Sürücüye bağlı alanlar sürücüye, KM ve araç çalışma günü seçilen araca yazılır. Bir günde birden çok araç/görev eklenebilir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Save, Copy, Truck, User, Eraser, Wand2, ArrowRight, Loader2 } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { sayi, tarihTR } from '../lib/bicim';
import { BOS_GUN, bosSefer, GunVeri, SeferRow, surucuAyiYukle, gunKaydet, mesaiOnerisi, tarihKaydir, DURUM_SECENEK } from '../lib/gunluk';
import { useBildirim, SayiGirdi } from './temel';
import { OZELLIKLER } from '../../engine/ozellik';
import { gunSinifla, tatilHaritasi } from '../../engine/calendar';
import { yemekOtomatik } from '../../engine/kurum';

function Seg<T extends string | number>({ secenekler, deger, degis, disabled }: { secenekler: { d: T; ad: React.ReactNode; title?: string }[]; deger: T; degis: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="seg">
      {secenekler.map((s) => (
        <button type="button" key={String(s.d)} title={s.title} disabled={disabled} className={s.d === deger ? 'aktif' : ''} onClick={() => degis(s.d)}>{s.ad}</button>
      ))}
    </div>
  );
}

export interface GunlukFormProps {
  surucuId: number | null;
  tarih: string;
  setSurucuId: (id: number) => void;
  setTarih: (t: string) => void;
  kaydedildi?: () => void;
  kompakt?: boolean;
}

export default function GunlukForm({ surucuId, tarih, setSurucuId, setTarih, kaydedildi }: GunlukFormProps) {
  const { veri, kapali, oturum, yenile } = useBaglam();
  const bildir = useBildirim();
  const [v, setV] = useState<GunVeri>({ gun: { ...BOS_GUN }, seferler: [] });
  const [ayVeri, setAyVeri] = useState<Record<string, GunVeri>>({});
  const [kirli, setKirli] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const yuklenenAnahtar = useRef('');
  const veriRef = useRef(veri);
  veriRef.current = veri;
  const salt = kapali || oturum.saltOkunur;

  const suruculer = veri?.suruculer ?? [];
  const araclar = veri?.araclar ?? [];
  const surucu = suruculer.find((s) => s.id === surucuId);
  const aracById = useMemo(() => new Map(araclar.map((a) => [a.id, a])), [araclar]);
  const sinif = useMemo(() => (veri ? gunSinifla(tarih, tatilHaritasi(veri.tatiller), veri.params) : null), [veri, tarih]);
  const ay = tarih.slice(0, 7);

  // dışarıdan (liste tıklaması vb.) tarih/sürücü değişirse kaydedilmemiş değişiklik kaybolmasın
  const durumRef = useRef({ v, kirli, anahtar: '' });
  durumRef.current.v = v;
  durumRef.current.kirli = kirli;
  // Form kapanırken (ay değişimi, sayfa değişimi, pencere kapatma) kaydedilmemiş değişiklik kaybolmasın
  useEffect(() => () => {
    const d = durumRef.current;
    if (d.kirli && d.anahtar && !salt) {
      const [sid, t] = d.anahtar.split('|');
      gunKaydet(Number(sid), t, d.v).catch(() => {});
    }
  }, []);
  const yukle = useCallback(async () => {
    if (!surucuId) return;
    setYukleniyor(true);
    try {
      const d = durumRef.current;
      if (d.kirli && d.anahtar && d.anahtar !== `${surucuId}|${tarih}` && !salt) {
        const [sid, t] = d.anahtar.split('|');
        try { await gunKaydet(Number(sid), t, d.v); bildir('ok', `${tarihTR(t)} değişiklikleri kaydedildi.`); kaydedildi?.(); }
        catch (e: any) { bildir('hata', `${tarihTR(t)} kaydedilemedi: ${e.message}`); }
      }
      const m = await surucuAyiYukle(surucuId, ay);
      setAyVeri(m);
      const anahtar = `${surucuId}|${tarih}`;
      yuklenenAnahtar.current = anahtar;
      durumRef.current.anahtar = anahtar;
      durumRef.current.kirli = false;
      const g = m[tarih];
      if (g) setV({ gun: { ...g.gun }, seferler: g.seferler.map((s) => ({ ...s })) });
      else {
        // Kayıtsız gün: sürücünün o ayki aracı hazır seçili gelir (kaydedilene kadar veritabanına yazılmaz)
        const vv = veriRef.current;
        const kart = vv?.suruculer.find((x) => x.id === surucuId);
        const sn = vv ? gunSinifla(tarih, tatilHaritasi(vv.tatiller), vv.params) : null;
        setV({ gun: { ...BOS_GUN }, seferler: kart?.varsayilanAracId ? [bosSefer(kart.varsayilanAracId, !!(sn && (sn.X || sn.RTA || sn.DBA)))] : [] });
      }
      setKirli(false);
    } catch (e: any) { bildir('hata', e.message); }
    finally { setYukleniyor(false); }
  }, [surucuId, ay, tarih]);
  useEffect(() => { yukle(); }, [yukle]);

  const degis = (fn: (x: GunVeri) => void) => {
    if (salt) { bildir('bilgi', kapali ? 'Dönem kapalı; değişiklik yapılamaz.' : 'Salt okunur hesap.'); return; }
    setV((o) => { const x: GunVeri = { gun: { ...o.gun }, seferler: o.seferler.map((s) => ({ ...s })) }; fn(x); return x; });
    setKirli(true);
  };
  const gunAlan = <K extends keyof GunVeri['gun']>(k: K, val: GunVeri['gun'][K]) => degis((x) => { x.gun[k] = val; });
  const seferAlan = (i: number, fn: (s: SeferRow) => void) => degis((x) => fn(x.seferler[i]));

  const durumSec = (d: string) => degis((x) => {
    x.gun.durum = x.gun.durum === d ? '' : d;
    const calisti = x.gun.durum === 'X' || x.gun.durum === 'B';
    if (calisti && !x.seferler.length && surucu?.varsayilanAracId) x.seferler.push(bosSefer(surucu.varsayilanAracId, !!(sinif && (sinif.X || sinif.RTA || sinif.DBA))));
    // çalışmadı/izin/rapor: hiçbir bilgisi girilmemiş (yalnız hazır gelen) araç satırı kaldırılır
    if (!calisti) x.seferler = x.seferler.filter((s) => s.km_cikis != null || s.km_donus != null || s.gorev_yeri || s.gorevli || s.arac_igd);
  });

  /** aracın bu tarihten önceki son KM'si */
  const sonKm = (aracId: number | null, haric?: number): number | null => {
    if (!aracId || !veri) return null;
    let m: number | null = null;
    for (const s of veri.seferler) if (s.vehicleId === aracId && s.tarih < tarih) for (const k of [s.kmCikis, s.kmDonus]) if (k != null) m = Math.max(m ?? 0, k);
    v.seferler.forEach((s, i) => { if (i !== haric && s.arac_id === aracId) for (const k of [s.km_cikis, s.km_donus]) if (k != null) m = Math.max(m ?? 0, k); });
    return m ?? veri.oncekiKmOtomatik[aracId] ?? veri.aracAylari[aracId]?.oncekiKm ?? aracById.get(aracId)?.baslangicKm ?? null;
  };

  const otoYemek = yemekOtomatik({ driverId: 0, tarih, durum: v.gun.durum as any, fazlaMesai: v.gun.fazla_mesai, haftaTatili: !!v.gun.hafta_tatili, resmiTatil: v.gun.resmi_tatil, disGorev: v.gun.dis_gorev, konaklama: !!v.gun.konaklama, yemekOverride: null, yolOverride: null });
  const otoYol = otoYemek && (surucu?.yolHakki ?? true);
  const ozKapali = veri ? (Object.entries(veri.params.ozellikler ?? {}).filter(([, v]) => v === false).map(([k]) => k)) : [];
  const gunlukSaat = veri?.params.sozlesme.gunlukCalismaSaati ?? 9;
  const oneri = mesaiOnerisi(v.gun.cikis_saat, v.gun.donus_saat, gunlukSaat);
  const kismi = veri?.params.puantaj.disGorevKismi ?? 0.66;

  const uyarilar: string[] = [];
  v.seferler.forEach((s) => {
    if (s.km_cikis != null && s.km_donus != null && s.km_donus < s.km_cikis) uyarilar.push(`${aracById.get(s.arac_id ?? -1)?.plaka ?? ''}: dönüş KM çıkış KM'den küçük.`);
    if ((s.km_cikis == null) !== (s.km_donus == null)) uyarilar.push(`${aracById.get(s.arac_id ?? -1)?.plaka ?? ''}: çıkış veya dönüş KM eksik.`);
    const son = sonKm(s.arac_id, v.seferler.indexOf(s));
    if (s.km_cikis != null && son != null && s.km_cikis < son) uyarilar.push(`${aracById.get(s.arac_id ?? -1)?.plaka ?? ''}: çıkış KM (${sayi(s.km_cikis, 1)}) aracın son KM'sinden (${sayi(son, 1)}) küçük.`);
  });
  if (v.gun.fazla_mesai > 24) uyarilar.push('Fazla mesai 24 saati aşamaz.');
  if (v.gun.durum && v.gun.durum !== 'X' && v.gun.durum !== 'B' && (v.gun.fazla_mesai || v.gun.dis_gorev || v.gun.konaklama)) uyarilar.push('Durum "Çalıştı" değil ama mesai / dış görev / konaklama girilmiş.');
  if (!v.gun.durum && (v.gun.fazla_mesai || v.seferler.some((s) => s.km_cikis != null || s.km_donus != null || s.gorev_yeri || s.gorevli))) uyarilar.push('Sürücü çalışma durumu seçilmedi.');

  const kaydet = async (sonra?: 'sonraki' | 'onceki') => {
    if (!surucuId) return false;
    if (v.gun.fazla_mesai > 24 || v.seferler.some((s) => s.km_cikis != null && s.km_donus != null && s.km_donus < s.km_cikis)) {
      bildir('hata', 'Kaydedilemedi: ' + uyarilar[0]);
      return false;
    }
    setMesgul(true);
    try {
      await gunKaydet(surucuId, tarih, v);
      setKirli(false);
      bildir('ok', `${surucu?.adSoyad} — ${tarihTR(tarih)} kaydedildi.`);
      kaydedildi?.();
      yenile();
      if (sonra) setTarih(tarihKaydir(tarih, sonra === 'sonraki' ? 1 : -1));
      else yukle();
      return true;
    } catch (e: any) { bildir('hata', e.message); return false; }
    finally { setMesgul(false); }
  };

  /** Tarih / sürücü değişmeden önce kaydedilmemiş değişiklikleri kaydet */
  const gec = async (fn: () => void) => {
    if (kirli && !salt) { const ok = await kaydet(); if (!ok) return; }
    fn();
  };

  /** Kayıtlı günü onayla tümüyle siler (sürücü günü + o günkü araç satırları); kayıtlı değilse yalnız formu boşaltır */
  const gunuSil = async () => {
    if (!surucuId) return;
    if (!ayVeri[tarih]) { degis((x) => { x.gun = { ...BOS_GUN }; x.seferler = []; }); return; }
    if (!window.confirm(`${surucu?.adSoyad} — ${tarihTR(tarih)} günlük kaydı silinsin mi?

Mesai, görev ve KM bilgileri kaldırılır. Önceki hali Değişiklik Kaydı'nda tutulur.`)) return;
    setMesgul(true);
    try {
      await gunKaydet(surucuId, tarih, { gun: { ...BOS_GUN }, seferler: [] });
      setKirli(false);
      bildir('ok', `${tarihTR(tarih)} kaydı silindi.`);
      kaydedildi?.();
      yenile();
      yukle();
    } catch (e: any) { bildir('hata', e.message); }
    finally { setMesgul(false); }
  };

  const oncekiGundenKopyala = () => {
    let t = tarihKaydir(tarih, -1);
    for (let i = 0; i < 10 && !ayVeri[t] && t.slice(0, 7) === ay; i++) t = tarihKaydir(t, -1);
    const o = ayVeri[t];
    if (!o) { bildir('bilgi', 'Bu ay içinde kopyalanacak önceki kayıt bulunamadı.'); return; }
    degis((x) => {
      x.gun = { ...o.gun, notlar: '' };
      x.seferler = o.seferler.map((s) => ({ ...s, km_cikis: null, km_donus: null }));
    });
    bildir('bilgi', `${tarihTR(t)} kaydı kopyalandı (KM'ler hariç). Kaydetmeyi unutmayın.`);
  };

  // klavye: Ctrl+S kaydet, Ctrl+Enter kaydet ve sonraki gün, Alt+←/→ gün değiştir
  const kRef = useRef({ kaydet, gec });
  kRef.current = { kaydet, gec };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); kRef.current.kaydet(); }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); kRef.current.kaydet('sonraki'); }
      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); const t = tarihKaydir(tarih, e.key === 'ArrowRight' ? 1 : -1); kRef.current.gec(() => setTarih(t)); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [tarih, setTarih]);

  if (!veri) return <div className="yukleniyor">Yükleniyor…</div>;
  const wd = sinif?.weekday ?? 1;
  const tipEtiket = sinif ? (sinif.RT ? 'Resmi tatil' : sinif.DB ? 'Dini bayram' : sinif.RTA ? 'Resmi tatil arifesi' : sinif.DBA ? 'Bayram arifesi' : sinif.Ctesi || sinif.Pzr ? 'Hafta sonu' : 'İş günü') : '';
  const tipRenk = sinif && (sinif.RT || sinif.DB) ? 'hata' : sinif && (sinif.RTA || sinif.DBA) ? 'uyari' : sinif && (sinif.Ctesi || sinif.Pzr) ? 'mavi' : 'ok';

  return (
    <div className="gunluk-form">
      {/* üst: sürücü + tarih */}
      <div className="gf-ust">
        <div className="alan" style={{ minWidth: 260, flex: 1 }}>
          <label><User size={12} /> Sürücü</label>
          <select className="girdi" value={surucuId ?? ''} onChange={(e) => { const id = Number(e.target.value); gec(() => setSurucuId(id)); }}>
            {suruculer.map((s) => <option key={s.id} value={s.id}>{s.adSoyad} — {aracById.get(s.varsayilanAracId ?? -1)?.plaka ?? 'araç yok'}</option>)}
          </select>
        </div>
        <div className="alan">
          <label>Tarih</label>
          <div className="satir" style={{ gap: 4, flexWrap: 'nowrap' }}>
            <button className="btn ikon" title="Önceki gün (Alt+←)" onClick={() => gec(() => setTarih(tarihKaydir(tarih, -1)))}><ChevronLeft size={16} /></button>
            <input type="date" className="girdi" style={{ width: 160 }} value={tarih} onChange={(e) => { const t = e.target.value; if (t) gec(() => setTarih(t)); }} />
            <button className="btn ikon" title="Sonraki gün (Alt+→)" onClick={() => gec(() => setTarih(tarihKaydir(tarih, 1)))}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="alan">
          <label>&nbsp;</label>
          <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 6 }}>
            <b>{['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][wd - 1]}</b>
            <span className={`rozet ${tipRenk}`}>{tipEtiket}</span>
            {sinif?.ad && <span className="soluk kucuk-yazi">{sinif.ad}</span>}
          </div>
        </div>
        <div className="bosluk" />
        {yukleniyor && <Loader2 size={16} className="don" />}
        {kirli && <span className="rozet uyari">Kaydedilmedi</span>}
      </div>

      {/* 1) sürücü çalışma */}
      <div className="gf-bolum">
        <div className="gf-baslik"><User size={15} /> Sürücü çalışma</div>
        <div className="seg genis" style={{ marginBottom: 12 }}>
          {DURUM_SECENEK.map((d) => (
            <button key={d.kod} type="button" disabled={salt} className={v.gun.durum === d.kod ? `aktif d-${d.kod === 'Sİ' ? 'SI' : d.kod === 'Üİ' ? 'UI' : d.kod === 'Mİ' ? 'MI' : d.kod === 'İİ' ? 'II' : d.kod === '0' ? 'S0' : d.kod}` : ''} onClick={() => durumSec(d.kod)} title={d.ad}>
              <b>{d.kod}</b> <span>{d.ad}</span>
            </button>
          ))}
        </div>
        <div className="gf-izgara">
          <div className="alan"><label>Çıkış saati</label><input type="time" className="girdi" disabled={salt} value={v.gun.cikis_saat} onChange={(e) => gunAlan('cikis_saat', e.target.value)} /></div>
          <div className="alan"><label>Dönüş saati</label><input type="time" className="girdi" disabled={salt} value={v.gun.donus_saat} onChange={(e) => gunAlan('donus_saat', e.target.value)} /></div>
          <div className="alan">
            <label>Fazla mesai (saat)</label>
            <SayiGirdi deger={v.gun.fazla_mesai || null} yerTutucu="0" disabled={salt} degis={(x) => gunAlan('fazla_mesai', x ?? 0)} />
            {oneri != null && oneri !== v.gun.fazla_mesai && (
              <button type="button" className="btn kucuk hayalet" style={{ alignSelf: 'start', paddingLeft: 0, color: 'var(--accent)' }} disabled={salt} onClick={() => gunAlan('fazla_mesai', oneri)}>
                <Wand2 size={13} /> Saatlere göre öneri: {sayi(oneri)} saat (günlük {gunlukSaat} saat üstü)
              </button>
            )}
          </div>
          <div className="alan"><label>Hafta tatili çalışması</label>
            <Seg disabled={salt} deger={v.gun.hafta_tatili ? 1 : 0} degis={(x) => gunAlan('hafta_tatili', x)} secenekler={[{ d: 0, ad: 'Yok' }, { d: 1, ad: 'Çalıştı (X)' }]} />
          </div>
          <div className="alan"><label>Resmi tatil çalışması</label>
            <Seg disabled={salt} deger={v.gun.resmi_tatil} degis={(x) => gunAlan('resmi_tatil', x)} secenekler={[{ d: 0, ad: 'Yok' }, { d: 0.5, ad: 'Yarım' }, { d: 1, ad: 'Tam gün' }]} />
          </div>
          <div className="alan"><label>Dış görev</label>
            <Seg disabled={salt} deger={v.gun.dis_gorev === 1 ? 1 : v.gun.dis_gorev ? kismi : 0} degis={(x) => gunAlan('dis_gorev', x)} secenekler={[{ d: 0, ad: 'Yok' }, { d: kismi, ad: '⅔ mesai', title: `${sayi(kismi)} gün` }, { d: 1, ad: 'Tam (X)' }]} />
          </div>
          <div className="alan"><label>Konaklama</label>
            <Seg disabled={salt} deger={v.gun.konaklama ? 1 : 0} degis={(x) => gunAlan('konaklama', x)} secenekler={[{ d: 0, ad: 'Yok' }, { d: 1, ad: 'Var (X)' }]} />
          </div>
          <div className="alan"><label>Yemek</label>
            <Seg disabled={salt} deger={v.gun.yemek_override == null ? 'oto' : v.gun.yemek_override ? 'var' : 'yok'}
              degis={(x) => gunAlan('yemek_override', x === 'oto' ? null : x === 'var' ? 1 : 0)}
              secenekler={[{ d: 'oto', ad: <>Otomatik ({otoYemek ? 'var' : 'yok'})</> }, { d: 'var', ad: 'Var' }, { d: 'yok', ad: 'Yok' }]} />
          </div>
          <div className="alan"><label>Yol</label>
            <Seg disabled={salt} deger={v.gun.yol_override == null ? 'oto' : v.gun.yol_override ? 'var' : 'yok'}
              degis={(x) => gunAlan('yol_override', x === 'oto' ? null : x === 'var' ? 1 : 0)}
              secenekler={[{ d: 'oto', ad: <>Otomatik ({otoYol ? 'var' : 'yok'})</> }, { d: 'var', ad: 'Var' }, { d: 'yok', ad: 'Yok' }]} />
          </div>
          <div className="alan" style={{ gridColumn: 'span 2' }}><label>Not</label><input className="girdi" disabled={salt} value={v.gun.notlar} onChange={(e) => gunAlan('notlar', e.target.value)} placeholder="İsteğe bağlı açıklama" /></div>
        </div>
      </div>

      {/* 2) görev ve araç */}
      <div className="gf-bolum">
        <div className="gf-baslik"><Truck size={15} /> Görev ve araç (KM ve araç çalışma günü araca yazılır)</div>
        {!v.seferler.length && <div className="soluk" style={{ marginBottom: 10 }}>Bu gün için araç / görev satırı yok. Sürücünün aracı {surucu && aracById.get(surucu.varsayilanAracId ?? -1)?.plaka ? `(${aracById.get(surucu.varsayilanAracId!)!.plaka}) ` : ''}"Çalıştı" seçince otomatik eklenir; "Araç / görev ekle" ile başka plaka da seçebilirsiniz.</div>}
        {v.seferler.map((s, i) => {
          const son = sonKm(s.arac_id, i);
          const km = s.km_cikis != null && s.km_donus != null ? s.km_donus - s.km_cikis : null;
          const baska = s.arac_id && s.arac_id !== surucu?.varsayilanAracId;
          return (
            <div key={i} className="gf-sefer">
              <div className="alan" style={{ width: 170 }}>
                <label>Araç {baska && <span className="rozet uyari">başka araç</span>}</label>
                <select className="girdi" disabled={salt} value={s.arac_id ?? ''} onChange={(e) => seferAlan(i, (x) => { x.arac_id = e.target.value ? Number(e.target.value) : null; x.km_cikis = null; x.km_donus = null; })}>
                  <option value="">— seçiniz —</option>
                  {araclar.filter((a) => a.aktif || a.id === s.arac_id).map((a) => <option key={a.id} value={a.id}>{a.plaka}{a.id === surucu?.varsayilanAracId ? ' (varsayılan)' : ''}</option>)}
                </select>
              </div>
              <div className="alan" style={{ flex: 1, minWidth: 160 }}><label>Görevli personelin adı soyadı</label><input className="girdi" disabled={salt} value={s.gorevli} onChange={(e) => seferAlan(i, (x) => { x.gorevli = e.target.value; })} /></div>
              <div className="alan" style={{ flex: 1, minWidth: 160 }}><label>Görevli gidilen yer</label><input className="girdi" disabled={salt} value={s.gorev_yeri} onChange={(e) => seferAlan(i, (x) => { x.gorev_yeri = e.target.value; })} /></div>
              <div className="alan" style={{ width: 120 }}>
                <label>Çıkış KM</label>
                <SayiGirdi deger={s.km_cikis} ondalik={1} disabled={salt} yerTutucu={son != null ? sayi(son, 1) : ''} title={son != null ? `Aracın son KM'si: ${sayi(son, 1)}` : undefined}
                  degis={(x) => seferAlan(i, (y) => { y.km_cikis = x; })} />
                {s.km_cikis == null && son != null && <button type="button" className="btn kucuk hayalet" style={{ paddingLeft: 0, color: 'var(--accent)' }} disabled={salt} onClick={() => seferAlan(i, (y) => { y.km_cikis = son; })}>son KM'yi kullan</button>}
              </div>
              <div className="alan" style={{ width: 120 }}><label>Dönüş KM</label><SayiGirdi deger={s.km_donus} ondalik={1} disabled={salt} degis={(x) => seferAlan(i, (y) => { y.km_donus = x; })} /></div>
              <div className="alan" style={{ width: 80 }}><label>Toplam KM</label><div className="girdi oto sayi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: km != null && km < 0 ? 'var(--err)' : undefined }}>{km != null ? sayi(km, 1) : ''}</div></div>
              <div className="alan">
                <label>Araç çalışma</label>
                <Seg disabled={salt} deger={s.arac_ig ? 'ig' : s.arac_igd === 1 ? 'igd1' : s.arac_igd ? 'igd5' : 'yok'}
                  degis={(x) => seferAlan(i, (y) => { y.arac_ig = x === 'ig' ? 1 : 0; y.arac_igd = x === 'igd1' ? 1 : x === 'igd5' ? 0.5 : 0; })}
                  secenekler={[{ d: 'yok', ad: 'Yok' }, { d: 'ig', ad: 'İG', title: 'İş günü' }, { d: 'igd5', ad: 'İGD ½', title: 'İş günü dışı yarım' }, { d: 'igd1', ad: 'İGD 1', title: 'İş günü dışı tam' }]} />
              </div>
              <button type="button" className="btn ikon hayalet tehlike" style={{ alignSelf: 'end' }} disabled={salt} title="Bu araç / görev satırını sil" onClick={() => degis((x) => { x.seferler.splice(i, 1); })}><Trash2 size={15} /></button>
            </div>
          );
        })}
        <button type="button" className="btn kucuk" disabled={salt} onClick={() => degis((x) => { x.seferler.push(bosSefer(x.seferler.length ? null : surucu?.varsayilanAracId ?? null, !!(sinif?.X) && !x.seferler.length)); })}>
          <Plus size={14} /> Araç / görev ekle
        </button>
      </div>

      {ozKapali.length > 0 && (
        <div className="uyari-oge bilgi" style={{ marginBottom: 12 }}>
          Bu dönemde <b>kapalı ödeme kalemleri</b> var: {OZELLIKLER.filter((o) => ozKapali.includes(o.anahtar)).map((o) => o.ad).join(', ')}. Bu kalemler girilse bile hesaba katılmaz (Ayarlar › Hızlı Ayar).
        </div>
      )}

      {uyarilar.length > 0 && (
        <div className="uyari-liste" style={{ marginBottom: 12 }}>{uyarilar.map((u, i) => <div key={i} className="uyari-oge uyari">{u}</div>)}</div>
      )}

      <div className="gf-alt">
        <button className="btn" disabled={salt} onClick={oncekiGundenKopyala} title="Önceki kayıtlı günün bilgilerini kopyala (KM hariç)"><Copy size={15} /> Önceki günden kopyala</button>
        <button className="btn tehlike" disabled={salt || mesgul} onClick={gunuSil} title={ayVeri[tarih] ? 'Bu günün kaydını kalıcı olarak siler (önceki hali Değişiklik Kaydı sayfasında kalır)' : 'Formdaki bilgileri temizler'}><Eraser size={15} /> {ayVeri[tarih] ? 'Günü sil' : 'Günü temizle'}</button>
        <div className="bosluk" />
        <span className="soluk kucuk-yazi"><kbd>Ctrl+S</kbd> kaydet · <kbd>Ctrl+Enter</kbd> kaydet ve sonraki gün · <kbd>Alt+←/→</kbd> gün</span>
        <button className="btn" disabled={salt || mesgul} onClick={() => kaydet()}><Save size={15} /> Kaydet</button>
        <button className="btn birincil" disabled={salt || mesgul} onClick={() => kaydet('sonraki')}>Kaydet ve sonraki gün <ArrowRight size={15} /></button>
      </div>
    </div>
  );
}
