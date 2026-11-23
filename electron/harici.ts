import type { Store } from './store';

/**
 * Harici km: aynı aracın bir önceki kaydının çıkış (bitiş) KM'si ile yeni kaydın giriş (başlangıç) KM'si arasındaki fark.
 * İlk kayıt için hesaplanmaz; fark negatifse (yeni giriş önceki çıkıştan küçükse) yazılmaz (null).
 * Ödeme hesabını etkilemez, yalnız kaydedilir ve raporlanır. Araç zincirinin tamamı (tarih, görev sırası) sırasıyla yeniden hesaplanır;
 * böylece geçmiş bir kayıt düzenlenince sonraki günün değeri de güncellenir.
 * aracIdler verilmezse tüm araçlar yenilenir.
 */
export function hariciYenile(s: Store, aracIdler?: Iterable<number>) {
  const idler = aracIdler ? [...aracIdler] : s.all<{ id: number }>('SELECT id FROM araclar').map((x) => x.id);
  for (const aid of idler) {
    const rows = s.all<any>('SELECT id, km_cikis, km_donus, harici_km FROM seferler WHERE arac_id=? ORDER BY tarih, sira, id', [aid]);
    let onceki: number | null = null;
    for (const r of rows) {
      let h: number | null = null;
      if (r.km_cikis != null && onceki != null) {
        const f = Math.round((r.km_cikis - onceki) * 100) / 100;
        if (f >= 0) h = f;
      }
      if ((r.harici_km ?? null) !== h) s.run('UPDATE seferler SET harici_km=? WHERE id=?', [h, r.id]);
      if (r.km_donus != null) onceki = r.km_donus;
      else if (r.km_cikis != null) onceki = r.km_cikis;
    }
  }
}
