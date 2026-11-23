/**
 * Günlük kayıt formu — Excel plaka puantaj satırının form hali:
 * Tarih | Görevli personel | Gidilen yer | Çıkış/Dönüş KM | Araç çalışma İG/İGD | Sürücü çalışma | Yemek | Yol |
 * Çıkış/Dönüş saati | Fazla mesai | Hafta tatili | Resmi tatil | Dış görev | Konaklama
 * Sürücüye bağlı alanlar sürücüye, KM ve araç çalışma günü seçilen araca yazılır. Bir günde birden çok araç/görev eklenebilir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2, Save, Copy, Truck, User, Eraser, ArrowRight, Loader2, Clock } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { sayi, tarihTR } from '../lib/bicim';
import { BOS_GUN, bosSefer, GunVeri, SeferRow, surucuAyiYukle, gunKaydet, tarihKaydir, DURUM_SECENEK } from '../lib/gunluk';
import { api } from '../lib/api';
import CokluSecim from './CokluSecim';
import { gorevMesai, gorevSuresi, gorevAraligi, gorevCakismasi, kuralHazirla, MESAI_MODLARI, MesaiKurali } from '../../engine/mesai';
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
  /** true ise kayıtlı bir gün değiştirilirken kaydetmeden önce eski -> yeni fark gösterilip onay istenir */
  onayli?: boolean;
}

/**
 * Görev saatlerinden her görevin fazla mesaisini hesaplar ve gün toplamına yazar.
 * Saat girilmiş (ya da "elle" seçilmiş) görev varsa gün toplamı görevlerin toplamıdır; yoksa gün alanı olduğu gibi kalır (eski kayıtlar).
 * Günün çıkış / dönüş saati ilk ve son görevden türetilir.
 */
function gorevlerdenHesapla(x: GunVeri, kural: MesaiKurali) {
  let aktif = false, toplam = 0;
  for (const s of x.seferler) {
    if (s.mesai_mod === 'elle') aktif = true;
    else {
      const m = gorevMesai(s.cikis_saat, s.donus_saat, s.mesai_mod, kural);
      s.fazla_mesai = m ?? 0;
      if (m != null) aktif = true;
    }
    toplam += s.fazla_mesai || 0;
  }
  if (aktif) x.gun.fazla_mesai = toplam;
  const saatli = x.seferler.filter((s) => s.cikis_saat && s.donus_saat);
  if (saatli.length) { x.gun.cikis_saat = saatli[0].cikis_saat; x.gun.donus_saat = saatli[saatli.length - 1].donus_saat; }
}
const mesaiOtomatikMi = (x: GunVeri) => x.seferler.some((s) => s.mesai_mod === 'elle' || (s.cikis_saat && s.donus_saat && gorevAraligi(s.cikis_saat, s.donus_saat)));

const ALAN_AD: Record<string, string> = {
  durum: 'Durum', fazla_mesai: 'Fazla mesai (sa)', hafta_tatili: 'Hafta tatili', resmi_tatil: 'Resmi tatil', dis_gorev: 'Dış görev', konaklama: 'Konaklama',
  yemek_override: 'Yemek', yol_override: 'Yol', cikis_saat: 'Çıkış saati', donus_saat: 'Dönüş saati', notlar: 'Not',
};
const degerMetni = (k: string, x: any) => {
  if (k === 'yemek_override' || k === 'yol_override') return x == null ? 'otomatik' : x ? 'var' : 'yok';
  if (k === 'hafta_tatili' || k === 'konaklama') return x ? 'var' : 'yok';
  return x === '' || x == null || x === 0 ? '—' : String(x);
};
/** Kayıtlı gün ile formdaki gün arasındaki fark satırları (eski → yeni) */
function gunFarki(eski: GunVeri, yeni: GunVeri): string[] {
  const out: string[] = [];
  for (const k of Object.keys(ALAN_AD)) {
    const a = (eski.gun as any)[k], b = (yeni.gun as any)[k];
    if (degerMetni(k, a) !== degerMetni(k, b)) out.push(`• ${ALAN_AD[k]}: ${degerMetni(k, a)} → ${degerMetni(k, b)}`);
  }
  const sefer = (x: GunVeri) => x.seferler.map((s) => `${s.arac_id}:${s.km_cikis ?? ''}-${s.km_donus ?? ''}:${s.gorev_yeri}`).join(' | ') || '—';
  if (sefer(eski) !== sefer(yeni)) out.push('• Araç / KM / görev yeri bilgisi değişti');
  return out;
}

