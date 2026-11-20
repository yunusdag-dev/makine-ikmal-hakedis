/** Uygulama durumu: oturum, seçili ay, dönem verisi, hesap sonucu ve diğer kullanıcıların değişikliklerinin takibi */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { buAy } from './bicim';
import { DonemSonucu, DonemVerisi, donemHesapla } from '../../engine/donem';
import { useBildirim } from '../ui/temel';

export type Rol = 'yonetici' | 'kullanici' | 'izleyici';
export interface Oturum {
  kullanici: string;
  kullaniciId: number | null;
  rol: Rol;
  dosya: string;
  saltOkunur: boolean;
  makine: string;
  sonKayit: string | null;
}
export interface AcikOturum { kullanici: string; makine: string; baslangic: string; son: string; ben: boolean }

export const ROL_AD: Record<Rol, string> = { yonetici: 'Yönetici', kullanici: 'Kullanıcı', izleyici: 'İzleyici (salt okunur)' };

interface Baglam {
  oturum: Oturum;
  yonetici: boolean;
  ay: string;
  setAy: (a: string) => void;
  veri: DonemVerisi | null;
  sonuc: DonemSonucu | null;
  kapali: boolean;
  yukleniyor: boolean;
  yenile: () => Promise<void>;
  surum: number;
  /** Başka bir kullanıcının değişikliği algılandığında artar */
  disDegisiklik: number;
  acikOturumlar: AcikOturum[];
  cikis: () => void;
}

const Ctx = createContext<Baglam | null>(null);

export function BaglamSaglayici({ oturum, cikis, children }: { oturum: Oturum; cikis: () => void; children: React.ReactNode }) {
  const [ay, setAyState] = useState<string>(() => localStorage.getItem('ay') ?? buAy());
  const [veri, setVeri] = useState<DonemVerisi | null>(null);
  const [kapali, setKapali] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [surum, setSurum] = useState(0);
  const [disDegisiklik, setDisDegisiklik] = useState(0);
  const [acikOturumlar, setAcikOturumlar] = useState<AcikOturum[]>([]);
  const sira = useRef(0);
  const dbSurum = useRef<number | null>(null);
  const bildir = useBildirim();

  const yenile = useCallback(async () => {
    const no = ++sira.current;
    setYukleniyor(true);
    try {
      const [v, d] = await Promise.all([api<DonemVerisi>('donemVerisi', ay), api<any>('donemDurumu', ay)]);
      if (no !== sira.current) return;
      setVeri(v);
      setKapali(d?.durum === 'kapali');
      setSurum((s) => s + 1);
    } finally {
      if (no === sira.current) setYukleniyor(false);
    }
  }, [ay]);

  useEffect(() => { yenile(); }, [yenile]);

  // Diğer kullanıcıların değişikliklerini yokla (4 sn)
  useEffect(() => {
    let iptal = false;
    const yokla = async () => {
      try {
        const b = await api<{ surum: number; kim: string; ben: boolean; oturumlar: AcikOturum[] }>('surumBilgisi');
        if (iptal) return;
        setAcikOturumlar(b.oturumlar);
        if (dbSurum.current != null && b.surum !== dbSurum.current) {
          if (!b.ben) {
            setDisDegisiklik((x) => x + 1);
            yenile();
            if (document.visibilityState === 'visible') bildir('bilgi', `${b.kim || 'Başka bir kullanıcı'} veriyi güncelledi; ekran yenilendi.`);
          } else {
            // kendi kaydımız — ekranlar zaten güncel
          }
        }
        dbSurum.current = b.surum;
      } catch { /* oturum kapanmış olabilir */ }
    };
    yokla();
    // Pencere simge durumundayken / gizliyken yoklama yapılmaz; görünür olunca hemen bir kez yoklanır
    const t = setInterval(() => { if (document.visibilityState === 'visible') yokla(); }, 5000);
    const gorunur = () => { if (document.visibilityState === 'visible') yokla(); };
    document.addEventListener('visibilitychange', gorunur);
    return () => { iptal = true; clearInterval(t); document.removeEventListener('visibilitychange', gorunur); };
  }, [yenile, bildir]);

  const setAy = useCallback((a: string) => { localStorage.setItem('ay', a); setAyState(a); }, []);
  const sonuc = useMemo(() => {
    if (!veri) return null;
    try { return donemHesapla(veri); } catch (e) { console.error(e); return null; }
  }, [veri]);
  // Ay değişti ama yeni ayın verisi henüz gelmediyse eski ayın rakamları gösterilmesin
  const guncel = !!veri && veri.ay === ay;

  // Ctrl+← / Ctrl+→ ile ay değiştir
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const [y, m] = ay.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1 + (e.key === 'ArrowLeft' ? -1 : 1), 1));
        setAy(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ay, setAy]);

  return (
    <Ctx.Provider value={{ oturum, yonetici: oturum.rol === 'yonetici', ay, setAy, veri: guncel ? veri : null, sonuc: guncel ? sonuc : null, kapali, yukleniyor, yenile, surum, disDegisiklik, acikOturumlar, cikis }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBaglam() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Bağlam yok');
  return c;
}
