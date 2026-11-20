import React, { useState } from 'react';
import { FileSpreadsheet, Wallet } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { sayi, tl } from '../lib/bicim';
import { ciktiAl } from '../lib/cikti';
import { useBildirim, Modal, Metrik, BosDurum } from '../ui/temel';
import type { SurucuFaaliyetSatiri } from '../../engine/firma';

export default function Bordro() {
  const { ay, sonuc, veri } = useBaglam();
  const bildir = useBildirim();
  const [detay, setDetay] = useState<SurucuFaaliyetSatiri | null>(null);
  const [sekme, setSekme] = useState<'faaliyet' | 'net'>('faaliyet');
  if (!sonuc || !veri) return <div className="yukleniyor">Yükleniyor…</div>;
  const satirlar = sonuc.firma.surucuFaaliyet.filter((_, i) => sonuc.giris[i].surucuVar);
  if (!satirlar.length) return <BosDurum ikon={<Wallet size={36} />} baslik="Bu ay bordro yok" />;
  const top = (k: keyof SurucuFaaliyetSatiri) => satirlar.reduce((s, x) => s + (x[k] as number), 0);
  const b = veri.params.bordro;
  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="izgara k4">
        <Metrik etiket="Net ödenecek toplam" deger={`${tl(sonuc.firma.bordroToplam)} ₺`} alt={`${satirlar.length} sürücü`} />
        <Metrik etiket="Brüt toplam" deger={`${tl(top('W_brut'))} ₺`} />
        <Metrik etiket="SGK + işsizlik (işçi)" deger={`${tl(top('AD_sgk') + top('AE_issizlik'))} ₺`} />
        <Metrik etiket="Gelir vergisi + damga" deger={`${tl(top('AF_gelirVergisi') + top('AH_damga'))} ₺`} />
      </div>
      <div className="satir">
        <div className="sekmeler" style={{ marginBottom: 0, flex: 1 }}>
          <button className={sekme === 'faaliyet' ? 'aktif' : ''} onClick={() => setSekme('faaliyet')}>Sürücü Faaliyet (brütten nete)</button>
          <button className={sekme === 'net' ? 'aktif' : ''} onClick={() => setSekme('net')}>Net maaş listesi (Bordro Tutar)</button>
        </div>
        <button className="btn" onClick={() => ciktiAl(bildir, 'surucuFaaliyet', ay)}><FileSpreadsheet size={15} /> Sürücü Faaliyet Excel</button>
        <button className="btn birincil" onClick={() => ciktiAl(bildir, 'bordro', ay)}><FileSpreadsheet size={15} /> Bordro Tutar Excel</button>
      </div>
      {sekme === 'faaliyet' ? (
        <div className="kart tablo-sar" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <table className="tablo">
            <thead><tr>
              <th>Sürücü</th><th>Plaka</th><th className="sayi">Çalışma</th><th className="sayi">F. mesai (saat)</th>
              <th className="sayi solcizgi">Temel ücret</th><th className="sayi">Resmi tatil</th><th className="sayi">Fazla mesai</th><th className="sayi">Konaklama</th><th className="sayi">Dış görev</th><th className="sayi">Yemek</th><th className="sayi">Yol</th><th className="sayi">Brüt</th>
              <th className="sayi solcizgi">SGK matrahı</th><th className="sayi">SGK</th><th className="sayi">İşsizlik</th><th className="sayi">GV matrahı</th><th className="sayi">Kümülatif</th><th className="sayi">Gelir vergisi</th><th className="sayi">Damga</th>
              <th className="sayi solcizgi">NET</th>
            </tr></thead>
            <tbody>
              {satirlar.map((x) => (
                <tr key={x.key} className="tikla" onClick={() => setDetay(x)}>
                  <td className="kalin">{x.surucu}</td><td>{x.plaka}</td><td className="sayi">{x.C}</td><td className="sayi">{sayi(x.H)}</td>
                  <td className="sayi solcizgi">{tl(x.P_temel)}</td><td className="sayi">{tl(x.Q_resmiTatil)}</td><td className="sayi">{tl(x.R_fazlaMesai)}</td><td className="sayi">{x.S_konaklama ? tl(x.S_konaklama) : ''}</td><td className="sayi">{x.T_disGorev ? tl(x.T_disGorev) : ''}</td><td className="sayi">{tl(x.U_yemek)}</td><td className="sayi">{tl(x.V_yol)}</td><td className="sayi kalin">{tl(x.W_brut)}</td>
                  <td className="sayi solcizgi">{tl(x.AA_sgkMatrah)}</td><td className="sayi">{tl(x.AD_sgk)}</td><td className="sayi">{tl(x.AE_issizlik)}</td><td className="sayi">{tl(x.AB_gvmAylik)}</td><td className="sayi soluk">{tl(x.AC_gvmYillik)}</td><td className="sayi">{tl(x.AF_gelirVergisi)}</td><td className="sayi">{tl(x.AH_damga)}</td>
                  <td className="sayi solcizgi kalin" style={{ color: 'var(--ok)' }}>{tl(x.AJ_odenecek)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={2}>TOPLAM</td><td className="sayi">{top('C')}</td><td className="sayi">{sayi(top('H'))}</td>
              <td className="sayi">{tl(top('P_temel'))}</td><td className="sayi">{tl(top('Q_resmiTatil'))}</td><td className="sayi">{tl(top('R_fazlaMesai'))}</td><td className="sayi">{tl(top('S_konaklama'))}</td><td className="sayi">{tl(top('T_disGorev'))}</td><td className="sayi">{tl(top('U_yemek'))}</td><td className="sayi">{tl(top('V_yol'))}</td><td className="sayi">{tl(top('W_brut'))}</td>
              <td className="sayi">{tl(top('AA_sgkMatrah'))}</td><td className="sayi">{tl(top('AD_sgk'))}</td><td className="sayi">{tl(top('AE_issizlik'))}</td><td className="sayi">{tl(top('AB_gvmAylik'))}</td><td></td><td className="sayi">{tl(top('AF_gelirVergisi'))}</td><td className="sayi">{tl(top('AH_damga'))}</td>
              <td className="sayi">{tl(sonuc.firma.surucuFaaliyetToplam)}</td>
            </tr></tfoot>
          </table>
        </div>
      ) : (
        <div className="kart tablo-sar" style={{ maxWidth: 640, maxHeight: 'calc(100vh - 300px)' }}>
          <table className="tablo">
            <thead><tr><th>#</th><th>Sürücü</th><th>Plaka</th><th className="sayi">Net ödenecek</th></tr></thead>
            <tbody>{sonuc.firma.bordro.map((x, i) => <tr key={x.key}><td className="soluk">{i + 1}</td><td className="kalin">{x.surucu}</td><td>{x.plaka}</td><td className="sayi kalin">{tl(x.tutar)}</td></tr>)}</tbody>
            <tfoot><tr><td colSpan={3}>Toplam</td><td className="sayi">{tl(sonuc.firma.bordroToplam)}</td></tr></tfoot>
          </table>
        </div>
      )}
      <div className="soluk kucuk-yazi">
        Temel ücret = brüt asgari ücret ({tl(b.asgariUcretBrut)}) × {sayi(b.carpanSurucu)} (operatör × {sayi(b.carpanOperator)}); fazla mesai saat ücreti = temel / {b.aylikSaat} × {sayi(b.fazlaMesaiZam)};
        yemek/yol günlük {tl(b.yemekGunluk)}; yemek istisnası günlük {tl(b.yemekIstisnaGunluk)}; SGK %{sayi(b.sgkIsci * 100)} (emekli SGDP %{sayi(b.sgdpIsci * 100)}), işsizlik %{sayi(b.issizlikIsci * 100)};
        gelir vergisi kümülatif matrahla dilimli, asgari ücret istisnası düşülerek; damga %{sayi(b.damga * 100, 3)} (asgari ücret kadar istisna). Parametreler Ayarlar ekranından değiştirilir.
      </div>
      {detay && (
        <Modal baslik={`${detay.surucu} — brütten nete`} kapat={() => setDetay(null)} boyut="genis">
          <div className="izgara k2">
            <table className="tablo"><tbody>
              {[
                ['Çalışma günü', sayi(detay.C)], ['Ay günü / hizmet dışı / kesinti günü', `${detay.AO_ayGunu} / ${sayi(detay.AP_raporIzin)} / ${sayi(detay.AR_kesinti)}`],
                ['Resmi tatil (gün)', sayi(detay.D)], ['Hafta tatili (gün → saat)', `${detay.E} → ${sayi(detay.F)}`], ['Fazla mesai (saat)', sayi(detay.G)], ['Toplam fazla mesai (saat)', sayi(detay.H)],
                ['Dış görev (gün)', sayi(detay.J)], ['Konaklama (gün)', sayi(detay.I)], ['Yemek / yol (gün)', `${detay.K} / ${detay.L}`],
              ].map(([a, b2]) => <tr key={a}><td>{a}</td><td className="sayi">{b2}</td></tr>)}
            </tbody></table>
            <table className="tablo"><tbody>
              {[
                ['Temel ücret', detay.P_temel], ['Resmi tatil ücreti', detay.Q_resmiTatil], ['Fazla mesai ücreti', detay.R_fazlaMesai], ['Konaklama (KDV dahil)', detay.S_konaklama],
                ['Dış görev', detay.T_disGorev], ['Yemek', detay.U_yemek], ['Yol', detay.V_yol],
              ].map(([a, b2]) => <tr key={a as string}><td>{a}</td><td className="sayi">{tl(b2 as number)}</td></tr>)}
              <tr><td className="kalin">Brüt toplam</td><td className="sayi kalin">{tl(detay.W_brut)}</td></tr>
              <tr><td>Yemek SGK istisnası</td><td className="sayi">-{tl(detay.Z_sgkIstisna)}</td></tr>
              <tr><td>SGK matrahı</td><td className="sayi">{tl(detay.AA_sgkMatrah)}</td></tr>
              <tr><td>SGK işçi payı {detay.X_emekli ? '(SGDP)' : ''}</td><td className="sayi">-{tl(detay.AD_sgk)}</td></tr>
              <tr><td>İşsizlik işçi payı</td><td className="sayi">-{tl(detay.AE_issizlik)}</td></tr>
              <tr><td>GV matrahı (aylık) / kümülatif</td><td className="sayi">{tl(detay.AB_gvmAylik)} / {tl(detay.AC_gvmYillik)}</td></tr>
              <tr><td>Önceki kümülatif matrah</td><td className="sayi soluk">{tl(detay.Y_kumulatif)}</td></tr>
              <tr><td>Hesaplanan GV − asgari ücret istisnası ({detay.AK_calismaAyi}. ay: {tl(detay.AL_vergiIndirimi)})</td><td className="sayi">-{tl(detay.AF_gelirVergisi)}</td></tr>
              <tr><td>Damga vergisi</td><td className="sayi">-{tl(detay.AH_damga)}</td></tr>
              <tr><td className="kalin">NET ÖDENECEK</td><td className="sayi kalin" style={{ color: 'var(--ok)', fontSize: 15 }}>{tl(detay.AJ_odenecek)} ₺</td></tr>
            </tbody></table>
          </div>
        </Modal>
      )}
    </div>
  );
}
