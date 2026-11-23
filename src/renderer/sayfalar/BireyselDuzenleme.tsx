/**
 * Bireysel Düzenleme: bir sürücünün seçilen tarih aralığındaki günlük kayıtlarını listeler; seçilen kaydı düzenler veya siler.
 * Bugünün tarihinden bağımsızdır (geçmiş tarihli kayıt da düzenlenir). Kapatılmış dönemler değiştirilemez.
 * Düzenleme günlük kayıt formuyla yapılır; kaydedilince hakediş, bordro ve çıktılar mevcut kurallarla yeniden hesaplanır.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Info, History as GecmisIkon } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { api } from '../lib/api';
import { GUN_KISA, sayi, tarihTR, zamanTR } from '../lib/bicim';
import { surucuAyiYukle, GunVeri } from '../lib/gunluk';
import GunlukForm from '../ui/GunlukForm';
import { Alan, BosDurum } from '../ui/temel';
import { adNorm, adlaraBol } from '../../engine/ad';

const ayBasi = (ay: string) => `${ay}-01`;
const aySonu = (ay: string) => {
  const [y, m] = ay.split('-').map(Number);
  return `${ay}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
const TARIH_DESEN = /^\d{4}-\d{2}-\d{2}$/;

/** Başlangıç ve bitiş tarihlerinin kapsadığı aylar (en çok 14 ay) */
function aylar(a: string, b: string): string[] {
  const out: string[] = [];
  let [y, m] = a.slice(0, 7).split('-').map(Number);
  const [y2, m2] = b.slice(0, 7).split('-').map(Number);
  while ((y < y2 || (y === y2 && m <= m2)) && out.length < 14) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export default function BireyselDuzenleme() {
  const { veri, ay, setAy, surum, kapali } = useBaglam();
  const suruculer = veri?.suruculer ?? [];
  const aracById = useMemo(() => new Map((veri?.araclar ?? []).map((a) => [a.id, a])), [veri]);
  const [surucuId, setSurucuId] = useState<number | null>(null);
  const [bas, setBas] = useState(ayBasi(ay));
  const [bit, setBit] = useState(aySonu(ay));
  const [tarih, setTarihDurum] = useState<string | null>(null);
  const [kayitlar, setKayitlar] = useState<Record<string, GunVeri>>({});
  const [yenileSay, setYenileSay] = useState(0);
  const [gecmis, setGecmis] = useState<any[]>([]);
  const [hata, setHata] = useState('');
  const [filtre, setFiltre] = useState('');

  useEffect(() => { if (!surucuId && suruculer.length) setSurucuId(suruculer[0].id); }, [suruculer]);
  const aralikGecerli = TARIH_DESEN.test(bas) && TARIH_DESEN.test(bit) && bas <= bit;

  useEffect(() => {
    if (!surucuId || !aralikGecerli) { setKayitlar({}); return; }
    let iptal = false;
    setHata('');
    Promise.all(aylar(bas, bit).map((a) => surucuAyiYukle(surucuId, a)))
      .then((liste) => { if (!iptal) setKayitlar(Object.assign({}, ...liste)); })
      .catch((e) => { if (!iptal) setHata(e.message); });
    return () => { iptal = true; };
  }, [surucuId, bas, bit, yenileSay, surum]);

  const satirlar = useMemo(() => Object.entries(kayitlar)
    .filter(([t, k]) => t >= bas && t <= bit && (k.gun.durum || k.seferler.length || k.gun.fazla_mesai || k.gun.dis_gorev || k.gun.konaklama || k.gun.notlar))
    .filter(([, k]) => {
      // personel veya görev yerine göre yazdıkça filtrele (birden çok kişi içeren kayıtlar da o kişi aranınca çıkar)
      const f = adNorm(filtre);
      if (!f) return true;
      return k.seferler.some((s) => adlaraBol(s.gorevli).concat(adlaraBol(s.gorev_yeri)).some((a) => adNorm(a).includes(f)));
    })
    .sort(([a], [b]) => (a < b ? -1 : 1)), [kayitlar, bas, bit, filtre]);

  const surucu = suruculer.find((s) => s.id === surucuId);
  useEffect(() => {
    if (!surucu || !tarih) { setGecmis([]); return; }
    api<any[]>('kayitlar', { arama: `${surucu.adSoyad} ${tarih}`, limit: 40 })
      .then((l) => setGecmis(l.filter((x) => x.varlik_id === `${surucu.id}/${tarih}`).slice(0, 8)))
      .catch(() => setGecmis([]));
  }, [surucu?.id, tarih, yenileSay, surum]);

  const sec = (t: string) => { setTarihDurum(t); if (t.slice(0, 7) !== ay) setAy(t.slice(0, 7)); };

  if (!veri) return <div className="yukleniyor">Yükleniyor…</div>;
  if (!suruculer.length) return <BosDurum ikon={<Info size={36} />} baslik="Henüz sürücü yok" metin="Önce Sürücüler ekranından sürücü ekleyin." />;

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="kart kart-g">
        <div className="satir" style={{ gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Alan etiket="Sürücü">
            <select className="girdi" style={{ minWidth: 240 }} value={surucuId ?? ''} onChange={(e) => { setSurucuId(Number(e.target.value)); setTarihDurum(null); }}>
              {suruculer.map((s) => <option key={s.id} value={s.id}>{s.adSoyad}</option>)}
            </select>
          </Alan>
          <Alan etiket="Başlangıç">
            <input type="date" className="girdi" value={bas} onChange={(e) => { setBas(e.target.value); if (e.target.value > bit) setBit(e.target.value); }} />
          </Alan>
          <Alan etiket="Bitiş">
            <input type="date" className="girdi" value={bit} onChange={(e) => setBit(e.target.value)} />
          </Alan>
          <Alan etiket="Personel / görev yeri ara"><input className="girdi" style={{ minWidth: 220 }} placeholder="Yazdıkça filtrelenir" value={filtre} onChange={(e) => setFiltre(e.target.value)} /></Alan>
          <button className="btn" onClick={() => { setBas(ayBasi(ay)); setBit(aySonu(ay)); setTarihDurum(null); }}>Seçili ay</button>
          <div className="soluk kucuk-yazi" style={{ maxWidth: 320 }}>
            Sürücü ve tarih aralığını seçin, listeden bir günü seçip düzenleyin veya silin. Bugünün tarihi önemli değildir.
          </div>
        </div>
        {!aralikGecerli && <div className="uyari-oge hata" style={{ marginTop: 10 }}>Tarih aralığı geçersiz (başlangıç bitişten sonra olamaz).</div>}
        {hata && <div className="uyari-oge hata" style={{ marginTop: 10 }}>{hata}</div>}
      </div>

      <div className="gk-yerlesim">
        <div className="izgara" style={{ gap: 14 }}>
          {tarih ? (
            <>
              {kapali && <div className="uyari-oge bilgi">Bu dönem kapalı; kayıt değiştirilemez. Düzenlemek için dönemi yönetici olarak yeniden açın.</div>}
              <div className="kart kart-g">
                <GunlukForm surucuId={surucuId} tarih={tarih} setSurucuId={setSurucuId} setTarih={sec} onayli kaydedildi={() => setYenileSay((x) => x + 1)} />
              </div>
              <div className="kart">
                <div className="kart-b"><GecmisIkon size={15} /><h3>Bu günün düzenleme geçmişi</h3></div>
                <div className="kart-g">
                  {gecmis.length === 0
                    ? <span className="soluk">Bu gün için kayıtlı değişiklik yok.</span>
                    : gecmis.map((g) => (
                      <div key={g.id} className="kucuk-yazi" style={{ padding: '3px 0' }}><b>{g.kullanici}</b> · {zamanTR(g.zaman)} · {g.islem}</div>
                    ))}
                  <div className="soluk kucuk-yazi" style={{ marginTop: 6 }}>Eski ve yeni değerlerin tamamı Değişiklik Kaydı sayfasındadır.</div>
                </div>
              </div>
            </>
          ) : (
            <BosDurum ikon={<Info size={36} />} baslik="Bir gün seçin" metin="Sağdaki listeden düzenlemek istediğiniz günü seçin." />
          )}
        </div>

        <div className="kart gk-liste" style={{ position: 'sticky', top: 0 }}>
          <div className="kart-b"><h3>{surucu?.adSoyad}</h3><div className="bosluk" /><span className="soluk kucuk-yazi">{satirlar.length} kayıtlı gün</span></div>
          <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {satirlar.map(([t, k]) => {
              const [y, m, d] = t.split('-').map(Number);
              const km = k.seferler.reduce((x, s) => x + (s.km_cikis != null && s.km_donus != null ? s.km_donus - s.km_cikis : 0), 0);
              return (
                <div key={t} className={`gun-satir ${t === tarih ? 'secili' : ''}`} onClick={() => sec(t)}>
                  <span title={tarihTR(t)}><b>{tarihTR(t).slice(0, 5)}</b> <span className="soluk">{GUN_KISA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}</span></span>
                  <span>{k.gun.durum ? <span className="rozet mavi">{k.gun.durum}</span> : <span className="soluk">·</span>}</span>
                  <span className="soluk" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {k.seferler.map((s) => aracById.get(s.arac_id ?? -1)?.plaka).filter(Boolean).join(', ')}
                    {k.seferler.some((s) => s.gorevli || s.gorev_yeri) ? ` · ${k.seferler.flatMap((s) => [s.gorevli, s.gorev_yeri]).filter(Boolean).join(' / ')}` : ''}
                    {k.seferler.length > 1 ? ` · ${k.seferler.length} görev` : ''}
                  </span>
                  <span className="soluk kucuk-yazi" style={{ textAlign: 'right' }}>
                    {km ? `${sayi(km, 0)} km` : ''}{k.gun.fazla_mesai ? ` · ${sayi(k.gun.fazla_mesai)} sa` : ''}{k.gun.dis_gorev ? ' · DG' : ''}{k.gun.konaklama ? ' · K' : ''}
                  </span>
                </div>
              );
            })}
            {!satirlar.length && <div className="soluk" style={{ padding: 16 }}>Bu aralıkta kayıt yok. Tarih aralığını genişletin.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
