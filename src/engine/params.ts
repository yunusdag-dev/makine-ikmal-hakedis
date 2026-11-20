/**
 * Dönem bazlı parametreler. Hiçbir sabit hesap kodunun içine gömülmez;
 * tamamı buradaki yapı üzerinden Ayarlar ekranından yönetilir ve
 * "geçerlilik başlangıç ayı" ile saklanır (eski aylar eski parametreyle hesaplanır).
 *
 * Varsayılan değerler: Ağustos 2026 örnek dosyalarından alınmıştır (RULES.md bölüm 5).
 */

export interface UcretTablosu {
  /** Aylık brüt ücret (Excel: 75233.62) */
  ucretBrut: number;
  /** Ücretten düşülen tutar (Excel formül içi sabit: 771.63) */
  ucretKesinti: number;
  /** Resmi ve genel tatil çalışma ücreti (gün) */
  resmiTatil: number;
  /** Hafta tatili çalışma ücreti (saat) */
  haftaTatili: number;
  /** Fazla çalışma ücreti (saat) */
  fazlaCalisma: number;
  /** Konaklama ücreti (gün) */
  konaklama: number;
  /** Dış görev ücreti (gün) */
  disGorev: number;
  /** Yemek ücreti (gün, işveren payı dahil) */
  yemek: number;
  /** Yol ücreti (gün, işveren payı dahil) */
  yol: number;
}

export interface GvDilimi {
  /** Dilim üst sınırı (kümülatif matrah). null = sınırsız */
  ust: number | null;
  oran: number;
}

export interface Imzaci {
  ad: string;
  unvan: string;
}

/** Ödeme kalemi anahtarları: false = bu dönem için kalem kapalı (hesaba katılmaz; saklanan ücretler silinmez) */
export interface Ozellikler {
  fazlaMesai: boolean;
  haftaTatili: boolean;
  resmiTatil: boolean;
  disGorev: boolean;
  konaklama: boolean;
  yemek: boolean;
  yol: boolean;
}

export interface Params {
  ozellikler: Ozellikler;
  takvim: {
    /** 'Seçim' anahtarı: true = Cumartesi iş günü sayılır (Seçim=1), false = sayılmaz (Seçim=2) */
    cumartesiIsGunu: boolean;
    /** İş günü ağırlıkları (Excel 'iş günü'!V12:W17) */
    agirlikRTA: number;
    agirlikDBA: number;
  };
  puantaj: {
    /** Hafta tatili günü -> mesai saati çarpanı (7.5) */
    haftaTatiliSaat: number;
    /** Kısmi dış görev değeri (2/3 mesai = 0.66) */
    disGorevKismi: number;
  };
  kurum: {
    kurumAdi: string;
    bolgeAdi: string;
    firmaAdi: string;
    firmaKisaAdi: string;
    firmaAdresi: string;
  };
  sozlesme: {
    ihaleTarihi: string;
    sozlesmeTarihi: string;
    iseBaslamaTarihi: string;
    gunlukCalismaSaati: number;
    yakitCinsi: string;
  };
  /** Plaka formu imzacıları: Kontrol, Üye, Üye */
  imzacilar: Imzaci[];
  fiyatFarki: {
    a1: number; a2: number; b1: number; b2: number; b3: number; c: number;
    /** Sabit katsayı B */
    B: number;
    Go: number; Gn: number; Io: number; In: number; Mo: number; Mn: number;
    /** Asgari ücret farkı (plaka formu M26) */
    asgariUcretFarki: number;
    /** Excel davranışı: operatör satırında işçilik fiyat farkı sürücü fiyat farkı tablosuyla hesaplanır */
    operatorSurucuTablosunuKullan: boolean;
  };
  /** EPDK motorin fiyatı */
  epdkYakitFiyati: number;
  ucret: {
    surucu: UcretTablosu;
    operator: UcretTablosu;
    /** Fiyat farkı hesabında kullanılan tablolar */
    ffSurucu: UcretTablosu;
    ffOperator: UcretTablosu;
    /** Sürücü ücretinden düşülen yemek+yol gün sayısı (22) */
    yemekYolDusumGun: number;
    /** Araç kira ve fiyat farkı gün böleni (30) */
    ayBolenGun: number;
  };
  vergi: {
    kdv: number;                     // 0.20
    iscilikTevkifat: number;         // 0.9
    aracTevkifat: number;            // 0.5
    konaklamaKdv: number;            // 0.10
    konaklamaKdvTevkifatliNet: number; // 0.01
    konaklamaTevkifat: number;       // 0.9
    konaklamaEsik: number;           // 12000
    konaklamaEsikBolen: number;      // 1.01
    damgaHakedis: number;            // 0.00948
  };
  bordro: {
    asgariUcretBrut: number;         // 33030
    carpanSurucu: number;            // 1.35
    carpanOperator: number;          // 1.65
    aylikSaat: number;               // 225
    fazlaMesaiZam: number;           // 1.5
    ayGun: number;                   // 30
    yemekGunluk: number;             // 330.3
    yolGunluk: number;               // 330.3
    yemekIstisnaGunluk: number;      // 300
    sgkIsci: number;                 // 0.14
    sgdpIsci: number;                // 0.075
    issizlikIsci: number;            // 0.01
    issizlikEmekli: number;          // 0
    damga: number;                   // 0.00759
    gvMatrahOrani: number;           // 0.85
    konaklamaCarpanStandart: number; // 1.1
    konaklamaCarpanDiger: number;    // 1.12
    gvDilimleri: GvDilimi[];
  };
}

