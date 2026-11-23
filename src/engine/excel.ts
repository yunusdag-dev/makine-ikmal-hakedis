/**
 * Excel ile birebir sayısal davranış yardımcıları.
 * Excel ROUND: ondalık gösterim üzerinden "yarım -> sıfırdan uzağa" yuvarlar ve
 * 15 anlamlı basamak hassasiyetiyle çalışır (ör. ROUND(1.005;2)=1.01).
 */
export function xround(x: number, digits = 0): number {
  if (!Number.isFinite(x)) return x;
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const a = Number(Math.abs(x).toPrecision(15));
  const f = Math.pow(10, digits);
  const scaled = Number((a * f).toPrecision(15));
  const r = Math.floor(scaled + 0.5) / f;
  return sign * r;
}

/** Excel SUM: soldan sağa toplama (kayan nokta sırası korunur). */
export function xsum(values: Array<number | null | undefined>): number {
  let s = 0;
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) s += v;
  return s;
}

/** Ayın gün sayısı (ay: 1-12). */
export function ayGunSayisi(yil: number, ay: number): number {
  return new Date(Date.UTC(yil, ay, 0)).getUTCDate();
}

/** 'YYYY-MM' -> {yil, ay} */
export function parseAy(ay: string): { yil: number; ay: number } {
  const [y, m] = ay.split('-').map(Number);
  return { yil: y, ay: m };
}

export function tarihStr(yil: number, ay: number, gun: number): string {
  return `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;
}

export const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
