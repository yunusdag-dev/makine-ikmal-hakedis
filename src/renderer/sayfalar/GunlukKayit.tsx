/** Günlük Kayıt Formu sayfası: sürücü + tarih seçerek o günün mesai / görev / KM bilgilerini form ile girme */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { GUN_KISA, sayi, ayAdi, bugunTarih } from '../lib/bicim';
import { surucuAyiYukle, GunVeri } from '../lib/gunluk';
import GunlukForm from '../ui/GunlukForm';
import { BosDurum } from '../ui/temel';
import { ayTakvimi } from '../../engine/calendar';

function bugunVeyaAyBasi(ay: string) {
  const bugun = bugunTarih();
  return bugun.startsWith(ay) ? bugun : `${ay}-01`;
}

export default function GunlukKayit() {
  const { veri, ay, setAy, surum } = useBaglam();
  const suruculer = veri?.suruculer ?? [];
  const [surucuId, setSurucuIdState] = useState<number | null>(() => Number(localStorage.getItem('gk-surucu')) || null);
  const [tarih, setTarihState] = useState<string>(() => {
    const t = localStorage.getItem('gk-tarih');
    return t && t.startsWith(ay) ? t : bugunVeyaAyBasi(ay);
  });
  const [ayKayit, setAyKayit] = useState<Record<string, GunVeri>>({});
  const [yenileSay, setYenileSay] = useState(0);
  const sonAy = useRef(ay);

  const setSurucuId = (id: number) => { setSurucuIdState(id); localStorage.setItem('gk-surucu', String(id)); };
  const setTarih = (t: string) => {
    setTarihState(t);
    localStorage.setItem('gk-tarih', t);
    if (t.slice(0, 7) !== ay) { sonAy.current = t.slice(0, 7); setAy(t.slice(0, 7)); }
  };
  // üstteki ay seçiciyle ay değişirse tarihi o aya taşı
  useEffect(() => {
    if (ay !== sonAy.current) { sonAy.current = ay; if (tarih.slice(0, 7) !== ay) setTarihState(bugunVeyaAyBasi(ay)); }
  }, [ay]);
  useEffect(() => {
    if ((!surucuId || !suruculer.some((s) => s.id === surucuId)) && suruculer.length) setSurucuId(suruculer[0].id);
  }, [suruculer]);
  useEffect(() => {
    if (!surucuId) return;
    surucuAyiYukle(surucuId, tarih.slice(0, 7)).then(setAyKayit).catch(() => {});
  }, [surucuId, tarih.slice(0, 7), yenileSay, surum]);

  const takvim = useMemo(() => {
    if (!veri) return null;
    const [y, m] = tarih.slice(0, 7).split('-').map(Number);
    return ayTakvimi(y, m, veri.tatiller, veri.params);
  }, [veri, tarih.slice(0, 7)]);
  const aracById = useMemo(() => new Map((veri?.araclar ?? []).map((a) => [a.id, a])), [veri]);

  if (!veri) return <div className="yukleniyor">Yükleniyor…</div>;
  if (!suruculer.length) return <BosDurum ikon={<Info size={36} />} baslik="Henüz sürücü yok" metin="Önce Sürücüler ekranından sürücü ekleyin." />;
  const girilen = Object.values(ayKayit).filter((x) => x.gun.durum).length;
  const toplam = Object.values(ayKayit).reduce((t, x) => ({ fm: t.fm + (x.gun.fazla_mesai || 0), km: t.km + x.seferler.reduce((k, s) => k + (s.km_cikis != null && s.km_donus != null ? s.km_donus - s.km_cikis : 0), 0) }), { fm: 0, km: 0 });

  return (
    <div className="gk-yerlesim">
      <div className="kart kart-g">
        <GunlukForm surucuId={surucuId} tarih={tarih} setSurucuId={setSurucuId} setTarih={setTarih} kaydedildi={() => setYenileSay((x) => x + 1)} />
      </div>
      <div className="kart gk-liste" style={{ position: 'sticky', top: 0 }}>
        <div className="kart-b" style={{ flexWrap: 'wrap' }}>
          <h3>{ayAdi(tarih.slice(0, 7))}</h3>
          <div className="bosluk" />
          <span className="soluk kucuk-yazi">{girilen} gün girili · F.M. {sayi(toplam.fm)} sa · {sayi(toplam.km, 0)} km</span>
        </div>
        <div style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
          {takvim?.gunler.map((g) => {
            const k = ayKayit[g.tarih];
            const cls = [g.tarih === tarih ? 'secili' : '', g.RT || g.DB ? 'rt' : g.Ctesi || g.Pzr ? 'hs' : ''].join(' ');
            const kod = k?.gun.durum;
            const kodSinif = kod === 'Sİ' ? 'SI' : kod === 'Üİ' ? 'UI' : kod === 'Mİ' ? 'MI' : kod === 'İİ' ? 'II' : kod === '0' ? 'S0' : kod;
            const km = k?.seferler.reduce((t, s) => t + (s.km_cikis != null && s.km_donus != null ? s.km_donus - s.km_cikis : 0), 0) ?? 0;
            return (
              <div key={g.tarih} className={`gun-satir ${cls}`} onClick={() => setTarih(g.tarih)} title={g.ad || undefined}>
                <span><b>{g.gun}</b> <span className="soluk">{GUN_KISA[g.weekday - 1]}</span></span>
                <span>{kod ? <span className={`kod ${kodSinif}`}>{kod}</span> : <span className="soluk">·</span>}</span>
                <span className="soluk" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {k?.seferler.map((s) => aracById.get(s.arac_id ?? -1)?.plaka).filter(Boolean).join(', ')}
                  {k?.seferler.some((s) => s.gorev_yeri) ? ` · ${k.seferler.map((s) => s.gorev_yeri).filter(Boolean).join(', ')}` : ''}
                </span>
                <span className="soluk kucuk-yazi" style={{ textAlign: 'right' }}>
                  {km ? `${sayi(km, 0)} km` : ''}{k?.gun.fazla_mesai ? ` · ${sayi(k.gun.fazla_mesai)} sa` : ''}
                  {k?.gun.dis_gorev ? ' · DG' : ''}{k?.gun.konaklama ? ' · K' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
