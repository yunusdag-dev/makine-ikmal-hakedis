/**
 * Görev saatlerinden fazla mesai ve çakışma hesapları (saf fonksiyonlar; arayüz, sunucu ve testler aynısını kullanır).
 *
 * Kural: Bir görevin 18:00'dan (ayarlanabilir) sonraki süresi fazla mesaidir.
 *  - Bitiş saati başlangıçtan küçükse görev gece yarısını geçmiş, ertesi güne sarkmış sayılır (22:00 → 05:00 = 7 saat).
 *  - Tam saatler aynen sayılır; artan dakika için yuvarlama kuralı seçilebilir:
 *      'oto'    : artan dakika "yukariDk" değerinden BÜYÜKSE (varsayılan 45) bir saat daha eklenir, değilse atılır
 *      'yukari' : artan dakika varsa her zaman bir saat daha eklenir
 *      'asagi'  : artan dakika atılır (yalnız tam saatler)
 *      'elle'   : saatlerden hesaplanmaz, girilen değer aynen kullanılır
 */
export type MesaiMod = 'oto' | 'asagi' | 'yukari' | 'elle';

export const MESAI_MODLARI: { d: MesaiMod; ad: string; ipucu: string }[] = [
  { d: 'oto', ad: 'Otomatik', ipucu: 'Artan dakika 45\'i aşarsa bir saat daha eklenir' },
  { d: 'yukari', ad: 'Yukarı', ipucu: 'Artan dakika varsa bir saat daha eklenir' },
  { d: 'asagi', ad: 'Aşağı', ipucu: 'Yalnız tam saatler sayılır' },
  { d: 'elle', ad: 'Elle', ipucu: 'Saatler yerine girdiğiniz değer kullanılır' },
];

export interface MesaiKurali {
  /** Fazla mesainin başladığı saat (dakika olarak; 18:00 = 1080) */
  baslangicDk: number;
  /** "oto" modunda artan dakikanın bundan büyük olması gerekir */
  yukariDk: number;
}
export const VARSAYILAN_MESAI_KURALI: MesaiKurali = { baslangicDk: 18 * 60, yukariDk: 45 };

/** "08:30" → dakika; geçersizse null */
export function saatDk(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? ''));
  if (!m) return null;
  const h = Number(m[1]), d = Number(m[2]);
  if (h > 23 || d > 59) return null;
  return h * 60 + d;
}

/** Görevin [başlangıç, bitiş] aralığı (gün başından itibaren dakika). Bitiş başlangıçtan küçükse ertesi güne sarkar. Eşitse geçersiz. */
export function gorevAraligi(cikis: string, donus: string): [number, number] | null {
  const a = saatDk(cikis), b = saatDk(donus);
  if (a == null || b == null || a === b) return null;
  return [a, b < a ? b + 1440 : b];
}

/** Görev süresi (saat) */
export function gorevSuresi(cikis: string, donus: string): number {
  const r = gorevAraligi(cikis, donus);
  return r ? (r[1] - r[0]) / 60 : 0;
}

/** Saatlerden fazla mesai (saat). Saat bilgisi eksik/geçersizse null. 'elle' modunda null döner (değer elle girilir). */
export function gorevMesai(cikis: string, donus: string, mod: MesaiMod = 'oto', k: MesaiKurali = VARSAYILAN_MESAI_KURALI): number | null {
  if (mod === 'elle') return null;
  const r = gorevAraligi(cikis, donus);
  if (!r) return null;
  const dk = Math.max(0, r[1] - Math.max(r[0], k.baslangicDk));
  const tam = Math.floor(dk / 60);
  const kalan = dk % 60;
  if (mod === 'asagi') return tam;
  if (mod === 'yukari') return tam + (kalan > 0 ? 1 : 0);
  return tam + (kalan > k.yukariDk ? 1 : 0);
}

/** Aynı günün görevleri arasında saat çakışması var mı? Çakışan ilk iki görevin (0 tabanlı) sıra numaralarını döner. */
export function gorevCakismasi(gorevler: { cikis_saat: string; donus_saat: string }[]): [number, number] | null {
  const aralik = gorevler
    .map((g, i) => ({ i, r: gorevAraligi(g.cikis_saat, g.donus_saat) }))
    .filter((x): x is { i: number; r: [number, number] } => x.r != null)
    .sort((x, y) => x.r[0] - y.r[0]);
  for (let j = 1; j < aralik.length; j++) {
    if (aralik[j].r[0] < aralik[j - 1].r[1]) return [aralik[j - 1].i, aralik[j].i].sort((a, b) => a - b) as [number, number];
  }
  return null;
}

/** "18:00" → dakika (kural parametresi için) */
export function kuralHazirla(baslangic: string | undefined, yukariDk: number | undefined): MesaiKurali {
  return { baslangicDk: saatDk(baslangic) ?? VARSAYILAN_MESAI_KURALI.baslangicDk, yukariDk: yukariDk ?? VARSAYILAN_MESAI_KURALI.yukariDk };
}
