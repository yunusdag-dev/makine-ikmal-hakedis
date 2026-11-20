import type { Tatil } from './calendar';

/**
 * İlk kurulumda yüklenen tatil listesi. Ayarlar > Tatiller ekranından düzenlenebilir.
 * Dini bayram tarihleri 2028 ve sonrası için tahminidir; Diyanet takviminden doğrulayınız.
 */
const SABIT_RT: [string, string][] = [
  ['01-01', 'Yılbaşı'],
  ['04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'],
  ['05-01', 'Emek ve Dayanışma Günü'],
  ['05-19', "Atatürk'ü Anma Gençlik ve Spor Bayramı"],
  ['07-15', 'Demokrasi ve Milli Birlik Günü'],
  ['08-30', 'Zafer Bayramı'],
  ['10-29', 'Cumhuriyet Bayramı'],
];

/** [arife, 1. gün, gün sayısı] */
const BAYRAMLAR: { yil: number; ramazan: [string, string]; kurban: [string, string] }[] = [
  { yil: 2024, ramazan: ['2024-04-09', '2024-04-10'], kurban: ['2024-06-15', '2024-06-16'] },
  { yil: 2025, ramazan: ['2025-03-29', '2025-03-30'], kurban: ['2025-06-05', '2025-06-06'] },
  { yil: 2026, ramazan: ['2026-03-19', '2026-03-20'], kurban: ['2026-05-26', '2026-05-27'] },
  { yil: 2027, ramazan: ['2027-03-08', '2027-03-09'], kurban: ['2027-05-15', '2027-05-16'] },
  { yil: 2028, ramazan: ['2028-02-25', '2028-02-26'], kurban: ['2028-05-04', '2028-05-05'] },
  { yil: 2029, ramazan: ['2029-02-13', '2029-02-14'], kurban: ['2029-04-23', '2029-04-24'] },
  { yil: 2030, ramazan: ['2030-02-03', '2030-02-04'], kurban: ['2030-04-12', '2030-04-13'] },
];

function gunEkle(t: string, n: number): string {
  const [y, m, d] = t.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

export function varsayilanTatiller(): Tatil[] {
  const out: Tatil[] = [];
  for (let y = 2024; y <= 2030; y++) {
    for (const [md, ad] of SABIT_RT) out.push({ tarih: `${y}-${md}`, tur: 'RT', ad });
    out.push({ tarih: `${y}-10-28`, tur: 'RTA', ad: 'Cumhuriyet Bayramı Arifesi' });
  }
  for (const b of BAYRAMLAR) {
    out.push({ tarih: b.ramazan[0], tur: 'DBA', ad: 'Ramazan Bayramı Arifesi' });
    for (let i = 0; i < 3; i++) out.push({ tarih: gunEkle(b.ramazan[1], i), tur: 'DB', ad: `Ramazan Bayramı ${i + 1}. Gün` });
    out.push({ tarih: b.kurban[0], tur: 'DBA', ad: 'Kurban Bayramı Arifesi' });
    for (let i = 0; i < 4; i++) out.push({ tarih: gunEkle(b.kurban[1], i), tur: 'DB', ad: `Kurban Bayramı ${i + 1}. Gün` });
  }
  return out;
}
