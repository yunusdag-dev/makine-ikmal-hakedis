/**
 * Sürücü bazlı günlük puantaj. Günlük kayıt = tarih + sürücü (+ o gün kullanılan araç(lar)).
 * Mesai, dış görev, yemek, yol, konaklama SÜRÜCÜYE; KM ve araç çalışma günü ARACA yazılır.
 * Tamamen klavye ile kullanılabilir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Wand2, Plus, Trash2, Truck, Check, Loader2, CopyPlus, Info } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { api } from '../lib/api';
import { GUN_KISA, basHarf, sayi, sayiOku, tl } from '../lib/bicim';
import { useBildirim, useOnay, BosDurum } from '../ui/temel';
import { ayTakvimi, GunSinifi } from '../../engine/calendar';
import { yemekOtomatik } from '../../engine/kurum';
import { DURUM_ETIKET } from '../../engine/types';
import GunlukForm from '../ui/GunlukForm';
import { Modal } from '../ui/temel';

type GunRow = {
  durum: string; fazla_mesai: number; hafta_tatili: number; resmi_tatil: number; dis_gorev: number; konaklama: number;
  yemek_override: number | null; yol_override: number | null; cikis_saat: string; donus_saat: string; notlar: string;
};
type SeferRow = { arac_id: number | null; km_cikis: number | null; km_donus: number | null; arac_ig: number; arac_igd: number; gorevli: string; gorev_yeri: string };
type GunVeri = { gun: GunRow; seferler: SeferRow[] };

const BOS_GUN: GunRow = { durum: '', fazla_mesai: 0, hafta_tatili: 0, resmi_tatil: 0, dis_gorev: 0, konaklama: 0, yemek_override: null, yol_override: null, cikis_saat: '', donus_saat: '', notlar: '' };
const bosSefer = (arac_id: number | null, ig: boolean): SeferRow => ({ arac_id, km_cikis: null, km_donus: null, arac_ig: ig ? 1 : 0, arac_igd: 0, gorevli: '', gorev_yeri: '' });

const KOLONLAR = [
  { id: 'durum', ad: 'Durum', w: 62, surucu: true },
  { id: 'arac', ad: 'Araç', w: 104 },
  { id: 'kmc', ad: 'Çıkış KM', w: 84 },
  { id: 'kmd', ad: 'Dönüş KM', w: 84 },
  { id: 'km', ad: 'KM', w: 58, salt: true },
  { id: 'ig', ad: 'İG / İGD', w: 70 },
  { id: 'fm', ad: 'F. Mesai', w: 66, surucu: true },
  { id: 'ht', ad: 'H. Tatili', w: 58, surucu: true },
  { id: 'rt', ad: 'R. Tatil', w: 58, surucu: true },
  { id: 'dg', ad: 'Dış Görev', w: 66, surucu: true },
  { id: 'kon', ad: 'Konak.', w: 54, surucu: true },
  { id: 'yemek', ad: 'Yemek', w: 54, surucu: true },
  { id: 'yol', ad: 'Yol', w: 50, surucu: true },
  { id: 'gorev', ad: 'Görev yeri / Görevli', w: 200 },
  { id: 'not', ad: 'Not', w: 160, surucu: true },
] as const;
type KolonId = (typeof KOLONLAR)[number]['id'];
const DUZENLE_METIN: KolonId[] = ['kmc', 'kmd', 'fm', 'gorev', 'not'];

const DURUM_TUS: Record<string, string> = { x: 'X', b: 'B', r: 'R', s: 'Sİ', u: 'Üİ', ü: 'Üİ', m: 'Mİ', i: 'İİ', ı: 'İİ', '0': '0' };
const kodSinif = (d: string) => (d === 'Sİ' ? 'SI' : d === 'Üİ' ? 'UI' : d === 'Mİ' ? 'MI' : d === 'İİ' ? 'II' : d === '0' ? 'S0' : d);

export default function Puantaj() {
  const { ay, veri, sonuc, kapali, oturum, yenile, disDegisiklik } = useBaglam();
  const bildir = useBildirim();
  const onay = useOnay();
  const [arama, setArama] = useState('');
  const [secili, setSecili] = useState<number | null>(() => Number(localStorage.getItem('pt-surucu')) || null);
  const [gunler, setGunler] = useState<Record<string, GunVeri>>({});
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(0);
  const [odak, setOdak] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [duzen, setDuzen] = useState<{ deger: string } | null>(null);
  const [formTarih, setFormTarih] = useState<string | null>(null);
  const [aracSecim, setAracSecim] = useState<{ r: number; filtre: string; x: number; y: number; i: number } | null>(null);
  const zamanlayici = useRef<Record<string, any>>({});
  const bekleyen = useRef<Record<string, GunVeri>>({});
  const bekleyenSurucu = useRef<Record<string, number>>({});
  const yenileZ = useRef<any>(null);
  const izgaraRef = useRef<HTMLDivElement>(null);
  const salt = kapali || oturum.saltOkunur;

  const suruculer = veri?.suruculer ?? [];
  const araclar = veri?.araclar ?? [];
  const aracById = useMemo(() => new Map(araclar.map((a) => [a.id, a])), [araclar]);
  const surucu = suruculer.find((s) => s.id === secili) ?? null;
  const takvim = useMemo(() => {
    if (!veri) return null;
    const [y, m] = ay.split('-').map(Number);
    return ayTakvimi(y, m, veri.tatiller, veri.params);
  }, [veri, ay]);

  useEffect(() => {
    if (!secili && suruculer.length) setSecili(suruculer[0].id);
  }, [suruculer, secili]);

  // Sürücünün ayını yükle
  const yukle = useCallback(async () => {
    if (!secili) return;
    setYukleniyor(true);
    try {
      const r = await api<{ gunler: any[]; seferler: any[] }>('surucuAyi', secili, ay);
      const m: Record<string, GunVeri> = {};
      for (const g of r.gunler) m[g.tarih] = { gun: { ...BOS_GUN, ...g }, seferler: [] };
      for (const s of r.seferler) {
        if (!m[s.tarih]) m[s.tarih] = { gun: { ...BOS_GUN }, seferler: [] };
        m[s.tarih].seferler.push({ arac_id: s.arac_id, km_cikis: s.km_cikis, km_donus: s.km_donus, arac_ig: s.arac_ig, arac_igd: s.arac_igd, gorevli: s.gorevli, gorev_yeri: s.gorev_yeri });
      }
      setGunler(m);
    } catch (e: any) {
      bildir('hata', e.message);
    } finally {
      setYukleniyor(false);
    }
  }, [secili, ay]);
  useEffect(() => { localStorage.setItem('pt-surucu', String(secili ?? '')); yukle(); setOdak({ r: 0, c: 0 }); setDuzen(null); }, [yukle]);
  // Başka bir kullanıcı veriyi değiştirdiyse ve bizim bekleyen kaydımız / açık düzenlememiz yoksa ayı yeniden yükle
  const duzenRef = useRef(duzen);
  duzenRef.current = duzen;
  useEffect(() => {
    if (!disDegisiklik) return;
    if (Object.keys(bekleyen.current).length || duzenRef.current) return;
    yukle();
  }, [disDegisiklik]);

  // Kaydet (gün bazında, gecikmeli). Bekleyen kayıt hangi sürücüye ait olduğunu da taşır.
  const kaydetHemen = useCallback(async (sid: number, tarih: string, x: GunVeri) => {
    setKaydediliyor((n) => n + 1);
    try {
      await api('gunKaydet', sid, tarih, x.gun, x.seferler);
      clearTimeout(yenileZ.current);
      yenileZ.current = setTimeout(() => yenile(), 700);
    } catch (e: any) {
      bildir('hata', `${tarih}: ${e.message}`);
      yukle();
    } finally {
      setKaydediliyor((n) => n - 1);
    }
  }, [yenile, yukle]);
  const kaydet = useCallback((tarih: string, v: GunVeri) => {
    if (!secili) return;
    const sid = secili;
    bekleyen.current[tarih] = v;
    (bekleyenSurucu.current as any)[tarih] = sid;
    clearTimeout(zamanlayici.current[tarih]);
    zamanlayici.current[tarih] = setTimeout(() => {
      const x = bekleyen.current[tarih];
      delete bekleyen.current[tarih];
      delete (bekleyenSurucu.current as any)[tarih];
      if (x) kaydetHemen(sid, tarih, x);
    }, 350);
  }, [secili, kaydetHemen]);

  // Sürücü / ay değişirken veya ekrandan çıkarken bekleyen değişiklikleri HEMEN yaz (iptal etme)
  useEffect(() => () => {
    for (const t of Object.keys(zamanlayici.current)) {
      clearTimeout(zamanlayici.current[t]);
      const x = bekleyen.current[t];
      const sid = (bekleyenSurucu.current as any)[t];
      if (x && sid) {
        delete bekleyen.current[t];
        delete (bekleyenSurucu.current as any)[t];
        api('gunKaydet', sid, t, x.gun, x.seferler).catch(() => {});
      }
    }
  }, [secili, ay]);

  const guncelle = useCallback((tarih: string, fn: (v: GunVeri) => GunVeri) => {
    if (salt) { bildir('bilgi', kapali ? 'Dönem kapalı. Düzenlemek için Hakediş ekranından dönemi açın.' : 'Salt okunur moddasınız.'); return; }
    setGunler((m) => {
      const eski = m[tarih] ?? { gun: { ...BOS_GUN }, seferler: [] };
      const yeni = fn({ gun: { ...eski.gun }, seferler: eski.seferler.map((s) => ({ ...s })) });
      kaydet(tarih, yeni);
      return { ...m, [tarih]: yeni };
    });
  }, [kaydet, salt, kapali]);

  // ---- satırlar (gün + ek sefer satırları)
  type Satir = { tarih: string; sinif: GunSinifi; si: number; ilk: boolean; sefer: SeferRow | null };
  const satirlar: Satir[] = useMemo(() => {
    if (!takvim) return [];
    const out: Satir[] = [];
    for (const s of takvim.gunler) {
      const v = gunler[s.tarih];
      const sf = v?.seferler ?? [];
      if (!sf.length) out.push({ tarih: s.tarih, sinif: s, si: -1, ilk: true, sefer: null });
      else sf.forEach((x, i) => out.push({ tarih: s.tarih, sinif: s, si: i, ilk: i === 0, sefer: x }));
    }
    return out;
  }, [takvim, gunler]);

  const sonKm = useCallback((aracId: number, tarih: string): number | null => {
    // aynı aracın bu tarihten önceki en büyük KM'si (bu ay, bu sürücü) veya önceki ay kapanışı
    let m: number | null = null;
    for (const [t, v] of Object.entries(gunler)) {
      if (t > tarih) continue;
      for (const s of v.seferler) if (s.arac_id === aracId) for (const k of [s.km_cikis, s.km_donus]) if (k != null && (t < tarih || k !== null)) m = Math.max(m ?? 0, k);
    }
    const tum = veri?.seferler.filter((s) => s.vehicleId === aracId && s.tarih < tarih) ?? [];
    for (const s of tum) for (const k of [s.kmCikis, s.kmDonus]) if (k != null) m = Math.max(m ?? 0, k);
    if (m == null) m = veri?.oncekiKmOtomatik[aracId] ?? veri?.aracAylari[aracId]?.oncekiKm ?? null;
    return m;
  }, [gunler, veri]);

  // ---- hücre değer değiştiriciler
  const durumAyarla = (st: Satir, d: string) => guncelle(st.tarih, (v) => {
    v.gun.durum = d;
    const calisti = d === 'X' || d === 'B';
    if (calisti && v.seferler.length === 0 && surucu?.varsayilanAracId) {
      v.seferler.push(bosSefer(surucu.varsayilanAracId, st.sinif.X || st.sinif.RTA || st.sinif.DBA));
    }
    if (!calisti) {
      v.seferler = v.seferler.filter((s) => s.km_cikis != null || s.km_donus != null || s.gorev_yeri || s.gorevli || s.arac_igd);
      v.gun.fazla_mesai = 0; v.gun.dis_gorev = 0; v.gun.konaklama = 0; v.gun.hafta_tatili = 0;
    }
    return v;
  });
  const seferGuncelle = (st: Satir, fn: (s: SeferRow) => void) => guncelle(st.tarih, (v) => {
    if (st.si < 0 || !v.seferler[st.si]) {
      v.seferler.push(bosSefer(surucu?.varsayilanAracId ?? null, st.sinif.X));
      fn(v.seferler[v.seferler.length - 1]);
    } else fn(v.seferler[st.si]);
    return v;
  });
  const gunGuncelle = (st: Satir, fn: (g: GunRow) => void) => guncelle(st.tarih, (v) => { fn(v.gun); return v; });

  const kolonId = (c: number) => KOLONLAR[c].id as KolonId;

  const degerYaz = (st: Satir, kol: KolonId, metin: string) => {
    const n = sayiOku(metin);
    switch (kol) {
      case 'kmc': seferGuncelle(st, (s) => { s.km_cikis = n; }); break;
      case 'kmd': seferGuncelle(st, (s) => { s.km_donus = n; }); break;
      case 'fm':
        if (n != null && (n < 0 || n > 24)) { bildir('hata', 'Fazla mesai 0–24 saat arasında olmalı.'); return; }
        gunGuncelle(st, (g) => { g.fazla_mesai = n ?? 0; }); break;
      case 'gorev': seferGuncelle(st, (s) => { const [y, ...k] = metin.split('/'); s.gorev_yeri = (y ?? '').trim(); s.gorevli = k.join('/').trim(); }); break;
      case 'not': gunGuncelle(st, (g) => { g.notlar = metin.trim(); }); break;
    }
  };

  const toggle = (st: Satir, kol: KolonId, tus?: string) => {
    const v = gunler[st.tarih]?.gun ?? BOS_GUN;
    switch (kol) {
      case 'ht': gunGuncelle(st, (g) => { g.hafta_tatili = tus === 'del' ? 0 : g.hafta_tatili ? 0 : 1; }); break;
      case 'kon': gunGuncelle(st, (g) => { g.konaklama = tus === 'del' ? 0 : g.konaklama ? 0 : 1; }); break;
      case 'rt': gunGuncelle(st, (g) => {
        if (tus === '1') g.resmi_tatil = 1; else if (tus === '5') g.resmi_tatil = 0.5; else if (tus === 'del' || tus === '0') g.resmi_tatil = 0;
        else g.resmi_tatil = g.resmi_tatil === 0 ? 1 : g.resmi_tatil === 1 ? 0.5 : 0;
      }); break;
      case 'dg': gunGuncelle(st, (g) => {
        const kismi = veri?.params.puantaj.disGorevKismi ?? 0.66;
        if (tus === 't' || tus === '1') g.dis_gorev = 1; else if (tus === '2' || tus === '6') g.dis_gorev = kismi; else if (tus === 'del' || tus === '0') g.dis_gorev = 0;
        else g.dis_gorev = g.dis_gorev === 0 ? kismi : g.dis_gorev === kismi ? 1 : 0;
      }); break;
      case 'yemek': case 'yol': gunGuncelle(st, (g) => {
        const k = kol === 'yemek' ? 'yemek_override' : 'yol_override';
        if (tus === 'del') g[k] = null;
        else if (tus === 'e' || tus === '1') g[k] = 1;
        else if (tus === 'h' || tus === '0') g[k] = 0;
        else g[k] = g[k] == null ? (oto(kol, v) ? 0 : 1) : null;
      }); break;
      case 'ig': seferGuncelle(st, (s) => {
        if (tus === 'g') { s.arac_ig = 1; s.arac_igd = 0; }
        else if (tus === '1') { s.arac_ig = 0; s.arac_igd = 1; }
        else if (tus === '5') { s.arac_ig = 0; s.arac_igd = 0.5; }
        else if (tus === 'del' || tus === '0') { s.arac_ig = 0; s.arac_igd = 0; }
        else if (s.arac_ig) { s.arac_ig = 0; s.arac_igd = 1; }
        else if (s.arac_igd === 1) { s.arac_igd = 0.5; }
        else if (s.arac_igd === 0.5) { s.arac_igd = 0; }
        else { s.arac_ig = 1; }
      }); break;
    }
  };

  const oto = (kol: 'yemek' | 'yol', g: GunRow) => {
    const sg = { driverId: 0, tarih: '', durum: g.durum as any, fazlaMesai: g.fazla_mesai, haftaTatili: !!g.hafta_tatili, resmiTatil: g.resmi_tatil, disGorev: g.dis_gorev, konaklama: !!g.konaklama, yemekOverride: null, yolOverride: null };
    const y = yemekOtomatik(sg);
    return kol === 'yemek' ? y : y && (surucu?.yolHakki ?? true);
  };

  const ekSefer = (st: Satir) => guncelle(st.tarih, (v) => { v.seferler.push(bosSefer(null, false)); return v; });
  const seferSil = (st: Satir) => {
    if (st.si < 0) { guncelle(st.tarih, () => ({ gun: { ...BOS_GUN }, seferler: [] })); return; }
    guncelle(st.tarih, (v) => { v.seferler.splice(st.si, 1); return v; });
  };
  const ustKopyala = (r: number) => {
    const st = satirlar[r];
    let k = r - 1;
    while (k >= 0 && satirlar[k].tarih === st.tarih) k--;
    if (k < 0) return;
    const once = gunler[satirlar[k].tarih];
    if (!once) return;
    guncelle(st.tarih, () => ({
      gun: { ...once.gun, notlar: '' },
      seferler: once.seferler.map((s) => ({ ...s, km_cikis: null, km_donus: null })),
    }));
  };

  // ---- klavye
  const hareket = (dr: number, dc: number) => {
    setOdak((o) => {
      let r = Math.max(0, Math.min(satirlar.length - 1, o.r + dr));
      let c = o.c + dc;
      if (c < 0) { c = KOLONLAR.length - 1; r = Math.max(0, r - 1); }
      if (c >= KOLONLAR.length) { c = 0; r = Math.min(satirlar.length - 1, r + 1); }
      return { r, c };
    });
  };
  useEffect(() => {
    const el = izgaraRef.current?.querySelector(`[data-h="${odak.r}-${odak.c}"]`) as HTMLElement | null;
    if (el && !duzen) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }, [odak, duzen, satirlar.length]);

  const tusBas = (e: React.KeyboardEvent) => {
    if (duzen || aracSecim) return;
    const st = satirlar[odak.r];
    if (!st) return;
    const kol = kolonId(odak.c);
    const k = e.key;
    const kk = k.toLocaleLowerCase('tr-TR');
    if (k === 'ArrowDown') { e.preventDefault(); hareket(1, 0); return; }
    if (k === 'ArrowUp') { e.preventDefault(); hareket(-1, 0); return; }
    if (k === 'ArrowRight') { e.preventDefault(); hareket(0, 1); return; }
    if (k === 'ArrowLeft') { e.preventDefault(); hareket(0, -1); return; }
    if (k === 'Tab') { e.preventDefault(); hareket(0, e.shiftKey ? -1 : 1); return; }
    if (k === 'PageDown') { e.preventDefault(); hareket(7, 0); return; }
    if (k === 'PageUp') { e.preventDefault(); hareket(-7, 0); return; }
    if (k === 'Home' && e.ctrlKey) { e.preventDefault(); setOdak({ r: 0, c: odak.c }); return; }
    if (k === 'End' && e.ctrlKey) { e.preventDefault(); setOdak({ r: satirlar.length - 1, c: odak.c }); return; }
    if (e.ctrlKey && kk === 'd') { e.preventDefault(); ustKopyala(odak.r); return; }
    if (k === 'Insert' || (e.ctrlKey && k === '+')) { e.preventDefault(); ekSefer(st); return; }
    if (e.ctrlKey && k === 'Delete') { e.preventDefault(); seferSil(st); return; }
    const surucuKol = KOLONLAR[odak.c] && (KOLONLAR[odak.c] as any).surucu;
    if (surucuKol && !st.ilk) return;
    if (kol === 'durum') {
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); durumAyarla(st, ''); hareket(1, 0); return; }
      const d = DURUM_TUS[kk];
      if (d) { e.preventDefault(); durumAyarla(st, d); hareket(1, 0); return; }
      return;
    }
    if (kol === 'arac') {
      if (k === 'Enter' || /^[\p{L}\d]$/u.test(k)) {
        e.preventDefault();
        const el = izgaraRef.current?.querySelector(`[data-h="${odak.r}-${odak.c}"]`) as HTMLElement;
        const rc = el.getBoundingClientRect();
        setAracSecim({ r: odak.r, filtre: k === 'Enter' ? '' : k, x: rc.left, y: rc.bottom + 2, i: 0 });
      }
      if (k === 'Delete' && st.si >= 0) { e.preventDefault(); seferSil(st); }
      return;
    }
    if (['ht', 'kon', 'rt', 'dg', 'yemek', 'yol', 'ig'].includes(kol)) {
      if (k === ' ' || k === 'Enter') { e.preventDefault(); toggle(st, kol); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); toggle(st, kol, 'del'); return; }
      if (kk === 'x' && (kol === 'ht' || kol === 'kon')) { e.preventDefault(); toggle(st, kol); return; }
      if (/^[0-9tgeh]$/.test(kk)) { e.preventDefault(); toggle(st, kol, kk); return; }
      return;
    }
    if (DUZENLE_METIN.includes(kol)) {
      if (k === 'Enter' || k === 'F2') {
        e.preventDefault();
        let bas = hucreMetni(st, kol);
        if ((kol === 'kmc') && !bas && st.sefer?.arac_id) { const s = sonKm(st.sefer.arac_id, st.tarih); if (s != null) bas = String(s); }
        if ((kol === 'kmd') && !bas && st.sefer?.km_cikis != null) bas = '';
        setDuzen({ deger: bas });
        return;
      }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); degerYaz(st, kol, ''); return; }
      if (k.length === 1 && !e.ctrlKey && !e.altKey) { e.preventDefault(); setDuzen({ deger: k }); return; }
    }
  };

  const hucreMetni = (st: Satir, kol: KolonId): string => {
    const g = gunler[st.tarih]?.gun ?? BOS_GUN;
    switch (kol) {
      case 'kmc': return st.sefer?.km_cikis != null ? String(st.sefer.km_cikis) : '';
      case 'kmd': return st.sefer?.km_donus != null ? String(st.sefer.km_donus) : '';
      case 'fm': return g.fazla_mesai ? String(g.fazla_mesai).replace('.', ',') : '';
      case 'gorev': return st.sefer ? [st.sefer.gorev_yeri, st.sefer.gorevli].filter(Boolean).join(' / ') : '';
      case 'not': return g.notlar ?? '';
      default: return '';
    }
  };

  // ---- özet
  const ozet = useMemo(() => {
    if (!sonuc || !secili) return null;
    const i = sonuc.giris.findIndex((g) => g.driverId === secili);
    const k = sonuc.kurum.find((x) => x.driverId === secili);
    return { k, sa: k?.surucuAy, sf: i >= 0 ? sonuc.firma.surucuFaaliyet[i] : null, ot: i >= 0 ? sonuc.firma.onTablo[i] : null };
  }, [sonuc, secili]);

  const ayDoldur = async () => {
    if (!surucu || !takvim) return;
    if (!surucu.varsayilanAracId) { bildir('hata', 'Sürücünün varsayılan aracı tanımlı değil (Sürücüler ekranı).'); return; }
    const bos = takvim.gunler.filter((g) => (g.X || g.RTA || g.DBA) && !(gunler[g.tarih]?.gun.durum));
    if (!bos.length) { bildir('bilgi', 'Doldurulacak boş iş günü yok.'); return; }
    if (!(await onay({ baslik: 'İş günlerini doldur', metin: `${bos.length} boş iş günü "X – Çalışma günü" olarak işaretlenecek ve varsayılan araç (${aracById.get(surucu.varsayilanAracId)?.plaka}) İG ile eklenecek.\nDolu günlere dokunulmaz.`, evet: 'Doldur' }))) return;
    try {
      await api('ayTopluKaydet', surucu.id, ay, bos.map((g) => ({
        tarih: g.tarih,
        gun: { ...BOS_GUN, ...(gunler[g.tarih]?.gun ?? {}), durum: 'X' },
        seferler: gunler[g.tarih]?.seferler?.length ? gunler[g.tarih].seferler : [bosSefer(surucu.varsayilanAracId, true)],
      })), 'İş günleri X ile dolduruldu');
      await yukle();
      yenile();
      bildir('ok', `${bos.length} gün dolduruldu.`);
    } catch (e: any) { bildir('hata', e.message); }
  };

  const filtreli = suruculer.filter((s) => !arama || s.adSoyad.toLocaleLowerCase('tr-TR').includes(arama.toLocaleLowerCase('tr-TR'))
    || (aracById.get(s.varsayilanAracId ?? -1)?.plaka ?? '').toLocaleLowerCase('tr-TR').replace(/\s/g, '').includes(arama.toLocaleLowerCase('tr-TR').replace(/\s/g, '')));

  if (!veri) return <div className="yukleniyor">Yükleniyor…</div>;
  if (!suruculer.length) return <div style={{ flex: 1 }}><BosDurum ikon={<Info size={36} />} baslik="Henüz sürücü yok" metin="Önce Sürücüler ve Araçlar ekranlarından kayıt ekleyin veya Veritabanı ekranından mevcut Excel dosyalarınızı içe aktarın." /></div>;

  return (
    <div className="pt-yerlesim">
      {/* sürücü listesi */}
      <div className="pt-liste">
        <div className="ara">
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
            <input className="girdi" style={{ paddingLeft: 32 }} placeholder="Sürücü veya plaka ara…" value={arama} onChange={(e) => setArama(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtreli[0]) { setSecili(filtreli[0].id); setTimeout(() => (izgaraRef.current?.querySelector('[data-h="0-0"]') as HTMLElement)?.focus(), 50); }
                if (e.key === 'ArrowDown') { e.preventDefault(); const i = filtreli.findIndex((s) => s.id === secili); if (filtreli[i + 1]) setSecili(filtreli[i + 1].id); }
                if (e.key === 'ArrowUp') { e.preventDefault(); const i = filtreli.findIndex((s) => s.id === secili); if (i > 0) setSecili(filtreli[i - 1].id); }
              }} />
          </div>
        </div>
        <div className="ogeler">
          {filtreli.map((s) => {
            const k = sonuc?.kurum.find((x) => x.driverId === s.id);
            return (
              <div key={s.id} className={`pt-oge ${s.id === secili ? 'secili' : ''}`} onClick={() => setSecili(s.id)}>
                <div className="av">{basHarf(s.adSoyad)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="ad">{s.adSoyad}</div>
                  <div className="alt">{aracById.get(s.varsayilanAracId ?? -1)?.plaka ?? 'araç yok'}{!s.aktif && ' · pasif'}</div>
                </div>
                <div className="ilerleme" title="Çalışma günü / fazla mesai">{k?.surucuCalisma ?? 0}g{k?.fazlaMesai ? ` · ${sayi(k.fazlaMesai)}s` : ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ay ızgarası */}
      <div className="pt-sag">
        <div className="pt-baslik">
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{surucu?.adSoyad ?? '—'}</div>
            <div className="soluk kucuk-yazi">
              <Truck size={12} style={{ verticalAlign: -2 }} /> {aracById.get(surucu?.varsayilanAracId ?? -1)?.plaka ?? 'varsayılan araç yok'}
              {surucu && !surucu.yolHakki && ' · yol ücreti almaz'}{surucu?.ucretGrubu === 'operator' && ' · operatör'}{surucu?.emekli && ' · emekli'}
            </div>
          </div>
          {ozet?.sa && (
            <div className="pt-ozet">
              <span className="c">Çalışma<b>{ozet.sa.surucuCalisma}</b></span>
              <span className="c">F. Mesai<b>{sayi(ozet.sa.fazlaMesai)}</b></span>
              <span className="c">H. Tatili<b>{ozet.sa.haftaTatili}</b></span>
              <span className="c">R. Tatil<b>{sayi(ozet.sa.resmiTatil)}</b></span>
              <span className="c">Dış Görev<b>{sayi(ozet.sa.disGorev)}</b></span>
              <span className="c">Konak.<b>{ozet.sa.konaklama}</b></span>
              <span className="c">Yemek<b>{ozet.sa.yemek}</b></span>
              <span className="c">Yol<b>{ozet.sa.yol}</b></span>
              {ozet.sf && <span className="c vurgu" title="Bu ay için hesaplanan net ödenecek tutar">Net maaş<b>{tl(ozet.sf.AJ_odenecek)} ₺</b></span>}
            </div>
          )}
          <div className="bosluk" />
          <span className="soluk kucuk-yazi" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {kaydediliyor > 0 ? <><Loader2 size={13} className="don" /> Kaydediliyor…</> : <><Check size={13} color="var(--ok)" /> Kaydedildi</>}
          </span>
          <button className="btn" onClick={() => setFormTarih(satirlar[odak.r]?.tarih ?? satirlar[0]?.tarih ?? null)} title="Seçili günü günlük kayıt formunda aç (gün numarasına çift tıklama da açar)">Form ile aç</button>
          <button className="btn" onClick={ayDoldur} disabled={salt} title="Boş iş günlerini X + varsayılan araç ile doldur"><Wand2 size={15} /> İş günlerini doldur</button>
        </div>
        <div className="pt-izgara" ref={izgaraRef} onKeyDown={tusBas}>
          {yukleniyor ? <div className="yukleniyor">Yükleniyor…</div> : (
            <table className="izg">
              <thead>
                <tr>
                  <th style={{ width: 92 }}>Gün</th>
                  <th style={{ width: 40 }}>Tür</th>
                  {KOLONLAR.map((k) => <th key={k.id} style={{ width: k.w, minWidth: k.w }}>{k.ad}</th>)}
                  <th style={{ width: 56 }}></th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((st, r) => {
                  const g = gunler[st.tarih]?.gun ?? BOS_GUN;
                  const sn = st.sinif;
                  const cls = [sn.RT || sn.DB ? 'rt' : sn.RTA || sn.DBA ? 'ar' : sn.Ctesi || sn.Pzr ? 'hs' : '', st.ilk ? '' : 'alt-sefer'].join(' ');
                  const arac = st.sefer?.arac_id ? aracById.get(st.sefer.arac_id) : undefined;
                  const km = st.sefer && st.sefer.km_cikis != null && st.sefer.km_donus != null ? st.sefer.km_donus - st.sefer.km_cikis : null;
                  return (
                    <tr key={`${st.tarih}-${st.si}`} className={cls} title={sn.ad || undefined}>
                      <td className="gun" style={{ cursor: 'pointer' }} title="Çift tıklayın: günlük kayıt formu" onDoubleClick={() => setFormTarih(st.tarih)}>{st.ilk && <><span className="g">{sn.gun}</span> <span className="h">{GUN_KISA[sn.weekday - 1]}</span></>}</td>
                      <td className="tip">{st.ilk && sn.tip !== 'İş' && <span className={`t ${sn.tip}`}>{sn.tip}</span>}</td>
                      {KOLONLAR.map((k, c) => {
                        const odakta = odak.r === r && odak.c === c;
                        const surucuKol = (k as any).surucu;
                        const gizli = surucuKol && !st.ilk;
                        let icerik: React.ReactNode = null;
                        let sinif = 'hc';
                        if (!gizli) switch (k.id) {
                          case 'durum': icerik = g.durum ? <span className={`kod ${kodSinif(g.durum)}`} title={DURUM_ETIKET[g.durum as keyof typeof DURUM_ETIKET]}>{g.durum}</span> : <span className="yer">·</span>; break;
                          case 'arac': icerik = arac ? <span className={`arac-cip ${arac.id !== surucu?.varsayilanAracId ? 'baska' : ''}`}>{arac.plaka}</span> : <span className="yer">{st.si >= 0 ? 'araç seç' : '·'}</span>; break;
                          case 'kmc': sinif += ' sayi'; icerik = st.sefer?.km_cikis != null ? sayi(st.sefer.km_cikis, 1) : ''; break;
                          case 'kmd': sinif += ' sayi'; icerik = st.sefer?.km_donus != null ? sayi(st.sefer.km_donus, 1) : ''; break;
                          case 'km': sinif += ' sayi'; icerik = km != null ? <span style={{ color: km < 0 ? 'var(--err)' : undefined }}>{sayi(km, 1)}</span> : ''; break;
                          case 'ig': icerik = st.sefer?.arac_ig ? <b style={{ color: 'var(--ok)' }}>İG</b> : st.sefer?.arac_igd ? <b style={{ color: '#7c3aed' }}>İGD {sayi(st.sefer.arac_igd)}</b> : ''; break;
                          case 'fm': sinif += ' sayi'; icerik = g.fazla_mesai ? sayi(g.fazla_mesai) : ''; break;
                          case 'ht': icerik = g.hafta_tatili ? <span className="tik">X</span> : ''; break;
                          case 'rt': icerik = g.resmi_tatil ? sayi(g.resmi_tatil) : ''; break;
                          case 'dg': icerik = g.dis_gorev === 1 ? <b>Tam</b> : g.dis_gorev ? <b title={sayi(g.dis_gorev)}>⅔</b> : ''; break;
                          case 'kon': icerik = g.konaklama ? <span className="tik">X</span> : ''; break;
                          case 'yemek': case 'yol': {
                            const ov = k.id === 'yemek' ? g.yemek_override : g.yol_override;
                            const val = ov == null ? oto(k.id, g) : !!ov;
                            if (ov != null) sinif += ' ovr';
                            icerik = val ? <span className={ov == null ? 'tik' : ''}>✓</span> : ov != null ? '✗' : '';
                            break;
                          }
                          case 'gorev': sinif += ' metin'; icerik = hucreMetni(st, 'gorev'); break;
                          case 'not': sinif += ' metin'; icerik = g.notlar; break;
                        }
                        const duzenleniyor = odakta && duzen;
                        return (
                          <td key={k.id} onMouseDown={() => { if (!duzen) setOdak({ r, c }); }} onDoubleClick={() => {
                            if (gizli) return;
                            if (DUZENLE_METIN.includes(k.id as KolonId)) setDuzen({ deger: hucreMetni(st, k.id as KolonId) });
                            else if (k.id === 'arac') { const el = izgaraRef.current?.querySelector(`[data-h="${r}-${c}"]`) as HTMLElement; const rc = el.getBoundingClientRect(); setAracSecim({ r, filtre: '', x: rc.left, y: rc.bottom + 2, i: 0 }); }
                            else if (k.id === 'durum') { /* tuşla */ }
                            else toggle(st, k.id as KolonId);
                          }}>
                            {duzenleniyor ? (
                              <div className="hc odak">
                                <input autoFocus value={duzen!.deger} style={{ textAlign: k.id === 'gorev' || k.id === 'not' ? 'left' : 'right' }}
                                  onChange={(e) => setDuzen({ deger: e.target.value })}
                                  onBlur={() => { degerYaz(st, k.id as KolonId, duzen!.deger); setDuzen(null); }}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter' || e.key === 'Tab') {
                                      e.preventDefault();
                                      degerYaz(st, k.id as KolonId, duzen!.deger);
                                      setDuzen(null);
                                      if (e.key === 'Tab') hareket(0, e.shiftKey ? -1 : 1);
                                      else if (k.id === 'kmc') hareket(0, 1); else hareket(1, 0);
                                    }
                                    if (e.key === 'Escape') { e.preventDefault(); setDuzen(null); }
                                  }} />
                              </div>
                            ) : (
                              <div className={`${sinif} ${odakta ? 'odak' : ''}`} tabIndex={odakta ? 0 : -1} data-h={`${r}-${c}`}>{icerik}</div>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <div className="satir" style={{ gap: 0, justifyContent: 'center', flexWrap: 'nowrap' }}>
                          {st.ilk && <button className="btn ikon kucuk hayalet" title="Bu güne başka araç ekle (Insert)" onClick={() => ekSefer(st)} disabled={salt}><Plus size={14} /></button>}
                          {(st.si >= 0 || g.durum) && <button className="btn ikon kucuk hayalet" title={st.si > 0 ? 'Bu araç satırını sil (Ctrl+Del)' : 'Günü temizle (Ctrl+Del)'} onClick={() => seferSil(st)} disabled={salt}><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="pt-alt">
          <span><kbd>↑↓←→</kbd> gezin</span>
          <span>Durum: <kbd>X</kbd> çalıştı <kbd>R</kbd> rapor <kbd>S</kbd> senelik <kbd>U</kbd> ücretsiz <kbd>M</kbd> mazeret <kbd>İ</kbd> idari <kbd>B</kbd> bayram <kbd>0</kbd> çalışmadı</span>
          <span><kbd>Enter</kbd> düzenle/seç</span>
          <span><kbd>Boşluk</kbd> işaretle</span>
          <span>Dış görev: <kbd>2</kbd> ⅔ <kbd>T</kbd> tam</span>
          <span>İG: <kbd>G</kbd> İG <kbd>1</kbd>/<kbd>5</kbd> İGD</span>
          <span><kbd>Ctrl+D</kbd> önceki günü kopyala</span>
          <span><kbd>Insert</kbd> araç ekle</span>
          <span>Yemek/Yol: <kbd>Boşluk</kbd> otomatik ↔ elle</span>
        </div>
      </div>

      {formTarih && secili && (
        <Modal baslik="Günlük kayıt formu" boyut="cok-genis" kapat={() => { setFormTarih(null); yukle(); }}>
          <GunlukForm surucuId={secili} tarih={formTarih} setSurucuId={(id) => setSecili(id)} setTarih={(t) => { if (t.slice(0, 7) === ay) setFormTarih(t); }} kaydedildi={() => yukle()} />
        </Modal>
      )}
      {aracSecim && (
        <AracSecici
          konum={aracSecim}
          araclar={araclar.filter((a) => a.aktif)}
          varsayilan={surucu?.varsayilanAracId ?? null}
          kapat={() => { setAracSecim(null); setTimeout(() => (izgaraRef.current?.querySelector(`[data-h="${odak.r}-${odak.c}"]`) as HTMLElement)?.focus(), 0); }}
          sec={(id) => {
            const st = satirlar[aracSecim.r];
            seferGuncelle(st, (s) => { if (s.arac_id !== id) { s.arac_id = id; s.km_cikis = null; s.km_donus = null; } if (!s.arac_ig && !s.arac_igd) s.arac_ig = st.sinif.X ? 1 : 0; });
            setAracSecim(null);
            setTimeout(() => (izgaraRef.current?.querySelector(`[data-h="${odak.r}-${odak.c}"]`) as HTMLElement)?.focus(), 0);
          }}
        />
      )}
    </div>
  );
}

function AracSecici(p: { konum: { filtre: string; x: number; y: number }; araclar: { id: number; plaka: string; aracTipi: string }[]; varsayilan: number | null; kapat: () => void; sec: (id: number) => void }) {
  const [f, setF] = useState(p.konum.filtre);
  const [i, setI] = useState(0);
  const norm = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s/g, '');
  const liste = p.araclar
    .filter((a) => !f || norm(a.plaka).includes(norm(f)) || norm(a.aracTipi).includes(norm(f)))
    .sort((a, b) => (a.id === p.varsayilan ? -1 : b.id === p.varsayilan ? 1 : 0));
  useEffect(() => setI(0), [f]);
  const y = Math.min(p.konum.y, window.innerHeight - 330);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onMouseDown={p.kapat} />
      <div className="pop" style={{ left: p.konum.x, top: y, width: 260 }}>
        <input className="girdi" autoFocus value={f} placeholder="Plaka yazın…" onChange={(e) => setF(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(liste.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter') { e.preventDefault(); if (liste[i]) p.sec(liste[i].id); }
            if (e.key === 'Escape') { e.preventDefault(); p.kapat(); }
          }} />
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {liste.map((a, k) => (
            <button key={a.id} className={k === i ? 'aktif' : ''} onMouseDown={(e) => { e.preventDefault(); p.sec(a.id); }}>
              <Truck size={14} /> <b>{a.plaka}</b> <span className="soluk kucuk-yazi">{a.aracTipi}</span>
              {a.id === p.varsayilan && <span className="k">varsayılan</span>}
            </button>
          ))}
          {!liste.length && <div className="soluk kucuk-yazi" style={{ padding: 8 }}>Eşleşen araç yok</div>}
        </div>
      </div>
    </>
  );
}
