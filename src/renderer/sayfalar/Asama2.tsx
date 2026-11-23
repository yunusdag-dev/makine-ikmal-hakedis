/**
 * AŞAMA 2 GİRİŞ: Aşama 1'den otomatik gelen (kilitli) veriler + elle girilen aylık alanlar.
 * Excel'deki firma "Giriş" sayfasının karşılığı.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Lock, Info, CheckCircle2 } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { api } from '../lib/api';
import { sayi, tl, ayAdi } from '../lib/bicim';
import { SayiGirdi, useIslem, BosDurum } from '../ui/temel';
import { varsayilanCalismaAyi } from '../../engine/donem';

type Sekme = 'aktarim' | 'arac' | 'surucu';

export function UyariPaneli({ uyarilar, sinir = 8 }: { uyarilar: { seviye: string; mesaj: string }[]; sinir?: number }) {
  const [hepsi, setHepsi] = useState(false);
  if (!uyarilar.length) return <div className="uyari-oge bilgi"><CheckCircle2 size={16} color="var(--ok)" /> Kontrol edilen tüm veriler tutarlı.</div>;
  const sirali = [...uyarilar].sort((a, b) => ['hata', 'uyari', 'bilgi'].indexOf(a.seviye) - ['hata', 'uyari', 'bilgi'].indexOf(b.seviye));
  const gos = hepsi ? sirali : sirali.slice(0, sinir);
  return (
    <div className="uyari-liste">
      {gos.map((u, i) => (
        <div key={i} className={`uyari-oge ${u.seviye}`}>
          {u.seviye === 'bilgi' ? <Info size={15} /> : <AlertTriangle size={15} />}<span>{u.mesaj}</span>
        </div>
      ))}
      {sirali.length > sinir && <button className="btn kucuk hayalet" onClick={() => setHepsi(!hepsi)}>{hepsi ? 'Daha az göster' : `Tümünü göster (${sirali.length})`}</button>}
    </div>
  );
}

export default function Asama2() {
  const { ay, veri, sonuc, kapali, oturum, yenile } = useBaglam();
  const [sekme, setSekme] = useState<Sekme>(() => (localStorage.getItem('a2-sekme') as Sekme) || 'aktarim');
  const islem = useIslem();
  const salt = kapali || oturum.saltOkunur;
  const setS = (s: Sekme) => { setSekme(s); localStorage.setItem('a2-sekme', s); };

  // Yalnız değişen alan gönderilir; aynı anda çalışan başka kullanıcının değiştirdiği diğer alanlar korunur.
  const aracKaydet = async (vid: number, alan: string, deger: any) => {
    await islem(() => api('aracAyKaydet', vid, ay, { [alan]: deger }));
    await yenile();
  };
  const surucuKaydet = async (did: number, alan: string, deger: any) => {
    await islem(() => api('surucuAyKaydet', did, ay, { [alan]: deger }));
    await yenile();
  };

  const toplam = useMemo(() => {
    if (!sonuc) return null;
    const t: any = {};
    for (const k of ['ig', 'igd', 'surucuCalisma', 'hizmetIciKm', 'fazlaMesai', 'haftaTatili', 'resmiTatil', 'disGorev', 'konaklama', 'yemek', 'yol'])
      t[k] = sonuc.kurum.reduce((s, x: any) => s + x[k], 0);
    return t;
  }, [sonuc]);

  if (!veri || !sonuc) return <div className="yukleniyor">Yükleniyor…</div>;
  if (!sonuc.giris.length) return <BosDurum baslik="Bu ay için kayıt yok" metin="Sürücü ve araç ekleyip puantaj girdiğinizde hakediş girişleri burada oluşur." />;
  const p = veri.params;
  const hataSay = sonuc.uyarilar.filter((u) => u.seviye === 'hata').length;

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="kart kart-g">
        <div className="satir ara" style={{ marginBottom: 10 }}>
          <b>{ayAdi(ay)} — veri kontrolü</b>
          {hataSay > 0 ? <span className="rozet hata">{hataSay} hata</span> : <span className="rozet ok">Hata yok</span>}
        </div>
        <UyariPaneli uyarilar={sonuc.uyarilar} sinir={5} />
      </div>

      <div className="sekmeler" style={{ marginBottom: 0 }}>
        <button className={sekme === 'aktarim' ? 'aktif' : ''} onClick={() => setS('aktarim')}><Lock size={13} style={{ verticalAlign: -2 }} /> Aşama 1'den aktarılan (HAKEDİŞ)</button>
        <button className={sekme === 'arac' ? 'aktif' : ''} onClick={() => setS('arac')}>Araç girişleri</button>
        <button className={sekme === 'surucu' ? 'aktif' : ''} onClick={() => setS('surucu')}>Sürücü / bordro girişleri</button>
      </div>

      {sekme === 'aktarim' && (
        <div className="kart tablo-sar" style={{ maxHeight: 'calc(100vh - 330px)' }}>
          <table className="tablo">
            <thead><tr>
              <th>#</th><th>Plaka</th><th>Sürücü</th><th className="sayi">Araç İG</th><th className="sayi">Araç İGD</th><th className="sayi">Sürücü çalışma</th>
              <th className="sayi">Kapanış KM</th><th className="sayi">Hizmet içi KM</th><th className="sayi">Fazla mesai</th><th className="sayi">Hafta tatili</th>
              <th className="sayi">Resmi tatil</th><th className="sayi">Dış görev</th><th className="sayi">Konaklama</th><th className="sayi">Yemek</th><th className="sayi">Yol</th>
            </tr></thead>
            <tbody>
              {sonuc.kurum.map((k, i) => {
                const g = sonuc.giris[i];
                return (
                  <tr key={g.key}>
                    <td className="soluk">{i + 1}</td>
                    <td className="kalin">{k.plaka || <span className="soluk">—</span>}{!k.aracBirincil && k.vehicleId && <span className="rozet mavi" title="Aynı aracı paylaşan ikinci sürücü; araç kalemleri ilk satırda">paylaşımlı</span>}</td>
                    <td>{k.surucu || <span className="soluk">(sürücüsüz)</span>}</td>
                    <td className="sayi oto">{k.ig}</td><td className="sayi oto">{sayi(k.igd)}</td><td className="sayi oto">{k.surucuCalisma}</td>
                    <td className="sayi oto">{sayi(g.kapanisKm, 1)}</td><td className="sayi oto">{sayi(k.hizmetIciKm, 1)}</td>
                    <td className="sayi oto">{sayi(g.fazlaMesai)}{g.fazlaMesai !== k.fazlaMesai && <span className="rozet uyari" title="Fazla mesai düzeltmesi uygulanmış" style={{ marginLeft: 4 }}>±</span>}</td>
                    <td className="sayi oto">{k.haftaTatili}</td><td className="sayi oto">{sayi(k.resmiTatil)}</td><td className="sayi oto">{sayi(k.disGorev)}</td>
                    <td className="sayi oto">{k.konaklama}</td><td className="sayi oto">{k.yemek}</td><td className="sayi oto">{k.yol}</td>
                  </tr>
                );
              })}
            </tbody>
            {toplam && <tfoot><tr><td colSpan={3}>Toplam</td><td className="sayi">{toplam.ig}</td><td className="sayi">{sayi(toplam.igd)}</td><td className="sayi">{toplam.surucuCalisma}</td><td></td><td className="sayi">{sayi(toplam.hizmetIciKm, 1)}</td><td className="sayi">{sayi(sonuc.giris.reduce((s, g) => s + g.fazlaMesai, 0))}</td><td className="sayi">{toplam.haftaTatili}</td><td className="sayi">{sayi(toplam.resmiTatil)}</td><td className="sayi">{sayi(toplam.disGorev)}</td><td className="sayi">{toplam.konaklama}</td><td className="sayi">{toplam.yemek}</td><td className="sayi">{toplam.yol}</td></tr></tfoot>}
          </table>
        </div>
      )}

      {sekme === 'arac' && (
        <div className="kart tablo-sar" style={{ maxHeight: 'calc(100vh - 330px)' }}>
          <table className="tablo">
            <thead>
              <tr><th colSpan={2}></th><th className="grup" colSpan={3}>Otomatik (kilitli)</th><th className="grup" colSpan={7}>Elle giriş (boş = otomatik / kart değeri)</th></tr>
              <tr>
                <th>Plaka</th><th>Sürücü</th>
                <th className="sayi solcizgi">Kapanış KM</th><th className="sayi">Hizmet içi KM</th><th className="sayi">Hizmet dışı KM</th>
                <th className="sayi solcizgi">Önceki ay kapanış KM</th><th className="sayi">Hizmet dışı gün (araç)</th><th className="sayi">KM düzeltme</th><th>Düzeltme açıklaması</th>
                <th className="sayi">Kira bedeli</th><th className="sayi">Tüketim (lt/km)</th><th className="sayi">Yakıt çarpanı</th>
              </tr>
            </thead>
            <tbody>
              {sonuc.giris.filter((g) => g.vehicleId != null && g.aracVar).map((g) => {
                const i = sonuc.giris.indexOf(g);
                const f = sonuc.firma.formlar[i];
                const vid = g.vehicleId!;
                const a = veri.aracAylari[vid];
                const kart = veri.araclar.find((x) => x.id === vid)!;
                const otoOnceki = veri.oncekiKmOtomatik[vid] ?? kart?.baslangicKm ?? null;
                return (
                  <tr key={g.key}>
                    <td className="kalin">{g.plaka}</td>
                    <td>{g.surucu}</td>
                    <td className="sayi oto solcizgi">{sayi(g.kapanisKm, 1)}</td>
                    <td className="sayi oto">{sayi(g.hizmetIciKm, 1)}</td>
                    <td className="sayi oto" style={{ color: f.G19_hizmetDisiKm < 0 ? 'var(--err)' : f.G19_hizmetDisiKm > 0 ? 'var(--warn)' : undefined, fontWeight: f.G19_hizmetDisiKm ? 650 : undefined }}>{sayi(f.G19_hizmetDisiKm, 1)}</td>
                    <td className="solcizgi"><SayiGirdi className="hucre" deger={a?.oncekiKm ?? null} ondalik={1} disabled={salt} yerTutucu={otoOnceki != null ? sayi(otoOnceki, 1) + ' (oto)' : 'giriniz'} degis={(v) => aracKaydet(vid, 'onceki_km', v)} /></td>
                    <td><SayiGirdi className="hucre" deger={a?.hizmetDisiGun || null} disabled={salt} yerTutucu="0" degis={(v) => aracKaydet(vid, 'hizmet_disi_gun', v ?? 0)} /></td>
                    <td><SayiGirdi className="hucre" deger={a?.kmDuzeltme || null} ondalik={1} disabled={salt} yerTutucu="0" degis={(v) => aracKaydet(vid, 'km_duzeltme', v ?? 0)} /></td>
                    <td><input className="hucre" style={{ textAlign: 'left', minWidth: 160 }} disabled={salt} defaultValue={a?.kmDuzeltmeAciklama ?? ''} key={`${vid}-${a?.kmDuzeltmeAciklama}`} placeholder="—"
                      onBlur={(e) => { if (e.target.value !== (a?.kmDuzeltmeAciklama ?? '')) aracKaydet(vid, 'km_duzeltme_aciklama', e.target.value); }} /></td>
                    <td><SayiGirdi className="hucre" deger={a?.kiraBedeli ?? null} disabled={salt} yerTutucu={tl(kart?.kiraBedeli)} degis={(v) => aracKaydet(vid, 'kira_bedeli', v)} /></td>
                    <td><SayiGirdi className="hucre" deger={a?.tuketimOrani ?? null} ondalik={4} disabled={salt} yerTutucu={sayi(kart?.tuketimOrani, 3)} degis={(v) => aracKaydet(vid, 'tuketim_orani', v)} /></td>
                    <td><SayiGirdi className="hucre" deger={a?.yakitYansitmaCarpani ?? null} ondalik={3} disabled={salt} yerTutucu={sayi(kart?.yakitYansitmaCarpani ?? 1)} degis={(v) => aracKaydet(vid, 'yakit_yansitma_carpani', v)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sekme === 'surucu' && (
        <div className="kart tablo-sar" style={{ maxHeight: 'calc(100vh - 330px)' }}>
          <table className="tablo">
            <thead>
              <tr><th colSpan={2}></th><th className="grup" colSpan={6}>Hakediş</th><th className="grup" colSpan={3}>Bordro</th></tr>
              <tr>
                <th>Sürücü</th><th>Plaka</th>
                <th className="sayi solcizgi">Puantaj F. mesai</th><th className="sayi">F. mesai düzeltme (±saat)</th><th className="sayi">Hakedişe giden F. mesai</th>
                <th className="sayi">Hizmet dışı gün (sürücü)</th><th className="sayi">Konaklama birim fiyatı</th><th className="sayi">Emekli</th>
                <th className="sayi solcizgi">Önceki kümülatif GV matrahı</th><th className="sayi">Çalışma ayı</th><th className="sayi">Özel sigorta</th>
              </tr>
            </thead>
            <tbody>
              {sonuc.giris.filter((g) => g.driverId != null).map((g) => {
                const did = g.driverId!;
                const s = veri.surucuAylari[did];
                const k = sonuc.kurum.find((x) => x.driverId === did);
                const kart = veri.suruculer.find((x) => x.id === did);
                const otoKum = Number(ay.slice(5)) === 1 ? 0 : veri.oncekiKumulatifOtomatik[did] ?? 0;
                const otoAy = varsayilanCalismaAyi(ay, kart?.iseGiris ?? '');
                const std = g.ucretGrubu === 'operator' ? p.ucret.operator.konaklama : p.ucret.surucu.konaklama;
                return (
                  <tr key={g.key}>
                    <td className="kalin">{g.surucu}</td>
                    <td>{g.plaka}</td>
                    <td className="sayi oto solcizgi">{sayi(k?.fazlaMesai ?? 0)}</td>
                    <td><SayiGirdi className="hucre" deger={s?.fazlaMesaiDuzeltme || null} disabled={salt} yerTutucu="0" degis={(v) => surucuKaydet(did, 'fazla_mesai_duzeltme', v ?? 0)} /></td>
                    <td className="sayi oto kalin">{sayi(g.fazlaMesai)}</td>
                    <td><SayiGirdi className="hucre" deger={s?.hizmetDisiGun || null} disabled={salt} yerTutucu="0" degis={(v) => surucuKaydet(did, 'hizmet_disi_gun', v ?? 0)} /></td>
                    <td><SayiGirdi className="hucre" deger={s?.konaklamaBirimFiyat ?? null} ondalik={4} disabled={salt} yerTutucu={tl(std)} degis={(v) => surucuKaydet(did, 'konaklama_birim_fiyat', v)} /></td>
                    <td className="sayi oto">{g.emekli ? 'Evet' : 'Hayır'}</td>
                    <td className="solcizgi"><SayiGirdi className="hucre" deger={s?.kumulatifGvm ?? null} disabled={salt} yerTutucu={tl(otoKum) + ' (oto)'} degis={(v) => surucuKaydet(did, 'kumulatif_gvm', v)} /></td>
                    <td><SayiGirdi className="hucre" deger={s?.calismaAyi ?? null} ondalik={0} disabled={salt} yerTutucu={`${otoAy} (oto)`} degis={(v) => surucuKaydet(did, 'calisma_ayi', v)} /></td>
                    <td><SayiGirdi className="hucre" deger={s?.ozelSigorta || null} disabled={salt} yerTutucu="0" degis={(v) => surucuKaydet(did, 'ozel_sigorta', v ?? 0)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="soluk kucuk-yazi">
        Gri hücreler günlük puantajdan otomatik hesaplanır ve burada değiştirilemez. Sarı hücreler elle girilir; boş bırakılırsa gri yazıyla gösterilen otomatik değer kullanılır.
        Önceki ay kapanış KM, aracın önceki aylardaki en büyük KM kaydından; kümülatif GV matrahı önceki ayın kapanışından otomatik gelir (Ocak ayında sıfırlanır).
      </div>
    </div>
  );
}