export const VARSAYILAN_PARAMS: Params = {
  ozellikler: { fazlaMesai: true, haftaTatili: true, resmiTatil: true, disGorev: true, konaklama: true, yemek: true, yol: true },
  takvim: { cumartesiIsGunu: false, agirlikRTA: 1, agirlikDBA: 0.5 },
  puantaj: { haftaTatiliSaat: 7.5, disGorevKismi: 0.66 },
  kurum: {
    kurumAdi: 'KURUM ADI',
    bolgeAdi: 'BÖLGE MÜDÜRLÜĞÜ',
    firmaAdi: '',
    firmaKisaAdi: '',
    firmaAdresi: '',
  },
  sozlesme: {
    ihaleTarihi: '2026-03-23',
    sozlesmeTarihi: '2026-04-13',
    iseBaslamaTarihi: '2026-05-01',
    gunlukCalismaSaati: 9,
    yakitCinsi: 'Motorin',
  },
  imzacilar: [
    { ad: '', unvan: 'Makine İkmal Başmühendisi' },
    { ad: '', unvan: 'İdari ve Mali İşler Müdürü' },
    { ad: '', unvan: 'Bölge Müdür Yrd. (İdari-Mali)' },
  ],
  fiyatFarki: {
    a1: 0.5, a2: 0, b1: 0, b2: 0, b3: 0.03, c: 0.47, B: 0.9,
    Go: 5145.36, Gn: 5781.74, Io: 33030, In: 33030, Mo: 3726.74, Mn: 4036.91,
    asgariUcretFarki: 0,
    operatorSurucuTablosunuKullan: true,
  },
  epdkYakitFiyati: 64.52083,
  ucret: {
    surucu: { ucretBrut: 75233.62, ucretKesinti: 771.63, resmiTatil: 1912.93, haftaTatili: 382.6, fazlaCalisma: 382.6, konaklama: 2700, disGorev: 1000, yemek: 337.5, yol: 408.75 },
    operator: { ucretBrut: 87986.51, ucretKesinti: 771.63, resmiTatil: 2338.02, haftaTatili: 467.6, fazlaCalisma: 467.6, konaklama: 2700, disGorev: 1000, yemek: 337.5, yol: 408.75 },
    ffSurucu: { ucretBrut: 75233.62, ucretKesinti: 771.63, resmiTatil: 1912.93, haftaTatili: 382.6, fazlaCalisma: 382.6, konaklama: 2700, disGorev: 1000, yemek: 337.5, yol: 408.75 },
    ffOperator: { ucretBrut: 87986.51, ucretKesinti: 771.63, resmiTatil: 2338.02, haftaTatili: 467.6, fazlaCalisma: 467.6, konaklama: 2700, disGorev: 1000, yemek: 337.5, yol: 408.75 },
    yemekYolDusumGun: 22,
    ayBolenGun: 30,
  },
  vergi: {
    kdv: 0.2, iscilikTevkifat: 0.9, aracTevkifat: 0.5,
    konaklamaKdv: 0.1, konaklamaKdvTevkifatliNet: 0.01, konaklamaTevkifat: 0.9,
    konaklamaEsik: 12000, konaklamaEsikBolen: 1.01, damgaHakedis: 0.00948,
  },
  bordro: {
    asgariUcretBrut: 33030, carpanSurucu: 1.35, carpanOperator: 1.65, aylikSaat: 225, fazlaMesaiZam: 1.5,
    ayGun: 30, yemekGunluk: 330.3, yolGunluk: 330.3, yemekIstisnaGunluk: 300,
    sgkIsci: 0.14, sgdpIsci: 0.075, issizlikIsci: 0.01, issizlikEmekli: 0, damga: 0.00759, gvMatrahOrani: 0.85,
    konaklamaCarpanStandart: 1.1, konaklamaCarpanDiger: 1.12,
    gvDilimleri: [ { ust: 190000, oran: 0.15 }, { ust: 400000, oran: 0.2 }, { ust: null, oran: 0.27 } ],
  },
};

/** Eksik alanları varsayılanla tamamlar (eski kayıtlar yeni alanlarla uyumlu kalsın). */
export function paramsTamamla(p: Partial<Params> | undefined): Params {
  const d = VARSAYILAN_PARAMS;
  const merge = (a: any, b: any): any => {
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (a && typeof a === 'object') {
      const o: any = {};
      for (const k of Object.keys(a)) o[k] = merge(a[k], b ? b[k] : undefined);
      return o;
    }
    return b === undefined || b === null ? a : b;
  };
  return merge(d, p ?? {});
}
