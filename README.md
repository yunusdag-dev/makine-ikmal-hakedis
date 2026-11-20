# Makine İkmal Hakediş

Electron + React (TypeScript) + SQLite (sql.js) masaüstü uygulaması. Kullanıcı kılavuzu: [KULLANIM.md](KULLANIM.md) · Hesap kuralları: [RULES.md](RULES.md)

## Yapı
- `src/engine/` — **saf TypeScript hesap motoru** (arayüzden bağımsız): takvim, kurum puantajı (Aşama 1), firma hakedişi (Aşama 2), bordro
- `src/importer/` — mevcut Excel dosyalarını okuma
- `electron/` — ana süreç: veritabanı (atomik kayıt, kilit, yedek, değişiklik kaydı), API, Excel/PDF çıktıları
- `src/renderer/` — React arayüzü
- `templates/layout.json` — örnek dosyalardan çıkarılmış biçim şablonu (kişisel veri içermez)
- `tests/` — Excel ile kuruşu kuruşuna doğrulama testleri; girdi doğrulama, çok kullanıcı, sürüm koruması, kurtarma, T.C. maskeleme testleri

## Komutlar
```
npm install
npm test            # örnek Excel'ler "örnek exceller/" klasöründeyse tam doğrulama
npm run dev         # geliştirme
npm run dist        # release/win-unpacked  → içeriği kurum paketi klasörü (kurulumsuz; veri klasörün içindeki veri\hakedis.db)
npm run hazir-veri -- "<kurum.xlsx>" "<firma.xlsx>"   # hazir-veri/hakedis.db (kurulumla gelen başlangıç verisi)
node scripts/extract-layout.mjs "<kurum.xlsx>" "<firma.xlsx>"   # biçim şablonunu yeniden üret
```
Not: npm 11 install script'lerini engeller; ilk kurulumda `npm install-scripts approve electron esbuild`.
Gerçek kişi adları içeren örnek dosyalar `.gitignore` ile repodan hariçtir.
