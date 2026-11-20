import React, { useState } from 'react';
import { Lock, Unlock, FileSpreadsheet, FileText, X, Receipt } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { api } from '../lib/api';
import { sayi, tl, ayAdi } from '../lib/bicim';
import { ciktiAl } from '../lib/cikti';
import { useBildirim, useIslem, useOnay, Metrik, BosDurum } from '../ui/temel';
import { UyariPaneli } from './Asama2';
import type { DonemSonucu } from '../../engine/donem';
import type { Params } from '../../engine/params';

export default function Hakedis() {
  const { ay, sonuc, veri, kapali, oturum, yonetici, yenile } = useBaglam();
  const [secili, setSecili] = useState<number | null>(null);
  const bildir = useBildirim();
  const islem = useIslem();
  const onay = useOnay();
  if (!sonuc || !veri) return <div className="yukleniyor">Yükleniyor…</div>;
  if (sonuc.veriYok) {
    const z = sonuc.firma.onTabloToplam;
    return (
      <div className="izgara" style={{ gap: 14 }}>
        <div className="izgara k4">
          <Metrik etiket="Fatura toplamı (KDV dahil, tevkifat sonrası)" deger="0,00 ₺" alt={`KDV hariç: ${tl(z.V)} ₺`} />
          <Metrik etiket="İşçilik toplamı" deger="0,00 ₺" alt="Fiyat farkı: 0,00 ₺" />
          <Metrik etiket="Araç kiralama toplamı" deger="0,00 ₺" alt="Fiyat farkı: 0,00 ₺" />
          <Metrik etiket="Damga vergisi kesintisi" deger="0,00 ₺" alt="Dış görev 0,00 ₺ · Konaklama 0,00 ₺" />
        </div>
        <div className="kart"><BosDurum ikon={<Receipt size={36} />} baslik={`${ayAdi(ay)} için henüz puantaj girilmemiş`} metin="Günlük Kayıt Formu veya Sürücü Puantajı ekranından veri girildikçe hakediş otomatik hesaplanır. Puantajı olmayan ayda sabit ücret ve kira faturalanmaz." /></div>
      </div>
    );
  }
  if (!sonuc.giris.length) return <BosDurum ikon={<Receipt size={36} />} baslik="Bu ay için hakediş yok" metin="Puantaj girildikçe hakediş otomatik hesaplanır." />;
  const t = sonuc.firma.onTabloToplam;
  const fa = sonuc.firma.fatura;
  const hatalar = sonuc.uyarilar.filter((u) => u.seviye === 'hata');

  const kapat = async () => {
    if (hatalar.length) { bildir('hata', `${hatalar.length} hata düzeltilmeden dönem kapatılamaz (Hakediş Girişleri ekranına bakın).`); return; }
    if (!(await onay({ baslik: `${ayAdi(ay)} dönemini kapat`, metin: 'Dönem kapatıldığında bu ayın puantajı ve girişleri değiştirilemez.\nSürücülerin kümülatif gelir vergisi matrahı sonraki aya devredilir.\n\nDönem gerekirse daha sonra yeniden açılabilir.', evet: 'Dönemi kapat' }))) return;
    await islem(() => api('donemKapat', ay), 'Dönem kapatıldı.');
    yenile();
  };
  const ac = async () => {
    if (!(await onay({ baslik: `${ayAdi(ay)} dönemini aç`, metin: 'Dönem yeniden düzenlemeye açılacak. Değişiklik yaparsanız sonraki ayların kümülatif matrahı da değişebilir.', evet: 'Dönemi aç', tehlike: true }))) return;
    await islem(() => api('donemAc', ay), 'Dönem düzenlemeye açıldı.');
    yenile();
  };

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="izgara k4">
        <Metrik etiket="Fatura toplamı (KDV dahil, tevkifat sonrası)" deger={`${tl(fa.faturaToplami)} ₺`} alt={`KDV hariç: ${tl(t.V)} ₺`} />
        <Metrik etiket="İşçilik toplamı" deger={`${tl(t.I)} ₺`} alt={`Fiyat farkı: ${tl(t.G)} ₺`} />
        <Metrik etiket="Araç kiralama toplamı" deger={`${tl(t.N)} ₺`} alt={`Fiyat farkı: ${tl(t.M)} ₺`} />
        <Metrik etiket="Damga vergisi kesintisi" deger={`${tl(fa.damgaVergisi)} ₺`} alt={`Dış görev ${tl(t.T)} ₺ · Konaklama ${tl(t.Q)} ₺`} />
      </div>
      <div className="satir">
        <button className="btn birincil" onClick={() => ciktiAl(bildir, 'firma', ay)}><FileSpreadsheet size={16} /> Hakediş Excel (tam dosya)</button>
        <button className="btn" onClick={() => ciktiAl(bildir, 'plakaPdf', ay)}><FileText size={16} /> Tüm plaka formları (PDF)</button>
        <button className="btn" onClick={() => ciktiAl(bildir, 'plakaExcel', ay)}><FileSpreadsheet size={16} /> Tüm plaka formları (Excel)</button>
        <div className="bosluk" />
        {!oturum.saltOkunur && (kapali
          ? (yonetici ? <button className="btn" onClick={ac}><Unlock size={15} /> Dönemi aç</button> : <span className="soluk kucuk-yazi">Dönemi yalnız yönetici açabilir</span>)
          : (yonetici ? <button className="btn" onClick={kapat}><Lock size={15} /> Dönemi kapat</button> : <span className="soluk kucuk-yazi">Dönemi yalnız yönetici kapatabilir</span>))}
      </div>
      <div className="kart tablo-sar" style={{ maxHeight: 'calc(100vh - 330px)' }}>
        <table className="tablo">
          <thead>
            <tr>
              <th>No</th><th>Sürücü</th><th>Plaka</th><th>Araç tipi</th>
              <th className="sayi solcizgi">Sürücü ücreti</th><th className="sayi">İşçilik F.F.</th><th className="sayi">Asg. üc. farkı</th><th className="sayi">İşçilik toplamı</th><th className="sayi">İşçilik KDV (tevk.)</th><th className="sayi">İşçilik genel</th>
              <th className="sayi solcizgi">Kira</th><th className="sayi">Araç F.F.</th><th className="sayi">Araç toplamı</th><th className="sayi">Araç KDV (tevk.)</th><th className="sayi">Araç genel</th>
              <th className="sayi solcizgi">Konaklama</th><th className="sayi">Kon. KDV</th><th className="sayi">Dış görev</th><th className="sayi">Akaryakıt yansıtma</th>
              <th className="sayi solcizgi">KDV hariç</th><th className="sayi">KDV dahil</th>
            </tr>
          </thead>
          <tbody>
            {sonuc.firma.onTablo.map((o, i) => (
              <tr key={o.key} className={`tikla ${secili === i ? 'secili' : ''}`} onClick={() => setSecili(i)} title="Plaka formunu görmek için tıklayın">
                <td className="soluk">{o.no}</td><td className="kalin">{o.surucu || <span className="soluk">—</span>}</td><td>{o.plaka}</td><td className="soluk">{o.aracTipi}</td>
                <td className="sayi solcizgi">{tl(o.F_surucuUcreti)}</td><td className="sayi">{tl(o.G_iscilikFF)}</td><td className="sayi">{tl(o.H_asgariFark)}</td><td className="sayi kalin">{tl(o.I_iscilikToplam)}</td><td className="sayi">{tl(o.J_iscilikKdv)}</td><td className="sayi">{tl(o.K_iscilikGenel)}</td>
                <td className="sayi solcizgi">{tl(o.L_kira)}</td><td className="sayi">{tl(o.M_aracFF)}</td><td className="sayi kalin">{tl(o.N_aracToplam)}</td><td className="sayi">{tl(o.O_aracKdv)}</td><td className="sayi">{tl(o.P_aracGenel)}</td>
                <td className="sayi solcizgi">{o.Q_konaklama ? tl(o.Q_konaklama) : ''}</td><td className="sayi">{o.R_konaklamaKdv ? tl(o.R_konaklamaKdv) : ''}</td><td className="sayi">{o.T_disGorev ? tl(o.T_disGorev) : ''}</td><td className="sayi">{o.U_akaryakit ? tl(o.U_akaryakit) : ''}</td>
                <td className="sayi solcizgi">{tl(o.V_kdvHaric)}</td><td className="sayi kalin">{tl(o.W_kdvDahil)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>TOPLAM ({sonuc.firma.onTablo.length} satır)</td>
              <td className="sayi">{tl(t.F)}</td><td className="sayi">{tl(t.G)}</td><td className="sayi">{tl(t.H)}</td><td className="sayi">{tl(t.I)}</td><td className="sayi">{tl(t.J)}</td><td className="sayi">{tl(t.K)}</td>
              <td className="sayi">{tl(t.L)}</td><td className="sayi">{tl(t.M)}</td><td className="sayi">{tl(t.N)}</td><td className="sayi">{tl(t.O)}</td><td className="sayi">{tl(t.P)}</td>
              <td className="sayi">{tl(t.Q)}</td><td className="sayi">{tl(t.R)}</td><td className="sayi">{tl(t.T)}</td><td className="sayi">{tl(t.U)}</td>
              <td className="sayi">{tl(t.V)}</td><td className="sayi">{tl(t.W)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="izgara k2">
        <div className="kart">
          <div className="kart-b"><h3>Fatura özeti</h3></div>
          <table className="tablo">
            <tbody>
              {[
                ['İşçilik toplamı', fa.iscilik], ['Araç kiralama toplamı', fa.arac], ['Konaklama toplamı', fa.konaklama],
                [`Hesaplanan işçilik KDV %${Math.round(veri.params.vergi.kdv * 100)}`, fa.iscilikKdv], [`Hesaplanan araç KDV %${Math.round(veri.params.vergi.kdv * 100)}`, fa.aracKdv],
                [`Hesaplanan konaklama KDV %${Math.round(veri.params.vergi.konaklamaKdv * 100)}`, fa.konaklamaKdv],
                ['İşçilik KDV tevkifatı', -fa.iscilikTevkifat], ['Araç kiralama KDV tevkifatı', -fa.aracTevkifat], ['Konaklama KDV tevkifatı', -fa.konaklamaTevkifat],
              ].map(([a, b]) => <tr key={a as string}><td>{a}</td><td className="sayi">{tl(b as number)}</td></tr>)}
              <tr><td className="kalin">FATURA TOPLAMI</td><td className="sayi kalin" style={{ fontSize: 14 }}>{tl(fa.faturaToplami)} ₺</td></tr>
              <tr><td>Damga vergisi kesintisi (%{sayi(veri.params.vergi.damgaHakedis * 100, 3)})</td><td className="sayi">{tl(fa.damgaVergisi)}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="kart">
          <div className="kart-b"><h3>Kontroller</h3></div>
          <div className="kart-g"><UyariPaneli uyarilar={sonuc.uyarilar} sinir={6} /></div>
        </div>
      </div>
      {secili != null && <PlakaFormuCekmece sonuc={sonuc} p={veri.params} i={secili} kapat={() => setSecili(null)} gec={(d) => setSecili((s) => Math.max(0, Math.min(sonuc.giris.length - 1, (s ?? 0) + d)))} ay={ay} />}
    </div>
  );
}

function PlakaFormuCekmece({ sonuc, p, i, kapat, gec, ay }: { sonuc: DonemSonucu; p: Params; i: number; kapat: () => void; gec: (d: number) => void; ay: string }) {
  const bildir = useBildirim();
  const g = sonuc.giris[i];
  const f = sonuc.firma.formlar[i];
  const ff = p.fiyatFarki;
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat();
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); gec(1); }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); gec(-1); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [kapat, gec]);
  const S = ({ a, b, k }: { a: string; b: React.ReactNode; k?: boolean }) => <tr><td>{a}</td><td className="sayi" style={{ fontWeight: k ? 700 : undefined }}>{b}</td></tr>;
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 54, background: 'rgba(15,23,42,0.25)' }} onClick={kapat} />
      <div className="cekmece">
        <div className="modal-b">
          <h2>{g.plaka} — {g.surucu || 'sürücüsüz'}</h2>
          <span className="soluk kucuk-yazi">{i + 1}/{sonuc.giris.length} · ↑↓ ile gezin</span>
          <div className="bosluk" />
          <button className="btn kucuk" onClick={() => ciktiAl(bildir, 'plakaPdf', ay, { indeksler: [i], ek: g.plaka })}><FileText size={14} /> PDF</button>
          <button className="btn kucuk" onClick={() => ciktiAl(bildir, 'plakaExcel', ay, { indeksler: [i], ek: g.plaka })}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn ikon hayalet" onClick={kapat}><X size={18} /></button>
        </div>
        <div className="modal-g form-onizleme">
          <div className="izgara k2" style={{ gap: 12 }}>
            <table><tbody>
              <tr><th colSpan={2}>Araç bilgileri</th></tr>
              <tr><td>Cinsi</td><td>{g.aracTipi}</td></tr><tr><td>Marka / Model</td><td>{g.markaModel} {g.modelYili ?? ''}</td></tr>
              <tr><td>Görev yeri</td><td>{g.gorevYeri}</td></tr><tr><td>Tüketim oranı</td><td className="sayi">{sayi(f.L7_tuketim, 3)}</td></tr>
              <tr><td>EPDK akaryakıt</td><td className="sayi">{sayi(f.L8_epdk, 5)}</td></tr><tr><td>Araç kiralama bedeli</td><td className="sayi">{tl(f.L9_kira)}</td></tr>
            </tbody></table>
            <table><tbody>
              <tr><th colSpan={2}>KM ve kesintiler</th></tr>
              <S a="Önceki ay kapanış KM" b={sayi(f.G15_oncekiKm, 1)} /><S a="Çalışılan ayın kapanış KM" b={sayi(f.G16_kapanisKm, 1)} />
              <S a={`Hizmet içi KM${g.kmDuzeltme ? ` (düzeltme ${g.kmDuzeltme > 0 ? '+' : ''}${g.kmDuzeltme})` : ''}`} b={sayi(f.G17_hizmetIciKm, 1)} />
              <S a="Hizmet dışı KM" b={sayi(f.G19_hizmetDisiKm, 1)} k /><S a="Hizmet dışı KM yakıt kesintisi" b={tl(f.I15_yakitYansitma)} />
              <S a="Hizmet dışı gün / kesinti bedeli" b={`${sayi(f.I17_hizmetDisiGun)} gün / ${tl(f.I18_kesinti)}`} />
            </tbody></table>
          </div>
          <div className="bolum-baslik">Fiyat farkı</div>
          <table><tbody>
            <tr><th>a1</th><th>a2</th><th>b1</th><th>b2</th><th>b3</th><th>c</th><th>Go / Gn</th><th>İo / İn</th><th>Mo / Mn</th><th>Pn</th><th>B</th><th>Araç F.F.</th></tr>
            <tr><td>{ff.a1}</td><td>{ff.a2}</td><td>{ff.b1}</td><td>{ff.b2}</td><td>{ff.b3}</td><td>{ff.c}</td><td>{sayi(ff.Go)} / {sayi(ff.Gn)}</td><td>{sayi(ff.Io)} / {sayi(ff.In)}</td><td>{sayi(ff.Mo)} / {sayi(ff.Mn)}</td><td className="kalin">{f.M19_pn.toFixed(5)}</td><td>{ff.B}</td><td className="sayi">{tl(f.M20_aracFiyatFarki)}</td></tr>
          </tbody></table>
          <div className="bolum-baslik">Sürücüye ilişkin</div>
          <table><tbody>
            <tr><th></th><th>Fazla çalışma (saat)</th><th>Hafta tatili (saat)</th><th>UBGT (gün)</th><th>Dış görev (gün)</th><th>Konaklama (gün)</th><th>Yemek</th><th>Yol</th></tr>
            <tr><td>Birim</td>{[f.B26, f.D26, f.E26, f.F26, f.G26, f.H26, f.I26].map((x, k) => <td key={k} className="sayi">{tl(x)}</td>)}</tr>
            <tr><td>Miktar</td>{[f.B27, f.D27, f.E27, f.F27, f.G27, f.H27, f.I27].map((x, k) => <td key={k} className="sayi">{sayi(x)}</td>)}</tr>
            <tr><td>Tutar</td>{[f.B28, f.D28, f.E28, f.F28, f.G28, f.H28, f.I28].map((x, k) => <td key={k} className="sayi">{tl(x)}</td>)}</tr>
          </tbody></table>
          <div className="izgara k2" style={{ marginTop: 14, gap: 12 }}>
            <table><tbody>
              <S a={`Sürücü ücreti (yemek-yol hariç, ${p.ucret.yemekYolDusumGun} gün düşümlü)`} b={tl(f.K26_surucuUcreti)} />
              <S a="İşçilik fiyat farkı" b={tl(f.L26_fiyatFarki)} /><S a="Asgari ücret farkı" b={tl(f.M26_asgariFark)} />
              <S a="Toplam sürücü ücreti" b={tl(f.K28_toplamSurucu)} k />
            </tbody></table>
            <table><tbody>
              <S a="Toplam işçilik" b={tl(f.K31)} /><S a="KDV" b={tl(f.K32)} /><S a="Tevkifat" b={`-${tl(f.K33)}`} /><S a="KDV'li toplam işçilik" b={tl(f.K34)} k />
              <S a="Araç kiralama" b={tl(f.K35_aracKiralama)} /><S a="KDV" b={tl(f.K36_aracKdv)} /><S a="Tevkifat" b={`-${tl(f.K37_aracTevkifat)}`} /><S a="KDV'li toplam araç kiralama" b={tl(f.K38_aracToplam)} k />
              <S a="Konaklama" b={tl(f.K39)} /><S a="Konaklama KDV" b={tl(f.K40)} /><S a="KDV'li toplam konaklama" b={tl(f.K41)} k />
              <S a="KDV'siz genel toplam" b={tl(f.K42)} k /><S a="ÖDENECEK GENEL TOPLAM" b={`${tl(f.K43)} ₺`} k />
              <S a="Akaryakıt yansıtma (KDV dahil)" b={tl(f.K46)} />
            </tbody></table>
          </div>
        </div>
      </div>
    </>
  );
}
