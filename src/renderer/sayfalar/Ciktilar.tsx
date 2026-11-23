import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Building2, Receipt, Users, Truck, Wallet, ClipboardList, Loader2 } from 'lucide-react';
import { useBaglam } from '../lib/baglam';
import { ciktiAl, CiktiTur } from '../lib/cikti';
import { useBildirim } from '../ui/temel';
import { ayAdi } from '../lib/bicim';

const KARTLAR: { tur: CiktiTur; baslik: string; aciklama: string; ikon: any; pdf?: boolean; vurgu?: boolean }[] = [
  { tur: 'kurum', baslik: 'Kurum puantaj dosyası (Aşama 1)', aciklama: 'Giriş, EK-4 Sürücü Puantaj cetveli, her araç için aylık araç ve sürücü puantaj tablosu, HAKEDİŞ özet sayfası.', ikon: Building2 },
  { tur: 'firma', baslik: 'Firma hakediş dosyası (Aşama 2 — tam)', aciklama: 'Giriş, ÖN TABLO, tüm plaka hakediş formları, Sürücü Faaliyet, Araç Faaliyet, Bordro Tutar. Tüm hesaplar canlı formüllü.', ikon: Receipt, vurgu: true },
  { tur: 'onTablo', baslik: 'ÖN TABLO', aciklama: 'Araç ve sürücü bazında hakedişin nihai hali, toplamlar ve fatura özeti (bağlı plaka formlarıyla).', ikon: ClipboardList },
  { tur: 'surucuFaaliyet', baslik: 'Sürücü Faaliyet', aciklama: 'Brüt ücretten SGK, işsizlik, gelir vergisi (kümülatif matrah), damga vergisi ve asgari ücret istisnalarına kadar net ödenecek tutar.', ikon: Users },
  { tur: 'aracFaaliyet', baslik: 'Araç Faaliyet', aciklama: 'Araç bazında yapılan KM, kira, sürücü ücreti, hizmet dışı kullanım ve kapanış KM.', ikon: Truck },
  { tur: 'bordro', baslik: 'Bordro Tutar (net maaş listesi)', aciklama: 'Sürücü bazında nokta atışı net maaş listesi (alfabetik).', ikon: Wallet },
  { tur: 'plakaPdf', baslik: 'Plaka hakediş formları (PDF)', aciklama: 'Her plaka için fiyat farkı ve ödemeye esas ücret hesabı formu; tek PDF, her plaka ayrı sayfa.', ikon: FileText, pdf: true },
  { tur: 'plakaExcel', baslik: 'Plaka hakediş formları (Excel)', aciklama: 'Her plaka ayrı sayfada, Excel formu biçiminde (değerler).', ikon: FileSpreadsheet },
];

export default function Ciktilar() {
  const { ay, sonuc } = useBaglam();
  const bildir = useBildirim();
  const [mesgul, setMesgul] = useState<string | null>(null);
  const al = async (t: CiktiTur) => { setMesgul(t); try { await ciktiAl(bildir, t, ay); } finally { setMesgul(null); } };
  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="soluk">{ayAdi(ay)} dönemi için çıktılar · {sonuc?.giris.length ?? 0} satır ({sonuc?.giris.filter((g) => g.surucuVar).length ?? 0} sürücü)</div>
      <div className="izgara k3">
        {KARTLAR.map((k) => (
          <div key={k.tur} className="kart" style={{ display: 'flex', flexDirection: 'column', borderColor: k.vurgu ? '#bcd0fb' : undefined }}>
            <div className="kart-g" style={{ flex: 1 }}>
              <div className="satir" style={{ marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: k.pdf ? '#fde9e9' : '#e6f4ec', display: 'grid', placeItems: 'center', color: k.pdf ? '#b42323' : '#0b7a51' }}><k.ikon size={19} /></div>
                <b style={{ fontSize: 14 }}>{k.baslik}</b>
              </div>
              <div className="soluk" style={{ lineHeight: 1.5 }}>{k.aciklama}</div>
            </div>
            <div style={{ padding: '0 16px 14px' }}>
              <button className={`btn ${k.vurgu ? 'birincil' : ''}`} disabled={!!mesgul || !sonuc?.giris.length} onClick={() => al(k.tur)}>
                {mesgul === k.tur ? <Loader2 size={15} /> : k.pdf ? <FileText size={15} /> : <FileSpreadsheet size={15} />} {k.pdf ? 'PDF oluştur' : 'Excel oluştur'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="soluk kucuk-yazi">
        Excel çıktıları örnek dosyalarınızın biçimini (sütun, başlık, birleştirilmiş hücre, yazı tipi, kenarlık, sayı biçimi) korur. Hesap hücrelerine canlı formül yazılır ve
        uygulamanın hesapladığı sonuç önceden doldurulur; dosya Excel'de açılınca formüller yeniden hesaplanır ve aynı sonucu verir.
      </div>
    </div>
  );
}
