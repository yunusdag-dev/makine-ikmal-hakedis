/** Sürücü günlük durum kodları (Excel EK-4 lejantı) */
export type Durum = '' | '0' | 'X' | 'B' | 'R' | 'Sİ' | 'Üİ' | 'Mİ' | 'İİ';

export const DURUM_ETIKET: Record<Exclude<Durum, ''>, string> = {
  '0': 'Çalışmadı',
  X: 'Çalışma günü',
  B: 'Ulusal bayram / genel tatil',
  R: 'Raporlu / istirahatli',
  'Sİ': 'Senelik ücretli izin',
  'Üİ': 'Ücretsiz izin',
  'Mİ': 'Mazeret izni',
  'İİ': 'İdari izin',
};

export type UcretGrubu = 'surucu' | 'operator';

/** Sürücüye yazılan günlük kayıt (tarih + sürücü) */
export interface SurucuGun {
  driverId: number;
  tarih: string; // YYYY-MM-DD
  durum: Durum;
  fazlaMesai: number; // saat
  haftaTatili: boolean;
  resmiTatil: number; // 0, 0.5, 1
  /** 0 = yok, 0.66 = kısmi (2/3 mesai), 1 = tam (X) */
  disGorev: number;
  konaklama: boolean;
  /** null = otomatik kural, true/false = elle */
  yemekOverride: boolean | null;
  yolOverride: boolean | null;
}

/** Araca yazılan günlük kayıt (tarih + sürücü + araç) */
export interface AracSefer {
  driverId: number | null;
  vehicleId: number;
  tarih: string;
  kmCikis: number | null;
  kmDonus: number | null;
  /** Araç çalışma iş günü (İG) */
  aracIG: boolean;
  /** Araç çalışma iş günü dışı (İGD): 0, 0.5, 1 */
  aracIGD: number;
}

export interface SurucuKart {
  id: number;
  adSoyad: string;
  varsayilanAracId: number | null;
  ucretGrubu: UcretGrubu;
  emekli: boolean;
  /** Sürücü genel olarak yol ücreti alır mı (gün bazında değiştirilebilir) */
  yolHakki: boolean;
  sira: number;
  aktif: boolean;
}

export interface AracKart {
  id: number;
  plaka: string;
  markaModel: string;
  modelYili: number | null;
  aracTipi: string;
  gorevYeri: string;
  tuketimOrani: number; // lt/km
  kiraBedeli: number;
  yakitYansitmaCarpani: number; // varsayılan 1
  sira: number;
  aktif: boolean;
}
