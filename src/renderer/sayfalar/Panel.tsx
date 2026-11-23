import React, { useMemo } from 'react';
import { CalendarDays, Receipt, Wallet, Users, Truck, Gauge, ArrowRight, Database } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { sayi, tl, ayAdi, bugunTarih } from '../lib/bicim';
import { Metrik, BosDurum } from '../ui/temel';
import { UyariPaneli } from './Asama2';

export default function Panel({ git }: { git: (s: any) => void }) {
  const { ay, sonuc, veri, kapali } = useBaglam();
  const durum = useMemo(() => {
    if (!sonuc || !veri) return null;
    const isGunu = sonuc.takvim.toplamIsGunu;
    const bugun = bugunTarih();
    const gecenIsGunu = sonuc.takvim.gunler.filter((g) => (g.X || g.RTA || g.DBA) && g.tarih <= bugun).length;
    const suruculer = veri.suruculer.filter((s) => s.aktif).map((s) => {
      const girilen = new Set(veri.surucuGunleri.filter((g) => g.driverId === s.id && g.durum).map((g) => g.tarih));
      const eksik = sonuc.takvim.gunler.filter((g) => (g.X || g.RTA || g.DBA) && g.tarih <= bugun && !girilen.has(g.tarih)).length;
      return { s, girilen: girilen.size, eksik };
    });
    const km = sonuc.kurum.reduce((t, k) => t + k.hizmetIciKm, 0);
    return { isGunu, gecenIsGunu, suruculer, km };
  }, [sonuc, veri]);
  if (!sonuc || !veri || !durum) return <div className="yukleniyor">Yükleniyor…</div>;
  if (!veri.suruculer.length && !veri.araclar.length) {
    return (
      <BosDurum ikon={<Database size={40} />} baslik="Hoş geldiniz" metin="Başlamak için sürücü ve araç ekleyin ya da mevcut Excel dosyalarınızı içe aktarın.">
        <div className="satir" style={{ justifyContent: 'center' }}>
          <button className="btn birincil" onClick={() => git('veritabani')}><Database size={15} /> Excel'den içe aktar</button>
          <button className="btn" onClick={() => git('araclar')}><Truck size={15} /> Araç ekle</button>
          <button className="btn" onClick={() => git('suruculer')}><Users size={15} /> Sürücü ekle</button>
        </div>
      </BosDurum>
    );
  }
  const eksikler = durum.suruculer.filter((x) => x.eksik > 0).sort((a, b) => b.eksik - a.eksik);
  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="izgara k4">
        <Metrik ikon={<Receipt size={14} />} etiket="Fatura toplamı" deger={`${tl(sonuc.firma.fatura.faturaToplami)} ₺`} alt={`${ayAdi(ay)}${kapali ? ' · kapalı' : ''}`} />
        <Metrik ikon={<Wallet size={14} />} etiket="Net maaş toplamı" deger={`${tl(sonuc.firma.bordroToplam)} ₺`} alt={`${sonuc.firma.bordro.length} sürücü`} />
        <Metrik ikon={<CalendarDays size={14} />} etiket="Ayın iş günü" deger={sayi(durum.isGunu)} alt={`Bugüne kadar ${durum.gecenIsGunu} iş günü`} />
        <Metrik ikon={<Gauge size={14} />} etiket="Hizmet içi KM" deger={sayi(durum.km, 0)} alt={`${veri.araclar.filter((a) => a.aktif).length} aktif araç`} />
      </div>
      <div className="izgara k2">
        <div className="kart">
          <div className="kart-b"><h3>Puantaj durumu</h3><div className="bosluk" /><button className="btn kucuk" onClick={() => git('puantaj')}>Puantaja git <ArrowRight size={14} /></button></div>
          <div className="kart-g">
            {eksikler.length === 0 ? <div className="uyari-oge bilgi">Tüm aktif sürücülerin bugüne kadarki iş günleri girilmiş.</div> : (
              <>
                <div className="soluk kucuk-yazi" style={{ marginBottom: 8 }}>Bugüne kadarki iş günlerinden durum kodu girilmemiş olanlar:</div>
                <div className="tablo-sar" style={{ maxHeight: 330 }}>
                  <table className="tablo"><tbody>
                    {eksikler.map(({ s, eksik, girilen }) => (
                      <tr key={s.id}><td className="kalin">{s.adSoyad}</td><td className="sayi"><span className="rozet uyari">{eksik} gün eksik</span></td><td className="sayi soluk">{girilen} gün girili</td></tr>
                    ))}
                  </tbody></table>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="kart">
          <div className="kart-b"><h3>Kontroller</h3><div className="bosluk" /><button className="btn kucuk" onClick={() => git('asama2')}>Girişlere git <ArrowRight size={14} /></button></div>
          <div className="kart-g"><UyariPaneli uyarilar={sonuc.uyarilar} sinir={9} /></div>
        </div>
      </div>
      <div className="kart">
        <div className="kart-b"><h3>Takvim — {ayAdi(ay)}</h3></div>
        <div className="kart-g satir" style={{ gap: 6 }}>
          {sonuc.takvim.gunler.map((g) => (
            <div key={g.tarih} title={g.ad || g.tip} style={{
              width: 34, padding: '4px 0', textAlign: 'center', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: g.RT || g.DB ? 'var(--holiday)' : g.RTA || g.DBA ? 'var(--arefe)' : g.Ctesi || g.Pzr ? 'var(--weekend)' : '#f3f6fa',
              color: g.RT || g.DB ? '#a12828' : g.Ctesi || g.Pzr ? '#6b5fa8' : 'var(--text)',
            }}>{g.gun}<div style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--muted)' }}>{g.tip}</div></div>
          ))}
        </div>
        <div className="soluk kucuk-yazi" style={{ padding: '0 16px 14px' }}>
          Hafta içi {sonuc.takvim.sayilar.X} · Cumartesi {sonuc.takvim.sayilar.Ctesi} · Pazar {sonuc.takvim.sayilar.Pzr} · Resmi tatil {sonuc.takvim.sayilar.RT} · Arife {sonuc.takvim.sayilar.RTA + sonuc.takvim.sayilar.DBA} · Dini bayram {sonuc.takvim.sayilar.DB}
          {' '}· Cumartesi {veri.params.takvim.cumartesiIsGunu ? 'iş günü sayılır' : 'iş günü sayılmaz'}
        </div>
      </div>
    </div>
  );
}
