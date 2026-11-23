/** Plaka hakediş formu — PDF için yazdırılabilir HTML (Excel formunun düzeni) */
import { DonemSonucu } from '../src/engine/donem';
import { Params } from '../src/engine/params';
import { AY_ADLARI, parseAy } from '../src/engine/excel';

const tl = (x: number) => esc(Number.isFinite(x) ? x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
const sayi = (x: number, d = 2) => esc(Number.isFinite(x) ? x.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: d }) : '');
const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const tarih = (s: string) => esc(s ? s.split('-').reverse().join('.') : '');

export function plakaFormuHtml(son: DonemSonucu, p: Params, indeksler: number[]): string {
  const { yil, ay } = parseAy(son.ay);
  const sayfalar = indeksler.map((i) => {
    const g = son.giris[i];
    const f = son.firma.formlar[i];
    const ff = p.fiyatFarki;
    const im = p.imzacilar;
    return `
<section class="sayfa">
  <h1>${esc(p.kurum.kurumAdi)} ${esc(p.kurum.bolgeAdi.replace(/\s*\(.*\)\s*/, ''))}</h1>
  <h2>KİRALIK ARAÇLARA AİT FİYAT FARKI VE ÖDEMEYE ESAS ÜCRET HESABI FORMU</h2>
  <div class="ay">${esc(AY_ADLARI[ay - 1])} ${esc(yil)}</div>
  <table class="bilgi">
    <tr><th colspan="2">İhale Bilgileri</th><th colspan="4">Araç Bilgileri</th></tr>
    <tr><td>İhale Tarihi</td><td>${tarih(p.sozlesme.ihaleTarihi)}</td><td>Şoför</td><td>${esc(g.surucu)}</td><td>Cinsi</td><td>${esc(g.aracTipi)}</td></tr>
    <tr><td>Sözleşme Tarihi</td><td>${tarih(p.sozlesme.sozlesmeTarihi)}</td><td>Plaka</td><td><b>${esc(g.plaka)}</b></td><td>Görev Yeri</td><td>${esc(g.gorevYeri)}</td></tr>
    <tr><td>İşe Başlama Tarihi</td><td>${tarih(p.sozlesme.iseBaslamaTarihi)}</td><td>Marka/Model</td><td>${esc(g.markaModel)}</td><td>Tüketim Oranı</td><td>${sayi(f.L7_tuketim, 3)}</td></tr>
    <tr><td>Yüklenici Firma</td><td>${esc(p.kurum.firmaKisaAdi || p.kurum.firmaAdi)}</td><td>Yıl</td><td>${esc(g.modelYili ?? '')}</td><td>EPDK Akaryakıt</td><td>${sayi(p.epdkYakitFiyati, 5)}</td></tr>
    <tr><td>Hakediş Tarihi</td><td>01.${esc(String(ay).padStart(2, '0'))}.${esc(yil)}</td><td>Yakıt Cinsi</td><td>${esc(p.sozlesme.yakitCinsi)}</td><td>Araç Kiralama Bedeli</td><td>${tl(f.L9_kira)}</td></tr>
  </table>
  <h3>ARACA İLİŞKİN BİLGİLER</h3>
  <table class="ikili">
    <tr>
      <td><table>
        <tr><th colspan="4">Fiyat Farkına Dahil Maliyet Unsurları</th></tr>
        <tr><td>a1</td><td>${esc(ff.a1)}</td><td>Yi-ÜFE Temel (Go)</td><td>${sayi(ff.Go)}</td></tr>
        <tr><td>a2</td><td>${esc(ff.a2)}</td><td>Yi-ÜFE Güncel (Gn)</td><td>${sayi(ff.Gn)}</td></tr>
        <tr><td>b1</td><td>${esc(ff.b1)}</td><td>Temel Asgari Ücret (İo)</td><td>${sayi(ff.Io)}</td></tr>
        <tr><td>b2</td><td>${esc(ff.b2)}</td><td>Güncel Asgari Ücret (İn)</td><td>${sayi(ff.In)}</td></tr>
        <tr><td>b3</td><td>${esc(ff.b3)}</td><td>Temel Malzeme End. (Mo)</td><td>${sayi(ff.Mo)}</td></tr>
        <tr><td>c</td><td>${esc(ff.c)}</td><td>Güncel Malzeme End. (Mn)</td><td>${sayi(ff.Mn)}</td></tr>
      </table></td>
      <td><table>
        <tr><th colspan="2">KM Bilgileri</th></tr>
        <tr><td>Önceki Ay Kapanış KM</td><td>${sayi(f.G15_oncekiKm, 0)}</td></tr>
        <tr><td>Çalışılan Ayın Kapanış KM</td><td>${sayi(f.G16_kapanisKm, 0)}</td></tr>
        <tr><td>Hizmet İçi KM</td><td>${sayi(f.G17_hizmetIciKm, 0)}</td></tr>
        <tr><td>Hizmet Dışı KM</td><td>${sayi(f.G19_hizmetDisiKm, 0)}</td></tr>
      </table></td>
      <td><table>
        <tr><th colspan="2">Cezalar ve Kesintiler</th></tr>
        <tr><td>Hizmet Dışı KM Yakıt Kesintisi</td><td>${tl(f.I15_yakitYansitma)}</td></tr>
        <tr><td>Hizmet Dışı Gün</td><td>${sayi(f.I17_hizmetDisiGun)}</td></tr>
        <tr><td>Kesinti Bedeli</td><td>${tl(f.I18_kesinti)}</td></tr>
      </table></td>
      <td><table>
        <tr><th colspan="2">Fiyat Farkı</th></tr>
        <tr><td>Fiyat Farkı Katsayısı (Pn)</td><td>${esc(f.M19_pn.toFixed(5))}</td></tr>
        <tr><td>Sabit Katsayı (B)</td><td>${esc(ff.B)}</td></tr>
        <tr><td>Araç Fiyat Farkı</td><td>${tl(f.M20_aracFiyatFarki)}</td></tr>
      </table></td>
    </tr>
  </table>
  <h3>SÜRÜCÜYE İLİŞKİN BİLGİLER</h3>
  <table class="kalem">
    <tr><th></th><th>Fazla Çalışma (Saat)</th><th>Hafta Tatili (Saat)</th><th>UBGT (Gün)</th><th>Dış Görev (Gün)</th><th>Konaklama (Gün)</th><th>Yemek</th><th>Yol</th><th>Sürücü Ücreti (Yemek-Yol Hariç)</th><th>Fiyat Farkı</th><th>Asgari Ücret Farkı</th></tr>
    <tr><td>Birim</td><td>${tl(f.B26)}</td><td>${tl(f.D26)}</td><td>${tl(f.E26)}</td><td>${tl(f.F26)}</td><td>${tl(f.G26)}</td><td>${tl(f.H26)}</td><td>${tl(f.I26)}</td><td>${tl(f.K26_surucuUcreti)}</td><td>${tl(f.L26_fiyatFarki)}</td><td>${tl(f.M26_asgariFark)}</td></tr>
    <tr><td>Miktar</td><td>${sayi(f.B27)}</td><td>${sayi(f.D27)}</td><td>${sayi(f.E27)}</td><td>${sayi(f.F27)}</td><td>${sayi(f.G27)}</td><td>${sayi(f.H27)}</td><td>${sayi(f.I27)}</td><td colspan="3" class="sag"><b>Toplam Sürücü Ücreti</b></td></tr>
    <tr><td>Tutar</td><td>${tl(f.B28)}</td><td>${tl(f.D28)}</td><td>${tl(f.E28)}</td><td>${tl(f.F28)}</td><td>${tl(f.G28)}</td><td>${tl(f.H28)}</td><td>${tl(f.I28)}</td><td colspan="3" class="sag"><b>${tl(f.K28_toplamSurucu)}</b></td></tr>
  </table>
  <div class="ozet-ikili">
    <table class="ozet">
    <tr><td>Toplam İşçilik</td><td>${tl(f.K31)}</td></tr>
    <tr><td>KDV %${esc(Math.round(p.vergi.kdv * 100))}</td><td>${tl(f.K32)}</td></tr>
    <tr><td>Tevkifat ${esc(Math.round(p.vergi.iscilikTevkifat * 10))}/10</td><td>${tl(f.K33)}</td></tr>
    <tr class="k"><td>KDV'li Toplam İşçilik</td><td>${tl(f.K34)}</td></tr>
    <tr><td>Araç Kiralama</td><td>${tl(f.K35_aracKiralama)}</td></tr>
    <tr><td>KDV %${esc(Math.round(p.vergi.kdv * 100))}</td><td>${tl(f.K36_aracKdv)}</td></tr>
    <tr><td>Tevkifat ${esc(Math.round(p.vergi.aracTevkifat * 10))}/10</td><td>${tl(f.K37_aracTevkifat)}</td></tr>
    <tr class="k"><td>KDV'li Toplam Araç Kiralama</td><td>${tl(f.K38_aracToplam)}</td></tr>
    </table>
    <table class="ozet">
    <tr><td>Konaklama Ücreti</td><td>${tl(f.K39)}</td></tr>
    <tr><td>Konaklama KDV (tevkifatlı ise net)</td><td>${tl(f.K40)}</td></tr>
    <tr class="k"><td>KDV'li Toplam Konaklama</td><td>${tl(f.K41)}</td></tr>
    <tr class="k"><td>KDV'siz Genel Toplam</td><td>${tl(f.K42)}</td></tr>
    <tr class="g"><td>Ödenecek Genel Toplam</td><td>${tl(f.K43)}</td></tr>
    <tr><td>Akaryakıt Yansıtma Bedeli</td><td>${tl(f.K44)}</td></tr>
    <tr><td>KDV %${esc(Math.round(p.vergi.kdv * 100))}</td><td>${tl(f.K45)}</td></tr>
    <tr class="k"><td>Akaryakıt Yansıtma Bedeli KDV Dahil</td><td>${tl(f.K46)}</td></tr>
    </table>
  </div>
  <table class="imza">
    <tr><td>Firma Sorumlusu</td><td>Kontrol</td><td>Üye</td><td>Üye</td></tr>
    <tr class="bos"><td></td><td></td><td></td><td></td></tr>
    <tr><td></td><td>${esc(im[0]?.ad)}</td><td>${esc(im[1]?.ad)}</td><td>${esc(im[2]?.ad)}</td></tr>
    <tr><td></td><td>${esc(im[0]?.unvan)}</td><td>${esc(im[1]?.unvan)}</td><td>${esc(im[2]?.unvan)}</td></tr>
  </table>
</section>`;
  });
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Plaka Hakediş Formları</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 9.5pt; color: #000; margin: 0; }
  .sayfa { page-break-after: always; padding: 0; }
  .sayfa:last-child { page-break-after: auto; }
  h1 { text-align: center; font-size: 12pt; margin: 0 0 1mm; }
  h2 { text-align: center; font-size: 11pt; margin: 0 0 1mm; }
  .ay { text-align: center; font-weight: bold; margin-bottom: 2mm; }
  h3 { font-size: 10pt; margin: 2.5mm 0 1mm; border-bottom: 1.5px solid #000; padding-bottom: 1mm; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #333; padding: 0.7mm 1.4mm; vertical-align: middle; }
  th { background: #e8e8e8; font-weight: bold; }
  .bilgi td:nth-child(odd) { background: #f5f5f5; width: 14%; }
  .ikili > tbody > tr > td { border: none; padding: 0 1mm 0 0; vertical-align: top; }
  .ikili table td:last-child { text-align: right; }
  .kalem td, .kalem th { text-align: center; font-size: 8.5pt; }
  .kalem td:first-child { text-align: left; background: #f5f5f5; }
  .sag { text-align: right !important; }
  .ozet-ikili { display: flex; gap: 4mm; margin-top: 2.5mm; align-items: flex-start; }
  .ozet { width: 50%; }
  .ozet td:last-child { text-align: right; width: 35%; }
  .ozet tr.k td { font-weight: bold; }
  .ozet tr.g td { font-weight: bold; background: #ececec; font-size: 11.5pt; }
  .imza { margin-top: 4mm; }
  .imza td { border: none; text-align: center; width: 25%; }
  .imza tr:first-child td { font-weight: bold; }
  .imza tr.bos td { height: 10mm; }
</style></head><body>${sayfalar.join('')}</body></html>`;
}
