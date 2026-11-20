/**
 * Hızlı Ayar çubuğu: yeni yıl / yeni sözleşme dönemi için tek yerden
 *  - yüzdeli toplu zam (seçilen tutar parametrelerine),
 *  - ödeme kalemlerini aç/kapat (fazla mesai, yemek, yol, konaklama, dış görev, tatil çalışmaları)
 * uygulayıp SEÇİLEN AYDAN İTİBAREN geçerli yeni bir parametre sürümü oluşturur. Önceki aylar eski sürümle hesaplanmaya devam eder.
 */
import React, { useMemo, useState } from 'react';
import { Sliders, Percent, Check } from 'lucide-react';
import { api } from '../lib/api';
import { Alan, useIslem, useOnay } from '../ui/temel';
import { ayAdi, ayKaydir, buAy, sayi } from '../lib/bicim';
import { OZELLIKLER, OzellikAnahtari } from '../../engine/ozellik';
import { ZAM_GRUPLARI, zamUygula } from '../../engine/zam';
import type { Params } from '../../engine/params';

export default function HizliAyar({ p, kaynak, mevcutAylar, salt, bitti }: {
  p: Params; kaynak: string; mevcutAylar: string[]; salt: boolean; bitti: (yeniAy: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [yuzde, setYuzde] = useState(0);
  const [gruplar, setGruplar] = useState<string[]>(ZAM_GRUPLARI.filter((g) => g.varsayilan).map((g) => g.anahtar));
  const [oz, setOz] = useState<Params['ozellikler'] | null>(null);
  const [ay, setAy] = useState(() => ayKaydir(buAy(), 1));
  const [aciklama, setAciklama] = useState('');
  const islem = useIslem();
  const onay = useOnay();

  const ozellik = oz ?? p.ozellikler;
  const hesap = useMemo(() => {
    try { return { ...zamUygula(p, yuzde, gruplar), hata: '' }; } catch (e: any) { return { params: p, degisimler: [], hata: e.message as string }; }
  }, [p, yuzde, gruplar]);
  const ozDegisen = OZELLIKLER.filter((o) => ozellik[o.anahtar] !== p.ozellikler[o.anahtar]);
  const degisiklikVar = hesap.degisimler.length > 0 || ozDegisen.length > 0;

  const ac = () => { setOz(null); setAcik(true); };
  const uygula = async () => {
    if (hesap.hata || !degisiklikVar) return;
    if (!/^\d{4}-\d{2}$/.test(ay)) return;
    const metin = [
      yuzde ? `%${yuzde} ${yuzde > 0 ? 'zam' : 'indirim'} (${hesap.degisimler.length} kalem)` : '',
      ...ozDegisen.map((o) => `${o.ad}: ${ozellik[o.anahtar] ? 'AÇILDI' : 'KAPATILDI'}`),
    ].filter(Boolean);
    const var_ = mevcutAylar.includes(ay);
    if (!(await onay({
      baslik: `${ayAdi(ay)} itibarıyla yeni sürüm`,
      metin: `${metin.join(' · ')}\n\n${ayAdi(ay)} ve sonrası bu değerlerle hesaplanır; önceki aylar değişmez.${var_ ? `\n\nDİKKAT: ${ayAdi(ay)} için zaten bir sürüm var, üzerine yazılacak.` : ''}`,
      evet: 'Uygula', tehlike: var_,
    }))) return;
    const yeni: Params = { ...hesap.params, ozellikler: { ...ozellik } };
    const ad = aciklama.trim() || metin.join(', ');
    const r = await islem(() => api('parametreKaydet', ay, yeni, ad), `${ayAdi(ay)} itibarıyla geçerli yeni parametre sürümü oluşturuldu.`);
    if (r !== undefined || true) { setAcik(false); setYuzde(0); setAciklama(''); bitti(ay); }
  };

  if (!acik) {
    return (
      <div className="kart kart-g satir" style={{ background: 'var(--accent-soft)' }}>
        <Sliders size={18} />
        <div><b>Hızlı Ayar</b> — yeni yıl zammı ve ödeme kalemlerini aç/kapat (yemek, mesai, yol…)</div>
        <div className="bosluk" />
        <button className="btn birincil" disabled={salt} onClick={ac} title={salt ? 'Yalnız yöneticiler' : undefined}>Aç</button>
      </div>
    );
  }
  return (
    <div className="kart" style={{ borderColor: 'var(--accent)' }}>
      <div className="kart-b"><Sliders size={16} /><h3>Hızlı Ayar</h3><div className="bosluk" />
        <span className="soluk kucuk-yazi">Kaynak: {kaynak}</span>
        <button className="btn kucuk" onClick={() => setAcik(false)}>Kapat</button></div>
      <div className="kart-g izgara" style={{ gap: 16 }}>
        <div className="satir" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Alan etiket="Geçerlilik başlangıç ayı" ipucu="Bu aydan itibaren geçerli olur">
            <input type="month" className="girdi" value={ay} onChange={(e) => e.target.value && setAy(e.target.value)} />
          </Alan>
          <Alan etiket="Zam oranı (%)" ipucu="Eksi değer indirim yapar">
            <div className="satir" style={{ gap: 10, flexWrap: 'nowrap' }}>
              <input type="range" min={0} max={100} step={0.5} value={Math.min(Math.max(yuzde, 0), 100)} style={{ width: 240, accentColor: 'var(--accent)' }}
                onChange={(e) => setYuzde(Number(e.target.value))} aria-label="Zam oranı çubuğu" />
              <div style={{ position: 'relative' }}>
                <input type="number" className="girdi" step={0.5} min={-99} max={1000} style={{ width: 96, paddingRight: 24 }} value={yuzde}
                  onChange={(e) => setYuzde(e.target.value === '' ? 0 : Number(e.target.value))} aria-label="Zam oranı yüzde" />
                <Percent size={13} style={{ position: 'absolute', right: 8, top: 11, color: 'var(--muted)' }} />
              </div>
            </div>
          </Alan>
        </div>

        <div>
          <div className="bolum-baslik">Zam hangi kalemlere uygulansın?</div>
          <div className="param-izgara">
            {ZAM_GRUPLARI.map((g) => (
              <label key={g.anahtar} className="onay" title={g.aciklama} style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={gruplar.includes(g.anahtar)} onChange={(e) => setGruplar(e.target.checked ? [...gruplar, g.anahtar] : gruplar.filter((x) => x !== g.anahtar))} />
                <span><b>{g.ad}</b><br /><span className="soluk kucuk-yazi">{g.aciklama}</span></span>
              </label>
            ))}
          </div>
          <div className="soluk kucuk-yazi" style={{ marginTop: 6 }}>Yalnız TUTAR alanları değişir; vergi oranları, çarpanlar, gün sayıları ve kesintiler hiçbir zaman zamlanmaz. Sonuç kuruşa yuvarlanır.</div>
        </div>

        <div>
          <div className="bolum-baslik">Ödeme kalemleri (aç / kapat)</div>
          <div className="param-izgara">
            {OZELLIKLER.map((o) => (
              <label key={o.anahtar} className="onay" title={o.ipucu} style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={ozellik[o.anahtar]} onChange={(e) => setOz({ ...ozellik, [o.anahtar as OzellikAnahtari]: e.target.checked })} />
                <span><b>{o.ad}</b> {ozellik[o.anahtar] !== p.ozellikler[o.anahtar] && <span className="rozet uyari">{ozellik[o.anahtar] ? 'açılacak' : 'kapatılacak'}</span>}<br />
                  <span className="soluk kucuk-yazi">{ozellik[o.anahtar] ? 'Ödenir' : 'Ödenmez — hesaba katılmaz'}</span></span>
              </label>
            ))}
          </div>
          <div className="soluk kucuk-yazi" style={{ marginTop: 6 }}>Kapatılan kalemin girilmiş günlük kayıtları ve birim ücretleri SİLİNMEZ; yalnız bu dönemden itibaren hesapta sıfır sayılır. Tekrar açınca geri gelir.</div>
        </div>

        <div>
          <div className="bolum-baslik">Önizleme {hesap.degisimler.length > 0 && <span className="rozet mavi">{hesap.degisimler.length} değer değişecek</span>}</div>
          {hesap.hata && <div className="uyari-oge hata">{hesap.hata}</div>}
          {!degisiklikVar && !hesap.hata && <div className="soluk">Henüz bir değişiklik seçilmedi.</div>}
          {hesap.degisimler.length > 0 && (
            <details open={hesap.degisimler.length <= 12}>
              <summary style={{ cursor: 'pointer', marginBottom: 6 }}>Değişecek tutarlar</summary>
              <table className="tablo" style={{ maxWidth: 640 }}>
                <thead><tr><th>Kalem</th><th className="sayi">Şimdi</th><th className="sayi">Yeni</th></tr></thead>
                <tbody>{hesap.degisimler.map((d) => <tr key={d.yol}><td>{d.etiket}</td><td className="sayi">{sayi(d.eski, 2)}</td><td className="sayi kalin">{sayi(d.yeni, 2)}</td></tr>)}</tbody>
              </table>
            </details>
          )}
          {ozDegisen.length > 0 && <div style={{ marginTop: 6 }}>{ozDegisen.map((o) => <div key={o.anahtar}>• <b>{o.ad}</b>: {ozellik[o.anahtar] ? 'açılacak' : 'kapatılacak'}</div>)}</div>}
        </div>

        <div className="satir" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Alan etiket="Açıklama (isteğe bağlı)"><input className="girdi" style={{ minWidth: 360 }} value={aciklama} placeholder="ör. 2027 Ocak zammı" onChange={(e) => setAciklama(e.target.value)} /></Alan>
          <div className="bosluk" />
          <button className="btn birincil" disabled={salt || !degisiklikVar || !!hesap.hata} onClick={uygula}><Check size={15} /> {ayAdi(ay)} itibarıyla uygula</button>
        </div>
      </div>
    </div>
  );
}
