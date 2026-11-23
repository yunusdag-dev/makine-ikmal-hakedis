/** Görevli personel ve görev yeri adları: karşılaştırma, bölme ve benzerlik (arayüz ve sunucu aynısını kullanır) */

/** Ad karşılaştırması için: küçük harf, Türkçe karakterler sadeleştirilir, boşluklar tek boşluğa indirilir ("Çağlar  Ünal" = "caglar unal") */
export function adNorm(s: string): string {
  return String(s ?? '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ').trim();
}

/** "Ali Veli; Ayşe Kaya" → ['Ali Veli', 'Ayşe Kaya'] (boşlar ve aynı kişinin tekrarı atılır) */
export function adlaraBol(s: string): string[] {
  const gorulen = new Set<string>();
  const out: string[] = [];
  for (const parca of String(s ?? '').split(/[;\n]/)) {
    const ad = parca.replace(/\s+/g, ' ').trim();
    const n = adNorm(ad);
    if (!n || gorulen.has(n)) continue;
    gorulen.add(n);
    out.push(ad);
  }
  return out;
}

/** Düzenleme uzaklığı (Levenshtein) */
export function uzaklik(a: string, b: string): number {
  if (a === b) return 0;
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let onceki = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, onceki + (a[i - 1] === b[j - 1] ? 0 : 1));
      onceki = tmp;
    }
  }
  return d[b.length];
}

/** Yeni yazılan ad listedeki bir adla aynı mı (yazım farkıyla) ya da çok mu benziyor? */
export function benzerAd(yeni: string, liste: string[]): { tur: 'ayni' | 'benzer'; ad: string } | null {
  const n = adNorm(yeni);
  if (!n) return null;
  for (const o of liste) if (adNorm(o) === n) return { tur: 'ayni', ad: o };
  if (n.length < 5) return null;
  for (const o of liste) {
    const m = adNorm(o);
    if (m.length >= 5 && uzaklik(n, m) <= 1) return { tur: 'benzer', ad: o };
  }
  return null;
}