export default function GunlukForm({ surucuId, tarih, setSurucuId, setTarih, kaydedildi, onayli }: GunlukFormProps) {
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
  const kural = useMemo(() => kuralHazirla(veri?.params.puantaj.fazlaMesaiBaslangic, veri?.params.puantaj.mesaiYukariDk), [veri?.params.puantaj.fazlaMesaiBaslangic, veri?.params.puantaj.mesaiYukariDk]);
  const [kartKapali, setKartKapali] = useState<Record<number, boolean>>({});
  const [listeler, setListeler] = useState<{ personel: { ad: string }[]; yerler: { ad: string }[] }>({ personel: [], yerler: [] });
  const listeYukle = useCallback(() => { api<any>('listeler').then(setListeler).catch(() => {}); }, []);
  useEffect(() => { listeYukle(); }, [listeYukle]);

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
    setV((o) => { const x: GunVeri = { gun: { ...o.gun }, seferler: o.seferler.map((s) => ({ ...s })) }; fn(x); gorevlerdenHesapla(x, kural); return x; });
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

  const otoYemek = yemekOtomatik({ driverId: 0, tarih, durum: v.gun.durum as any, fazlaMesai: v.gun.fazla_mesai, haftaTatili: !!v.gun.hafta_tatili, resmiTatil: v.gun.resmi_tatil, disGorev: v.gun.dis_gorev, konaklama: !!v.gun.konaklama, yemekOverride: null, yolOverride: null }, !!veri?.params.puantaj.disGorevdeYemekYol);
  const otoYol = otoYemek && (surucu?.yolHakki ?? true);
  const ozKapali = veri ? (Object.entries(veri.params.ozellikler ?? {}).filter(([, v]) => v === false).map(([k]) => k)) : [];
  const gunlukSaat = veri?.params.sozlesme.gunlukCalismaSaati ?? 9;
  /** Harici km için karşılaştırılacak önceki KM: aynı günün önceki görevi (aynı araç), yoksa aracın önceki kaydı */
  const oncekiKmRef = (aracId: number | null, i: number): number | null => {
    if (!aracId) return null;
    for (let j = i - 1; j >= 0; j--) {
      const p = v.seferler[j];
      if (p.arac_id === aracId) { const k = p.km_donus ?? p.km_cikis; if (k != null) return k; }
    }
    if (!veri) return null;
    let bt = '', bk: number | null = null;
    for (const s2 of veri.seferler) {
      if (s2.vehicleId !== aracId || s2.tarih >= tarih) continue;
      const k = s2.kmDonus ?? s2.kmCikis;
      if (k != null && s2.tarih >= bt) { bt = s2.tarih; bk = k; }
    }
    return bk ?? veri.oncekiKmOtomatik[aracId] ?? null;
  };
  const kismi = veri?.params.puantaj.disGorevKismi ?? 0.66;

  const uyarilar: string[] = [];
  const cakisma = gorevCakismasi(v.seferler.filter((s) => s.arac_id));
  if (cakisma) uyarilar.push(`${cakisma[0] + 1}. ve ${cakisma[1] + 1}. görevin saatleri çakışıyor; aynı saat iki kez sayılamaz.`);
  v.seferler.forEach((s, i) => {
    const ref = oncekiKmRef(s.arac_id, i);
    if (s.km_cikis != null && ref != null && s.km_cikis < ref) uyarilar.push(`${i + 1}. görev: giriş KM (${sayi(s.km_cikis, 1)}) aracın önceki çıkış KM'sinden (${sayi(ref, 1)}) küçük; harici km yazılmaz.`);
    if (s.cikis_saat && !s.donus_saat || !s.cikis_saat && s.donus_saat) uyarilar.push(`${i + 1}. görev: başlangıç ve bitiş saatinin ikisi de girilmeli.`);
  });
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
    if (cakisma || v.gun.fazla_mesai > 24 || v.seferler.some((s) => s.km_cikis != null && s.km_donus != null && s.km_donus < s.km_cikis)) {
      bildir('hata', 'Kaydedilemedi: ' + uyarilar[0]);
      return false;
    }
    if (onayli && ayVeri[tarih]) {
      const satirlar = gunFarki(ayVeri[tarih], v);
      if (!satirlar.length) { setKirli(false); bildir('bilgi', 'Değişiklik yok.'); return true; }
      const uyari = uyarilar.length ? `\n\nUYARI:\n- ${uyarilar.join('\n- ')}` : '';
      if (!window.confirm(`${surucu?.adSoyad} — ${tarihTR(tarih)} kaydı şu şekilde değiştirilecek:\n\n${satirlar.join('\n')}${uyari}\n\nKaydedilsin mi? (Hakediş ve bordro yeni değerlerle yeniden hesaplanır; önceki hali Değişiklik Kaydı'nda kalır.)`)) return false;
    }
    setMesgul(true);
    try {
      await gunKaydet(surucuId, tarih, v);
      setKirli(false);
      bildir('ok', `${surucu?.adSoyad} — ${tarihTR(tarih)} kaydedildi.`);
      listeYukle();
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
          <div className="alan">
            <label>Fazla mesai toplamı (saat) {mesaiOtomatikMi(v) && <span className="rozet mavi" title="Görev saatlerinden hesaplanır; her görevde ayrı ayrı düzeltebilirsiniz">görevlerden</span>}</label>
            {mesaiOtomatikMi(v)
              ? <div className="girdi oto sayi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{sayi(v.gun.fazla_mesai)}</div>
              : <SayiGirdi deger={v.gun.fazla_mesai || null} yerTutucu="0" disabled={salt} degis={(x) => gunAlan('fazla_mesai', x ?? 0)} />}
            {!mesaiOtomatikMi(v) && <span className="soluk kucuk-yazi">Görev saatlerini girerseniz {kural.baslangicDk / 60 | 0}:00 sonrası otomatik hesaplanır.</span>}
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
          <div className="alan"><label>Yemek {v.gun.yemek_override === 0 && <span className="rozet uyari">elle kaldırıldı</span>}</label>
            <Seg disabled={salt} deger={v.gun.yemek_override == null ? 'oto' : v.gun.yemek_override ? 'var' : 'yok'}
              degis={(x) => gunAlan('yemek_override', x === 'oto' ? null : x === 'var' ? 1 : 0)}
              secenekler={[{ d: 'oto', ad: <>Otomatik ({otoYemek ? 'var' : 'yok'})</> }, { d: 'var', ad: 'Var' }, { d: 'yok', ad: 'Yok' }]} />
          </div>
          <div className="alan"><label>Yol {v.gun.yol_override === 0 && <span className="rozet uyari">elle kaldırıldı</span>}</label>
            <Seg disabled={salt} deger={v.gun.yol_override == null ? 'oto' : v.gun.yol_override ? 'var' : 'yok'}
              degis={(x) => gunAlan('yol_override', x === 'oto' ? null : x === 'var' ? 1 : 0)}
              secenekler={[{ d: 'oto', ad: <>Otomatik ({otoYol ? 'var' : 'yok'})</> }, { d: 'var', ad: 'Var' }, { d: 'yok', ad: 'Yok' }]} />
          </div>
          <div className="alan" style={{ gridColumn: 'span 2' }}><label>Not</label><input className="girdi" disabled={salt} value={v.gun.notlar} onChange={(e) => gunAlan('notlar', e.target.value)} placeholder="İsteğe bağlı açıklama" /></div>
        </div>
      </div>

      {/* 2) görevler: her görev ayrı kart (1. görev, 2. görev ...) */}
      <div className="gf-bolum">
        <div className="gf-baslik"><Truck size={15} /> Görevler ve araç (KM ve araç çalışma günü araca yazılır)</div>
        {!v.seferler.length && <div className="soluk" style={{ marginBottom: 10 }}>Bu gün için görev yok. Sürücünün aracı {surucu && aracById.get(surucu.varsayilanAracId ?? -1)?.plaka ? `(${aracById.get(surucu.varsayilanAracId!)!.plaka})` : ''} durum "Çalıştı" seçilince otomatik eklenir; istediğiniz zaman görev ekleyebilirsiniz.</div>}
        {v.seferler.map((s, i) => {
          const ref = oncekiKmRef(s.arac_id, i);
          const fark = s.km_cikis != null && ref != null ? Math.round((s.km_cikis - ref) * 100) / 100 : null;
          const km = s.km_cikis != null && s.km_donus != null ? s.km_donus - s.km_cikis : null;
          const baska = s.arac_id && s.arac_id !== surucu?.varsayilanAracId;
          const aralik = gorevAraligi(s.cikis_saat, s.donus_saat);
          const sarkti = !!aralik && aralik[1] > 1440;
          const kapaliKart = kartKapali[i] === true;
          const plaka = aracById.get(s.arac_id ?? -1)?.plaka ?? 'araç seçilmedi';
          return (
            <div key={i} className="gorev-kart">
              <div className="gorev-baslik" onClick={() => setKartKapali((o) => ({ ...o, [i]: !kapaliKart }))}>
                {kapaliKart ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <b>{i + 1}. Görev</b>
                <span className="soluk kucuk-yazi">
                  {plaka} · {s.cikis_saat || '--:--'} → {s.donus_saat || '--:--'}{sarkti ? ' (ertesi gün)' : ''}
                  {km != null ? ` · ${sayi(km, 0)} km` : ''}{s.fazla_mesai ? ` · F.M. ${sayi(s.fazla_mesai)} sa` : ''}
                </span>
                <div className="bosluk" />
                <button type="button" className="btn kucuk hayalet tehlike" disabled={salt} title="Bu görevi kaldır"
                  onClick={(e) => { e.stopPropagation(); degis((x) => { x.seferler.splice(i, 1); }); }}><Trash2 size={14} /> Kaldır</button>
              </div>
              {!kapaliKart && (
                <div className="gorev-govde">
                  <div className="gf-sefer-satir">
                    <div className="alan" style={{ width: 170 }}>
                      <label>Araç {baska && <span className="rozet uyari">başka araç</span>}</label>
                      <select className="girdi" disabled={salt} value={s.arac_id ?? ''} onChange={(e) => seferAlan(i, (x) => { x.arac_id = e.target.value ? Number(e.target.value) : null; x.km_cikis = null; x.km_donus = null; })}>
                        <option value="">— seçiniz —</option>
                        {araclar.filter((a) => a.aktif || a.id === s.arac_id).map((a) => <option key={a.id} value={a.id}>{a.plaka}{a.id === surucu?.varsayilanAracId ? ' (varsayılan)' : ''}</option>)}
                      </select>
                    </div>
                    <div className="alan" style={{ width: 130 }}><label><Clock size={11} /> Başlangıç saati</label><input type="time" className="girdi" disabled={salt} value={s.cikis_saat} onChange={(e) => seferAlan(i, (x) => { x.cikis_saat = e.target.value; })} /></div>
                    <div className="alan" style={{ width: 130 }}><label><Clock size={11} /> Bitiş saati {sarkti && <span className="rozet mavi" title="Bitiş saati başlangıçtan küçük: ertesi güne sarkıyor">+1 gün</span>}</label><input type="time" className="girdi" disabled={salt} value={s.donus_saat} onChange={(e) => seferAlan(i, (x) => { x.donus_saat = e.target.value; })} /></div>
                    <div className="alan" style={{ width: 90 }}><label>Süre</label><div className="girdi oto sayi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{aralik ? `${sayi(gorevSuresi(s.cikis_saat, s.donus_saat), 1)} sa` : '—'}</div></div>
                    <div className="alan">
                      <label>Araç çalışma</label>
                      <Seg disabled={salt} deger={s.arac_ig ? 'ig' : s.arac_igd === 1 ? 'igd1' : s.arac_igd ? 'igd5' : 'yok'}
                        degis={(x) => seferAlan(i, (y) => { y.arac_ig = x === 'ig' ? 1 : 0; y.arac_igd = x === 'igd1' ? 1 : x === 'igd5' ? 0.5 : 0; })}
                        secenekler={[{ d: 'yok', ad: 'Yok' }, { d: 'ig', ad: 'İG', title: 'İş günü' }, { d: 'igd5', ad: 'İGD ½', title: 'İş günü dışı yarım' }, { d: 'igd1', ad: 'İGD 1', title: 'İş günü dışı tam' }]} />
                    </div>
                  </div>

                  <div className="gf-sefer-satir">
                    <div className="alan" style={{ width: 130 }}>
                      <label>Giriş KM</label>
                      <SayiGirdi deger={s.km_cikis} ondalik={1} disabled={salt} yerTutucu={ref != null ? sayi(ref, 1) : ''} title={ref != null ? `Aracın önceki çıkış KM'si: ${sayi(ref, 1)}` : undefined}
                        degis={(x) => seferAlan(i, (y) => { y.km_cikis = x; })} />
                      {s.km_cikis == null && ref != null && <button type="button" className="btn kucuk hayalet" style={{ paddingLeft: 0, color: 'var(--accent)' }} disabled={salt} onClick={() => seferAlan(i, (y) => { y.km_cikis = ref; })}>önceki çıkışı kullan</button>}
                    </div>
                    <div className="alan" style={{ width: 130 }}><label>Çıkış KM</label><SayiGirdi deger={s.km_donus} ondalik={1} disabled={salt} degis={(x) => seferAlan(i, (y) => { y.km_donus = x; })} /></div>
                    <div className="alan" style={{ width: 100 }}><label>Toplam KM</label><div className="girdi oto sayi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: km != null && km < 0 ? 'var(--err)' : undefined }}>{km != null ? sayi(km, 1) : '—'}</div></div>
                    <div className="alan" style={{ width: 120 }}>
                      <label>Harici KM</label>
                      <div className="girdi harici sayi" title="Aracın önceki çıkış KM'si ile bu görevin giriş KM'si arasındaki fark. Ödemeyi etkilemez; yalnız kaydedilir ve raporlanır."
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: fark != null && fark < 0 ? 'var(--err)' : undefined }}>
                        {fark != null && fark >= 0 ? sayi(fark, 1) : '—'}
                      </div>
                    </div>
                    <div className="alan" style={{ flex: 1, minWidth: 320 }}>
                      <label>Fazla mesai (saat) {s.mesai_mod === 'elle' && <span className="rozet uyari">elle düzeltildi</span>}</label>
                      <div className="satir" style={{ gap: 8, flexWrap: 'wrap' }}>
                        {s.mesai_mod === 'elle'
                          ? <div style={{ width: 90 }}><SayiGirdi deger={s.fazla_mesai || null} yerTutucu="0" disabled={salt} degis={(x) => seferAlan(i, (y) => { y.fazla_mesai = x ?? 0; })} /></div>
                          : <div className="girdi oto sayi" style={{ width: 90, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{sayi(s.fazla_mesai)}</div>}
                        <Seg disabled={salt} deger={s.mesai_mod} degis={(m) => seferAlan(i, (y) => { y.mesai_mod = m; })}
                          secenekler={MESAI_MODLARI.map((m) => ({ d: m.d, ad: m.ad, title: m.ipucu }))} />
                      </div>
                      <span className="soluk kucuk-yazi">{kural.baslangicDk / 60 | 0}:00 sonrası; otomatik: artan dakika {kural.yukariDk}'i aşarsa saat yukarı yuvarlanır</span>
                    </div>
                  </div>

                  <div className="gf-sefer-satir">
                    <div className="alan" style={{ flex: 1, minWidth: 260 }}>
                      <label>Görevli personel (birden çok kişi eklenebilir)</label>
                      <CokluSecim deger={s.gorevli} degis={(t) => seferAlan(i, (x) => { x.gorevli = t; })} oneriler={listeler.personel.map((p) => p.ad)} disabled={salt} yerTutucu="Ad soyad yazıp Enter'a basın" />
                    </div>
                    <div className="alan" style={{ flex: 1, minWidth: 260 }}>
                      <label>Görev yeri / gidilen yer (birden çok yer eklenebilir)</label>
                      <CokluSecim deger={s.gorev_yeri} degis={(t) => seferAlan(i, (x) => { x.gorev_yeri = t; })} oneriler={listeler.yerler.map((p) => p.ad)} disabled={salt} yerTutucu="Yer yazıp Enter'a basın" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="btn kucuk" disabled={salt} onClick={() => degis((x) => {
          const son = x.seferler[x.seferler.length - 1];
          const yeni = bosSefer(son?.arac_id ?? surucu?.varsayilanAracId ?? null, !!(sinif?.X) && !x.seferler.length);
          if (son) { yeni.km_cikis = son.km_donus ?? null; }
          x.seferler.push(yeni);
        })}>
          <Plus size={14} /> {v.seferler.length === 1 ? 'İkinci görev ekle' : 'Görev ekle'}
        </button>
        {v.seferler.length > 0 && (
          <div className="gun-ozet">
            <span>Gün özeti</span>
            <span>Süre: <b>{sayi(v.seferler.reduce((t, s) => t + gorevSuresi(s.cikis_saat, s.donus_saat), 0), 1)} sa</b></span>
            <span>Fazla mesai: <b>{sayi(v.gun.fazla_mesai)} sa</b></span>
            <span>Toplam KM: <b>{sayi(v.seferler.reduce((t, s) => t + (s.km_cikis != null && s.km_donus != null ? s.km_donus - s.km_cikis : 0), 0), 1)}</b></span>
            <span>Harici KM: <b>{sayi(v.seferler.reduce((t, s, i) => { const r = oncekiKmRef(s.arac_id, i); return t + (s.km_cikis != null && r != null && s.km_cikis >= r ? s.km_cikis - r : 0); }, 0), 1)}</b></span>
          </div>
        )}
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
