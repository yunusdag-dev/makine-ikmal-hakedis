import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { ayAdi, ayKaydir, sayi, sayiOku } from '../lib/bicim';

// ------------------------------------------------------------ bildirimler
type Bildirim = { id: number; tur: 'ok' | 'hata' | 'bilgi'; metin: string; eylemler?: { ad: string; fn: () => void }[] };
const BildirimCtx = createContext<{ bildir: (tur: Bildirim['tur'], metin: string, eylemler?: Bildirim['eylemler']) => void }>({ bildir: () => {} });

export function BildirimSaglayici({ children }: { children: React.ReactNode }) {
  const [liste, setListe] = useState<Bildirim[]>([]);
  const bildir = useCallback((tur: Bildirim['tur'], metin: string, eylemler?: Bildirim['eylemler']) => {
    const id = Date.now() + Math.random();
    setListe((l) => [...l, { id, tur, metin, eylemler }]);
    setTimeout(() => setListe((l) => l.filter((x) => x.id !== id)), tur === 'hata' ? 9000 : eylemler ? 9000 : 3500);
  }, []);
  return (
    <BildirimCtx.Provider value={{ bildir }}>
      {children}
      <div className="bildirimler">
        {liste.map((b) => (
          <div key={b.id} className={`bildirim ${b.tur}`}>
            {b.tur === 'ok' ? <CheckCircle2 size={18} /> : b.tur === 'hata' ? <AlertTriangle size={18} /> : <Info size={18} />}
            <div style={{ flex: 1 }}>{b.metin}</div>
            {b.eylemler && (
              <div className="eylem">
                {b.eylemler.map((e) => <button key={e.ad} onClick={e.fn}>{e.ad}</button>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </BildirimCtx.Provider>
  );
}
export const useBildirim = () => useContext(BildirimCtx).bildir;

/** async işlemi çalıştırır, hatayı bildirir */
export function useIslem() {
  const bildir = useBildirim();
  return useCallback(async <T,>(fn: () => Promise<T>, basari?: string): Promise<T | undefined> => {
    try {
      const r = await fn();
      if (basari) bildir('ok', basari);
      return r;
    } catch (e: any) {
      bildir('hata', e?.message ?? String(e));
      return undefined;
    }
  }, [bildir]);
}

// ------------------------------------------------------------ modal
export function Modal(props: { baslik: React.ReactNode; kapat: () => void; children: React.ReactNode; alt?: React.ReactNode; boyut?: 'genis' | 'cok-genis'; ikon?: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); props.kapat(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [props.kapat]);
  return (
    <div className="ortu" onMouseDown={(e) => { if (e.target === e.currentTarget) props.kapat(); }}>
      <div className={`modal ${props.boyut ?? ''}`} role="dialog">
        <div className="modal-b">
          {props.ikon}
          <h2>{props.baslik}</h2>
          <div className="bosluk" />
          <button className="btn ikon hayalet" onClick={props.kapat} title="Kapat (Esc)"><X size={18} /></button>
        </div>
        <div className="modal-g">{props.children}</div>
        {props.alt && <div className="modal-a">{props.alt}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ onay
type OnayOpts = { baslik: string; metin: React.ReactNode; evet?: string; hayir?: string; tehlike?: boolean };
const OnayCtx = createContext<(o: OnayOpts) => Promise<boolean>>(async () => false);
export function OnaySaglayici({ children }: { children: React.ReactNode }) {
  const [aktif, setAktif] = useState<(OnayOpts & { coz: (b: boolean) => void }) | null>(null);
  const sor = useCallback((o: OnayOpts) => new Promise<boolean>((coz) => setAktif({ ...o, coz })), []);
  const bitir = (b: boolean) => { aktif?.coz(b); setAktif(null); };
  return (
    <OnayCtx.Provider value={sor}>
      {children}
      {aktif && (
        <Modal baslik={aktif.baslik} kapat={() => bitir(false)} ikon={<AlertTriangle size={20} color={aktif.tehlike ? 'var(--err)' : 'var(--warn)'} />}
          alt={<>
            <button className="btn" onClick={() => bitir(false)}>{aktif.hayir ?? 'Vazgeç'}</button>
            <button className={`btn ${aktif.tehlike ? 'tehlike dolu' : 'birincil'}`} autoFocus onClick={() => bitir(true)}>{aktif.evet ?? 'Tamam'}</button>
          </>}>
          <div style={{ whiteSpace: 'pre-line', lineHeight: 1.55 }}>{aktif.metin}</div>
        </Modal>
      )}
    </OnayCtx.Provider>
  );
}
export const useOnay = () => useContext(OnayCtx);

// ------------------------------------------------------------ alanlar
export function Alan(p: { etiket: React.ReactNode; ipucu?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="alan" style={p.style}>
      <label>{p.etiket}</label>
      {p.children}
      {p.ipucu && <div className="ipucu">{p.ipucu}</div>}
    </div>
  );
}

/** Türkçe ondalık destekli sayı girişi. Boş bırakılırsa null döner. */
export function SayiGirdi(p: {
  deger: number | null | undefined; degis: (v: number | null) => void; ondalik?: number; yerTutucu?: string; className?: string;
  otomatik?: boolean; disabled?: boolean; autoFocus?: boolean; onBlur?: () => void; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; title?: string;
}) {
  const [metin, setMetin] = useState(p.deger == null ? '' : sayi(p.deger, p.ondalik ?? 6));
  const odak = useRef(false);
  useEffect(() => { if (!odak.current) setMetin(p.deger == null ? '' : sayi(p.deger, p.ondalik ?? 6)); }, [p.deger, p.ondalik]);
  return (
    <input
      className={`${p.className ?? 'girdi sayi'} ${p.otomatik && p.deger == null ? 'oto' : ''}`}
      value={metin}
      placeholder={p.yerTutucu}
      disabled={p.disabled}
      autoFocus={p.autoFocus}
      title={p.title}
      inputMode="decimal"
      onFocus={(e) => { odak.current = true; setMetin(p.deger == null ? '' : String(p.deger).replace('.', ',')); setTimeout(() => e.target.select(), 0); }}
      onChange={(e) => setMetin(e.target.value)}
      onBlur={() => {
        odak.current = false;
        const v = sayiOku(metin);
        if (metin.trim() !== '' && v === null) { setMetin(p.deger == null ? '' : sayi(p.deger, p.ondalik ?? 6)); return; }
        if (v !== (p.deger ?? null)) p.degis(v);
        setMetin(v == null ? '' : sayi(v, p.ondalik ?? 6));
        p.onBlur?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setMetin(p.deger == null ? '' : String(p.deger)); }
        p.onKeyDown?.(e);
      }}
    />
  );
}

export function AySecici({ ay, setAy, kapali }: { ay: string; setAy: (a: string) => void; kapali?: boolean }) {
  return (
    <div className="satir" style={{ gap: 8 }}>
      <div className="ay-secici">
        <button onClick={() => setAy(ayKaydir(ay, -1))} title="Önceki ay (Ctrl+←)"><ChevronLeft size={16} /></button>
        <input
          type="month"
          value={ay}
          onChange={(e) => e.target.value && setAy(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
          id="ay-girdi"
        />
        <div className="ay-ad" onClick={() => (document.getElementById('ay-girdi') as HTMLInputElement)?.showPicker?.()} style={{ cursor: 'pointer' }}>{ayAdi(ay)}</div>
        <button onClick={() => setAy(ayKaydir(ay, 1))} title="Sonraki ay (Ctrl+→)"><ChevronRight size={16} /></button>
      </div>
      {kapali && <span className="rozet-kapali"><Lock size={12} /> Dönem kapalı</span>}
    </div>
  );
}

export function BosDurum({ ikon, baslik, metin, children }: { ikon?: React.ReactNode; baslik: string; metin?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="bos-durum">
      {ikon}
      <h3>{baslik}</h3>
      {metin && <div>{metin}</div>}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

export function Metrik({ etiket, deger, alt, ikon }: { etiket: string; deger: React.ReactNode; alt?: React.ReactNode; ikon?: React.ReactNode }) {
  return (
    <div className="kart metrik">
      <div className="e">{ikon}{etiket}</div>
      <div className="d">{deger}</div>
      {alt && <div className="a">{alt}</div>}
    </div>
  );
}
