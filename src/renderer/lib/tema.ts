/** Renk temaları: yalnız bu bilgisayarın tarayıcı deposunda tutulur (kullanıcıya göre değil, bilgisayara göre). */
export const TEMALAR = [
  { id: 'mavi', ad: 'Mavi', renk: '#1f6feb', yan: '#0f1f3d' },
  { id: 'yesil', ad: 'Yeşil', renk: '#079669', yan: '#0b2a20' },
  { id: 'mor', ad: 'Mor', renk: '#7c22e0', yan: '#1f0f3a' },
  { id: 'turuncu', ad: 'Turuncu', renk: '#c94f00', yan: '#33180a' },
  { id: 'kirmizi', ad: 'Kırmızı', renk: '#d4141c', yan: '#34090c' },
  { id: 'grafit', ad: 'Grafit', renk: '#3f4d63', yan: '#14171c' },
] as const;

const ANAHTAR = 'hakedis-tema';

export function temaOku(): string {
  try { const t = localStorage.getItem(ANAHTAR); if (t && TEMALAR.some((x) => x.id === t)) return t; } catch { /* depo yoksa varsayılan */ }
  return 'mavi';
}

export function temaUygula(id: string) {
  document.documentElement.setAttribute('data-tema', id);
  try { localStorage.setItem(ANAHTAR, id); } catch { /* kaydedilemezse bu oturumda geçerli kalır */ }
}

// Sayfa açılır açılmaz (giriş ekranı dahil) kayıtlı tema uygulanır
document.documentElement.setAttribute('data-tema', temaOku());
