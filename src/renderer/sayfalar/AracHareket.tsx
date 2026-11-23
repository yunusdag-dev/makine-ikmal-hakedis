import React, { useEffect, useMemo, useState } from 'react';
import { Search, Truck, AlertTriangle } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { api } from '../lib/api';
import { GUN_KISA, sayi, tarihTR } from '../lib/bicim';
import { BosDurum } from '../ui/temel';
import { aracAylik } from '../../engine/kurum';

export default function AracHareket() {
  const { ay, veri, sonuc, surum } = useBaglam();
  const [secili, setSecili] = useState<number | null>(() => Number(localStorage.getItem('ah-arac')) || null);
  const [arama, setArama] = useState('');
  const [satirlar, setSatirlar] = useState<any[]>([]);
  const araclar = veri?.araclar ?? [];
  useEffect(() => { if (!secili && araclar.length) setSecili(araclar[0].id); }, [araclar, secili]);
  useEffect(() => {
    if (!secili) return;
    localStorage.setItem('ah-arac', String(secili));
    api<any[]>('aracAyi', secili, ay).then(setSatirlar);
  }, [secili, ay, surum]);
  const arac = araclar.find((a) => a.id === secili);
  const ozet = useMemo(() => (secili && veri ? aracAylik(secili, veri.seferler) : null), [secili, veri]);
  const giris = sonuc?.giris.find((g) => g.vehicleId === secili && g.aracVar);
  const form = giris ? sonuc!.firma.formlar[sonuc!.giris.indexOf(giris)] : null;
  const norm = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/\s/g, '');
  const liste = araclar.filter((a) => !arama || norm(a.plaka).includes(norm(arama)));
  const suruculer = veri?.suruculer ?? [];
  const varsayilanSurucu = suruculer.filter((s) => s.varsayilanAracId === secili).map((s) => s.adSoyad);

  if (!veri) return <div className="yukleniyor">Yükleniyor…</div>;
  if (!araclar.length) return <div style={{ flex: 1 }}><BosDurum ikon={<Truck size={36} />} baslik="Kayıtlı araç yok" /></div>;
  let oncekiDonus: number | null = null;
  return (
    <div className="pt-yerlesim">
      <div className="pt-liste">
        <div className="ara">
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
            <input className="girdi" style={{ paddingLeft: 32 }} placeholder="Plaka ara…" value={arama} onChange={(e) => setArama(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && liste[0]) setSecili(liste[0].id); }} />
          </div>
        </div>
        <div className="ogeler">
          {liste.map((a) => {
            const o = sonuc?.kurum.find((k) => k.vehicleId === a.id && k.aracBirincil);
            return (
              <div key={a.id} className={`pt-oge ${a.id === secili ? 'secili' : ''}`} onClick={() => setSecili(a.id)}>
                <div className="av"><Truck size={15} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="ad">{a.plaka}</div>
                  <div className="alt">{a.aracTipi}</div>
                </div>
                <div className="ilerleme">{sayi(o?.hizmetIciKm ?? 0, 0)} km</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="pt-sag">
        <div className="pt-baslik">
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{arac?.plaka}</div>
            <div className="soluk kucuk-yazi">{arac?.markaModel} {arac?.modelYili ?? ''} · {arac?.aracTipi} · {arac?.gorevYeri} · sürücü: {varsayilanSurucu.join(', ') || '—'}</div>
          </div>
          {ozet && (
            <div className="pt-ozet">
              <span className="c">İG<b>{ozet.ig}</b></span>
              <span className="c">İGD<b>{sayi(ozet.igd)}</b></span>
              {form && <span className="c">Önceki kapanış<b>{sayi(form.G15_oncekiKm, 1)}</b></span>}
              <span className="c">Kapanış<b>{sayi(ozet.kapanisKm, 1)}</b></span>
              <span className="c">Hizmet içi<b>{sayi(ozet.hizmetIciKm, 1)}</b></span>
              {form && <span className={`c ${form.G19_hizmetDisiKm ? '' : 'vurgu'}`}>Hizmet dışı<b>{sayi(form.G19_hizmetDisiKm, 1)}</b></span>}
              {form && form.I15_yakitYansitma > 0 && <span className="c">Yakıt yansıtma<b>{sayi(form.I15_yakitYansitma)} ₺</b></span>}
            </div>
          )}
        </div>
        <div className="pt-izgara">
          {!satirlar.length ? <BosDurum baslik="Bu ay bu araçla kayıt yok" metin="Araç kayıtları sürücü puantajından girilir (Sürücü Puantajı ekranı)." /> : (
            <table className="tablo">
              <thead><tr><th>Tarih</th><th>Sürücü</th><th className="sayi">Çıkış KM</th><th className="sayi">Dönüş KM</th><th className="sayi">KM</th><th>İG/İGD</th><th>Görev yeri</th><th>Görevli</th><th></th></tr></thead>
              <tbody>
                {satirlar.map((s) => {
                  const [y, m, d] = s.tarih.split('-').map(Number);
                  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
                  const kopuk = oncekiDonus != null && s.km_cikis != null && s.km_cikis < oncekiDonus;
                  const bosluk = oncekiDonus != null && s.km_cikis != null && s.km_cikis > oncekiDonus;
                  if (s.km_donus != null) oncekiDonus = s.km_donus;
                  const baska = !varsayilanSurucu.includes(s.ad_soyad);
                  return (
                    <tr key={s.id}>
                      <td>{tarihTR(s.tarih)} <span className="soluk">{GUN_KISA[wd]}</span></td>
                      <td>{s.ad_soyad ?? '—'} {baska && <span className="rozet uyari">başka sürücü</span>}</td>
                      <td className="sayi">{s.km_cikis != null ? sayi(s.km_cikis, 1) : ''}</td>
                      <td className="sayi">{s.km_donus != null ? sayi(s.km_donus, 1) : ''}</td>
                      <td className="sayi">{s.km_cikis != null && s.km_donus != null ? sayi(s.km_donus - s.km_cikis, 1) : ''}</td>
                      <td>{s.arac_ig ? 'İG' : s.arac_igd ? `İGD ${sayi(s.arac_igd)}` : ''}</td>
                      <td>{s.gorev_yeri}</td>
                      <td>{s.gorevli}</td>
                      <td>{kopuk && <span className="rozet hata" title="Çıkış KM bir önceki dönüş KM'den küçük"><AlertTriangle size={11} /> KM geri</span>}
                        {bosluk && <span className="rozet uyari" title="Bir önceki dönüşten sonra kayıtsız KM var (hizmet dışı)">+{sayi(s.km_cikis - (oncekiDonusOnce(satirlar, s) ?? s.km_cikis), 1)} km</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="pt-alt">Araç hareketleri sürücü puantajından gelir. KM sürekliliği kontrol edilir: kayıtsız KM farkı hakedişte "hizmet dışı KM" olarak yakıt yansıtmasına girer.</div>
      </div>
    </div>
  );
}

function oncekiDonusOnce(liste: any[], s: any): number | null {
  const i = liste.indexOf(s);
  for (let k = i - 1; k >= 0; k--) if (liste[k].km_donus != null) return liste[k].km_donus;
  return null;
}
