/** Ana süreç köprüsü (preload) için tipli sarmalayıcılar */
declare global {
  interface Window {
    hakedis: {
      baslangic(): Promise<R<any>>;
      dbBaglan(dbYolu: string, secenek?: { olustur?: boolean; sec?: boolean }): Promise<R<{ dosya: string; kurulumGerekli: boolean }>>;
      veriKlasoruBilgi(): Promise<R<{ klasor: string; dosya: string; kaynak: string }>>;
      veriKlasoruDegistir(): Promise<R<boolean>>;
      ilkKurulum(o: { kullaniciAdi: string; ad: string; sifre: string }): Promise<R<{ kurtarmaKodu: string; oturum: any }>>;
      girisYap(o: { kullaniciAdi: string; sifre: string }): Promise<R<any>>;
      kurtar(o: { kod: string; kullaniciAdi: string; yeniSifre: string }): Promise<R<any>>;
      kimlik(metot: string, ...args: any[]): Promise<R<any>>;
      oturumKapat(): Promise<R<any>>;
      bozukKurtar(o: { dbYolu: string; yedekYolu: string }): Promise<R<any>>;
      api(metot: string, ...args: any[]): Promise<R<any>>;
      dosyaSec(o: { baslik: string; filtre?: { name: string; extensions: string[] }[]; kaydet?: boolean; varsayilan?: string; klasor?: boolean }): Promise<R<string | null>>;
      dosyaAc(yol: string): Promise<R<any>>;
      klasordeGoster(yol: string): Promise<R<any>>;
      excelIceAktar(o: { kurum: string; firma: string | null; yalnizKartlar?: boolean }): Promise<R<any>>;
      cikti(o: { tur: string; ay: string; hedef: string; indeksler?: number[] }): Promise<R<string>>;
      gunlukYaz(kaynak: string, mesaj: string): Promise<boolean>;
    };
  }
}
export type R<T> = { ok: true; veri: T } | { ok: false; hata: string; kod?: string; ek?: any };

export class ApiHata extends Error {
  constructor(msg: string, public kod?: string, public ek?: any) { super(msg); }
}

export function coz<T>(r: R<T>): T {
  if (!r.ok) throw new ApiHata(r.hata, r.kod, r.ek);
  return r.veri;
}

export async function api<T = any>(metot: string, ...args: any[]): Promise<T> {
  return coz(await window.hakedis.api(metot, ...args)) as T;
}

export async function kimlik<T = any>(metot: string, ...args: any[]): Promise<T> {
  return coz(await window.hakedis.kimlik(metot, ...args)) as T;
}

export const kopru = window.hakedis;
