# Makine İkmal Hakediş

Araç kiralama ve sürücü hizmet alımı **hakedişlerini**, **puantajı**, **fiyat farkını** ve **bordroyu** hesaplayan, kurulum gerektirmeyen Windows masaüstü uygulaması.
Hesap motoru Excel çıktılarıyla **kuruşu kuruşuna** doğrulanır. 2-6 kişilik bir ekibin ortak klasörden birlikte kullanması için tasarlanmıştır.

> Kullanıcı kılavuzu: [KULLANIM.md](KULLANIM.md) · Hesap kuralları: [RULES.md](RULES.md)

## Öne çıkanlar

- **Günlük kayıt formu:** sürücü başına günlük puantaj; her görev ayrı kart (çift görev), görev saatlerinden otomatik fazla mesai (18:00 sonrası, yuvarlama seçilebilir), giriş/çıkış KM ve harici KM.
- **Hakediş ve bordro:** firma hakedişi, ön tablo, sürücü faaliyet, net maaş; sürücü bazlı, yıllık kümülatif gelir vergisi (dilimler düzenlenebilir).
- **Hızlı Ayar:** yeni yıl zammı (yüzde) ve ödeme kalemlerini (mesai, yemek, yol, konaklama...) tek yerden açıp kapatma; dönem bazlı sürümlü parametreler.
- **Excel / PDF çıktıları:** kurum puantajı, plaka formları, firma hakedişi, bordro.
- **Çok kullanıcı:** ortak ağ klasöründe tek veri dosyası; atomik yazma, yazma kilidi, açık oturum görme, roller (yönetici / kullanıcı / izleyici).
- **Güvenlik ve dayanıklılık:** şifreli giriş, hatalı deneme sınırı, T.C. no maskeleme, değişiklik kaydı (kim, ne zaman, eski → yeni), günlük yedek (son 14), bozuk dosyada yedekten kurtarma, sürüm koruması.
- **Bireysel düzenleme:** geçmiş tarihli kayıtları sürücü ve tarih aralığına göre bulup düzeltme veya silme; hakediş ve bordro yeniden hesaplanır.
- **Basit kurulum:** `kur.bat` ile yerel diske kurulum, veri yolu `yapilandirma.json` ile; internet ve yönetici izni gerekmez. Altı renk teması.

## Teknoloji

Electron · React · TypeScript · Vite · SQLite (sql.js, WASM) · ExcelJS · Vitest.
Hesap motoru (`src/engine`) arayüzden bağımsız, saf TypeScript'tir.

## Yapı

| Klasör | İçerik |
| --- | --- |
| `src/engine/` | Saf hesap motoru: takvim, kurum puantajı, firma hakedişi, bordro, mesai, zam |
| `src/importer/` | Mevcut Excel dosyalarını okuma |
| `electron/` | Ana süreç: veritabanı (atomik kayıt, kilit, yedek, değişiklik kaydı), API, Excel/PDF çıktıları |
| `src/renderer/` | React arayüzü |
| `templates/` | Excel çıktıları için biçim şablonu |
| `paket-dosyalari/` | Paketle birlikte dağıtılan `kur.bat`, `yapilandirma.json`, okuma dosyası |
| `tests/` | Excel doğrulaması, girdi doğrulama, çok kullanıcı, sürüm koruması, kurtarma ve daha fazlası |

## Geliştirme

```
npm install
npm test            # örnek Excel dosyaları "örnek exceller/" klasöründeyse tam doğrulama
npm run dev         # geliştirme
npm run dist        # release/win-unpacked (kurulumsuz klasör paketi)
```

İlk kurulumda npm 11 install betiklerini engeller: `npm install-scripts approve electron esbuild`.

Kurum ve kişi verisi içeren örnek Excel dosyaları, veritabanları ve paket klasörleri bilerek bu depoda **yoktur** (`.gitignore`). Örnek dosyalar yoksa Excel doğrulama testleri atlanır.

## Veri ve gizlilik

Bu depo yalnızca kaynak kodu içerir. Varsayılan kurum adları genel ifadelerdir (`KURUM ADI`), gerçek kişi, araç ve firma bilgisi bulunmaz.

---
Geliştirici: **Yunus Dağ**
