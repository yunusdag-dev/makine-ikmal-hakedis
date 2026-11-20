import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api';
import { Modal } from '../ui/temel';
import { zamanTR } from '../lib/bicim';

function farklar(once: any, sonra: any): { alan: string; once: any; sonra: any }[] {
  const out: { alan: string; once: any; sonra: any }[] = [];
  const gez = (a: any, b: any, yol: string) => {
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) gez(a[k], b[k], yol ? `${yol}.${k}` : k);
      return;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ alan: yol, once: a, sonra: b });
  };
  gez(once ?? {}, sonra ?? {}, '');
  return out;
}

export default function Kayitlar() {
  const [arama, setArama] = useState('');
  const [liste, setListe] = useState<any[]>([]);
  const [detay, setDetay] = useState<any>(null);
  const [limit, setLimit] = useState(300);
  useEffect(() => {
    const t = setTimeout(() => api<any[]>('kayitlar', { arama, limit }).then(setListe), 200);
    return () => clearTimeout(t);
  }, [arama, limit]);
  const ac = async (id: number) => {
    const r = await api<any>('kayitDetay', id);
    setDetay({ ...r, once: r.once ? JSON.parse(r.once) : null, sonra: r.sonra ? JSON.parse(r.sonra) : null });
  };
  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="satir">
        <div style={{ position: 'relative', width: 380 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
          <input className="girdi" style={{ paddingLeft: 32 }} placeholder="Kullanıcı, işlem, sürücü, plaka ara…" value={arama} onChange={(e) => setArama(e.target.value)} />
        </div>
        <div className="bosluk" />
        <span className="soluk">Kim, ne zaman, neyi değiştirdi — tüm değişiklikler kalıcı olarak kaydedilir.</span>
      </div>
      <div className="kart tablo-sar" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        <table className="tablo">
          <thead><tr><th>Zaman</th><th>Kullanıcı</th><th>Makine</th><th>İşlem</th><th>Kayıt türü</th><th>Özet</th></tr></thead>
          <tbody>
            {liste.map((k) => (
              <tr key={k.id} className="tikla" onClick={() => ac(k.id)}>
                <td>{zamanTR(k.zaman)}</td><td className="kalin">{k.kullanici}</td><td className="soluk">{k.makine}</td>
                <td><span className="rozet mavi">{k.islem}</span></td><td>{k.varlik}</td>
                <td style={{ maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis' }} title={k.ozet}>{k.ozet}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {liste.length >= limit && <div style={{ padding: 10, textAlign: 'center' }}><button className="btn kucuk" onClick={() => setLimit(limit + 500)}>Daha fazla yükle</button></div>}
      </div>
      {detay && (
        <Modal baslik={`${detay.islem} — ${detay.varlik}`} kapat={() => setDetay(null)} boyut="genis">
          <div className="soluk" style={{ marginBottom: 10 }}>{zamanTR(detay.zaman)} · {detay.kullanici} ({detay.makine}) · {detay.ozet}</div>
          {(detay.once || detay.sonra) ? (
            <table className="tablo">
              <thead><tr><th>Alan</th><th>Önce</th><th>Sonra</th></tr></thead>
              <tbody>
                {farklar(detay.once, detay.sonra).slice(0, 300).map((f) => (
                  <tr key={f.alan}><td className="kalin">{f.alan}</td>
                    <td style={{ whiteSpace: 'pre-wrap', color: 'var(--err)' }}>{f.once === undefined ? '—' : typeof f.once === 'object' ? JSON.stringify(f.once) : String(f.once)}</td>
                    <td style={{ whiteSpace: 'pre-wrap', color: 'var(--ok)' }}>{f.sonra === undefined ? '—' : typeof f.sonra === 'object' ? JSON.stringify(f.sonra) : String(f.sonra)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <div className="soluk">Bu işlem için ayrıntı kaydı yok.</div>}
        </Modal>
      )}
    </div>
  );
}
