/**
 * Çoklu ad girişi (görevli personel, gidilen yer): her ad bir etiket olarak eklenir, yazarken ortak listeden öneri çıkar.
 * Değer "Ali Veli; Ayşe Kaya" biçiminde tek metindir. Aynı ad farklı yazımla eklenirse listedeki yazım kullanılır;
 * listedeki bir ada çok benzer yeni ad yazılırsa kullanıcıya sorulur.
 */
import React, { useId, useState } from 'react';
import { X } from 'lucide-react';
import { adlaraBol, benzerAd } from '../../engine/ad';

export default function CokluSecim({ deger, degis, oneriler, disabled, yerTutucu }: {
  deger: string; degis: (v: string) => void; oneriler: string[]; disabled?: boolean; yerTutucu?: string;
}) {
  const [yazi, setYazi] = useState('');
  const listeId = useId();
  const adlar = adlaraBol(deger);

  const ekle = (ham: string) => {
    const hepsi = adlaraBol(ham);
    if (!hepsi.length) { setYazi(''); return; }
    let sonuc = [...adlar];
    for (const ad of hepsi) {
      let kullan = ad;
      const b = benzerAd(ad, oneriler);
      if (b?.tur === 'ayni') kullan = b.ad;
      else if (b?.tur === 'benzer' && window.confirm(`"${ad}" listedeki "${b.ad}" adına çok benziyor.\n\n"${b.ad}" kullanılsın mı?\n(İptal: "${ad}" yeni kayıt olarak eklenir)`)) kullan = b.ad;
      sonuc = adlaraBol([...sonuc, kullan].join('; '));
    }
    degis(sonuc.join('; '));
    setYazi('');
  };

  return (
    <div className={`coklu ${disabled ? 'pasif' : ''}`}>
      {adlar.map((a) => (
        <span key={a} className="coklu-etiket">
          {a}
          {!disabled && <button type="button" aria-label={`${a} kaldır`} onClick={() => degis(adlar.filter((x) => x !== a).join('; '))}><X size={12} /></button>}
        </span>
      ))}
      <input
        className="coklu-girdi" list={listeId} disabled={disabled} value={yazi} placeholder={adlar.length ? '' : yerTutucu}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(';')) ekle(v); else setYazi(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && yazi.trim()) { e.preventDefault(); e.stopPropagation(); ekle(yazi); }
          else if (e.key === 'Backspace' && !yazi && adlar.length) degis(adlar.slice(0, -1).join('; '));
        }}
        onBlur={() => { if (yazi.trim()) ekle(yazi); }}
      />
      <datalist id={listeId}>{oneriler.filter((o) => !adlar.includes(o)).map((o) => <option key={o} value={o} />)}</datalist>
    </div>
  );
}
