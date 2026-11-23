import { kopru, coz } from './api';
import { dosyaAdiAy } from './bicim';

export type CiktiTur = 'firma' | 'kurum' | 'surucuFaaliyet' | 'aracFaaliyet' | 'bordro' | 'onTablo' | 'plakaExcel' | 'plakaPdf';

const ADLAR: Record<CiktiTur, string> = {
  firma: 'Hakedis', kurum: 'Kurum_Puantaj', surucuFaaliyet: 'Surucu_Faaliyet', aracFaaliyet: 'Arac_Faaliyet',
  bordro: 'Bordro_Tutar', onTablo: 'On_Tablo', plakaExcel: 'Plaka_Formlari', plakaPdf: 'Plaka_Formlari',
};

/** Kaydetme yeri sorar, çıktıyı üretir. Başarılıysa dosya yolunu döner. */
export async function ciktiAl(
  bildir: (t: 'ok' | 'hata' | 'bilgi', m: string, e?: { ad: string; fn: () => void }[]) => void,
  tur: CiktiTur, ay: string, opts: { indeksler?: number[]; ek?: string } = {},
): Promise<string | null> {
  const pdf = tur === 'plakaPdf';
  const ad = `${ADLAR[tur]}${opts.ek ? '_' + opts.ek.replace(/\s+/g, '') : ''}_${dosyaAdiAy(ay)}.${pdf ? 'pdf' : 'xlsx'}`;
  try {
    const hedef = coz(await kopru.dosyaSec({
      baslik: 'Çıktıyı kaydet', kaydet: true, varsayilan: ad,
      filtre: pdf ? [{ name: 'PDF', extensions: ['pdf'] }] : [{ name: 'Excel çalışma kitabı', extensions: ['xlsx'] }],
    }));
    if (!hedef) return null;
    bildir('bilgi', 'Çıktı hazırlanıyor…');
    const yol = coz(await kopru.cikti({ tur, ay, hedef, indeksler: opts.indeksler }));
    bildir('ok', `Kaydedildi: ${yol.split(/[\/]/).pop()}`, [
      { ad: 'Aç', fn: () => kopru.dosyaAc(yol) },
      { ad: 'Klasörde göster', fn: () => kopru.klasordeGoster(yol) },
    ]);
    return yol;
  } catch (e: any) {
    bildir('hata', e.message);
    return null;
  }
}
