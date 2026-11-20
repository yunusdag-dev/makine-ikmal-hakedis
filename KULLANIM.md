# Makine İkmal Hakediş — Kullanım Kılavuzu

## Kurulum (kurum bilgisayarı) — kurulumsuz, tek klasör
1. `KURUMA-GOTUR\MakineIkmalHakedis` klasörünü **ortak ağ klasörüne** (ya da tek bilgisayarsa bilgisayara) kopyalayın.
2. Klasördeki **`Makine Ikmal Hakedis.exe`** dosyasına çift tıklayın. Kurulum programı yoktur. İlk açılışta `veri\hakedis.db` kendiliğinden oluşur; araç, sürücü, atama, parametre ve tatil kayıtları **hazır** gelir.
3. İlk yönetici hesabını oluşturun ve ekranda görünen **kurtarma kodunu** bir yere yazın.
4. Her kullanıcı için masaüstü kısayolu: klasördeki **`Masaustune-kisayol-olustur.bat`** dosyasına çift tıklayın.
- **Herkes aynı klasörden çalışırsa** aynı veriyi kullanır (veritabanı klasörün içindeki `veri\hakedis.db` dosyasıdır).
- Windows "bilinmeyen yayımcı" ya da ağ uyarısı verirse **Ek bilgi → Yine de çalıştır** deyin (program dijital imzalı değildir). Ağ klasörüne bilgisayar adıyla (`\\sunucu\...`) erişmek bu uyarıyı azaltır.
- **Güncelleme:** yeni sürüm klasörünün içindekileri mevcut klasörün üzerine kopyalayın; **`veri` klasörüne dokunmayın** (yeni sürümde zaten `veri` klasörü bulunmaz). Veritabanı yapısı değişecekse uygulama önce kendi yedeğini alıp dosyayı yükseltir. Eski sürümlü bir uygulama, yeni yapıdaki veritabanını açmaz ve uyarı verir (veri bozulmaz). Güncellemeyi yaparken herkesin uygulamayı kapatmış olması iyidir.
- **Klasör izinleri (önemli):** Roller ve şifreler uygulama içindedir; veritabanı dosyasına yazma izni olan biri dosyayı başka bir araçla değiştirebilir. Bu yüzden `veri` klasörünün yazma iznini **yalnızca uygulamayı kullanan kişilere** verin; uygulama klasörünün geri kalanını (`Makine Ikmal Hakedis.exe` ve program dosyaları) kullanıcılara **salt okunur**, yalnız yöneticilere yazılabilir yapın. Yedekler ve değişiklik günlükleri de aynı klasördedir; bu klasörü yetkisiz kişilere açmayın.
- Geliştirici notu: paketi yeniden üretmek için `npm run dist` (çıktı `release\win-unpacked`; klasörün içeriği `KURUMA-GOTUR\MakineIkmalHakedis` olarak kopyalanır). Hazır başlangıç verisi `npm run hazir-veri -- "<kurum.xlsx>" "<firma.xlsx>"` ile üretilir (`hazir-veri\hakedis.db`, repoda yok).

## Hesaplar ve şifreler
- Veritabanı ilk kez açıldığında **ilk yönetici hesabı** oluşturulur (ad soyad, kullanıcı adı, en az 6 karakterli şifre).
- Bu sırada bir **kurtarma kodu** gösterilir (ör. `K7PQ-M2XD-9HTA`). Kodu güvenli bir yere yazın; tüm yöneticiler şifresini unutursa giriş ekranındaki **Şifremi unuttum** bağlantısıyla kullanılır.
- Yönetici, **Kullanıcılar** ekranından diğer hesapları ekler. Birden fazla yönetici olabilir.
- **Roller:**
  - **Yönetici:** her şey, artı kullanıcı yönetimi, parametreler (Hızlı Ayar dahil), tatiller, **dönem kapatma/açma**, **araç ve sürücü silme**, **sürücü-araç ataması**, yedekten geri yükleme ve Excel içe aktarma.
  - **Kullanıcı:** günlük puantaj ve hakediş girişleri, araç/sürücü kartlarını ekleme ve düzenleme, çıktı alma (silme, dönem kapatma ve araç ataması yöneticidedir).
  - **İzleyici:** yalnız görüntüleme ve çıktı alma.
- **Şifre ata:** Şifresini unutan kullanıcıya yönetici geçici bir şifre verir. Kullanıcı ilk girişte kendi şifresini belirlemek zorundadır.
- Herkes kenar çubuğundaki **Şifrem** düğmesiyle kendi şifresini değiştirebilir.
- Üst üste 5 hatalı denemede hesap 1 dakika bekletilir; kurtarma kodunda 5 hatalı denemeden sonra 5 dakika beklenir. Sayaç veritabanında tutulur, uygulama kapatılıp açılsa da sıfırlanmaz. Şifreler düz metin olarak saklanmaz (scrypt özeti).
- Hesaplar silinmez, gerekirse pasif yapılır. En az bir aktif yönetici her zaman bulunur.

## Aynı anda birden çok kişi
- 2-3 kişi (veya daha fazlası) uygulamayı **aynı anda açıp aynı anda veri girebilir**.
- Her kayıt anında diskteki en güncel veriye eklenir. Kayıt sırasında birkaç milisaniyelik bir yazma kilidi (`hakedis.db.yazma`) kullanılır, böylece kimse diğerinin kaydını ezmez.
- Ekranlar başkalarının değişikliklerini birkaç saniyede bir otomatik çeker. Bildirim örneği: "Ayşe veriyi güncelledi; ekran yenilendi".
- Kenar çubuğunda ve üst çubukta o an kimlerin açık olduğu görünür (`hakedis.db.oturumlar` klasörü).
- Aynı alanı aynı anda iki kişi değiştirirse son kaydedilen geçerli olur. Kim neyi değiştirdi, Değişiklik Kaydı ekranında görünür.

## Verilerin güvenliği
- Her değişiklik **anında** diske yazılır. Yazma "önce geçici dosya, sonra yer değiştirme" yöntemiyle yapılır; elektrik kesilse veya ağ kopsa bile dosya bozulmaz. Bir önceki sürüm (en çok 5 dakikada bir tazelenir) `hakedis.db.bak` olarak durur.
- **Otomatik yedek:** son yedek 2 saatten eskiyse `yedekler\` klasörüne alınır (son 60 yedek). Elle yedek alma ve geri yükleme: *Veritabanı & Yedek* ekranı.
- Dosya bozuk açılırsa uygulama yedek listesini gösterir; birini seçerek kurtarırsınız. Bozuk dosya silinmez.
- Veritabanı standart **SQLite** dosyasıdır. Uygulama hiç açılmasa bile verilere "DB Browser for SQLite" gibi bir araçla erişilebilir.
- **Değişiklik Kaydı** ekranı her işlemi gösterir: kim, ne zaman, hangi bilgisayardan, ne değişti (önce/sonra). 12 aydan eski kayıtların yalnız önce/sonra ayrıntısı silinir (kim/ne zaman/özet kalır).
- **T.C. kimlik no** her yerde gizli (`*********01`) gösterilir. Sürücü kartında **Göster** düğmesi tam numarayı açar; her gösterim Değişiklik Kaydına yazılır (izleyici göremez). Değişiklik kaydında T.C. no hiçbir zaman açık yazılmaz.
- **Hata günlüğü:** beklenmeyen hatalar `veri\loglar\hata-<bilgisayar>.log` dosyasına yazılır (1 MB'ı aşınca eski dosya `.1` olur). Şifre ve kişisel veri günlüğe yazılmaz. Bir sorun olduğunda bu dosyayı yöneticiye iletin.
- **Yanlış girilen kaydı düzeltme:** Günlük Kayıt Formunda günü açıp değiştirerek **Kaydet**; tamamen silmek için **Günü sil**. Önceki hali Değişiklik Kaydında kalır. Kapatılmış dönemdeki kayıt için önce dönem açılır.
- Girilen değerler (tarih, mesai 0-24 saat, KM, tutarlar vb.) uygulama içinde ayrıca doğrulanır; geçersiz değer kaydedilmez ve nedeni söylenir.

## Günlük kullanım
0. **Günlük Kayıt Formu (F2):** Excel'deki plaka puantaj satırının form halidir. Sürücüyü ve tarihi seçin; sonra şunları girin:
   - sürücü çalışma durumu,
   - çıkış/dönüş saati,
   - fazla mesai (saatlere göre öneri verilir),
   - hafta tatili, resmi tatil, dış görev (⅔ / tam), konaklama,
   - yemek/yol,
   - araç ve görev satırları: görevli personel, gidilen yer, çıkış/dönüş KM, İG/İGD.

   Bir günde birden çok araç/görev eklenebilir. Sağdaki listede ayın günleri görünür; bir güne tıklayınca form o güne gider.
   Klavye kısayolları: `Ctrl+S` kaydet · `Ctrl+Enter` kaydet ve sonraki gün · `Alt+←/→` önceki/sonraki gün.
   Puantaj ızgarasında gün numarasına çift tıklamak da aynı formu açar.
   **Sürücü-araç eşleşmesi:** Her sürücünün bir aracı vardır ve günlük girişte o gün için her zaman bu araç hazır seçili gelir. Aracı değiştirmek için Sürücüler ekranında sürücüyü açıp **"Bu aydan itibaren"** yeni araç atayın; geçmiş aylar etkilenmez. Nadiren başka plakayla çalıştığı gün, günlük formda araç satırından plakayı değiştirmeniz yeterlidir (kalıcı atama değişmez). Seçili ay, ay seçiciden görülür.
1. **Sürücüler / Araçlar:** Kayıt ekleyin (`Ctrl+N`). Her sürücüye bir **varsayılan araç** atayın. Gerekirse operatör, emekli veya "yol ücreti almaz" seçeneklerini işaretleyin.
2. **Sürücü Puantajı (F2):** Soldan sürücüyü seçin. Aylık takvimde her gün için:
   - **Durum:** `X` çalıştı · `R` rapor · `S` senelik izin · `U` ücretsiz izin · `M` mazeret · `İ` idari · `B` bayram · `0` çalışmadı
   - **Araç:** Varsayılan araç otomatik gelir. Başka araç için `Enter` ile seçin; aynı gün ikinci araç için `Insert`.
   - **Çıkış / Dönüş KM:** `Enter` ile girin. Çıkış KM boşsa aracın son KM'si önerilir.
   - **İG / İGD:** `G` İG, `1` İGD (tam gün), `5` İGD (yarım gün)
   - **Fazla mesai:** saat olarak girilir.
   - **Hafta tatili / Konaklama:** `X` veya `Boşluk` tuşu
   - **Resmi tatil:** `1` / `5` (yarım gün)
   - **Dış görev:** `2` = ⅔ (0,66), `T` = tam gün
   - **Yemek / Yol:** otomatik hesaplanır. `Boşluk` ile elle değiştirilir; elle değiştirilen değer mor görünür.
   - `Ctrl+D` önceki günü kopyalar. **İş günlerini doldur** düğmesi, boş iş günlerini `X` ve varsayılan araçla doldurur.
3. **Araç Hareketleri (F3):** Bir aracın aylık KM akışını tüm sürücüleriyle birlikte gösterir ve KM sürekliliğini denetler.
4. **Hakediş Girişleri (F4):**
   - Gri alanlar puantajdan otomatik gelir.
   - Sarı alanlar elle girilir: önceki KM, hizmet dışı günler, kira, konaklama fiyatı, kümülatif matrah vb. Boş bırakılırsa otomatik değer kullanılır.
   - Hatalı veriler üstte uyarı olarak listelenir.
5. **Hakediş (F5):** ÖN TABLO, toplamlar ve fatura özeti. Bir satıra tıklayınca plaka formu açılır; oradan PDF veya Excel alınır. Ay bitince **Dönemi kapat** düğmesine basın: kümülatif vergi matrahı sonraki aya devreder ve o ay kilitlenir.
6. **Bordro (F6):** Brütten nete tüm hesap. Bir sürücüye tıklayınca ayrıntısı açılır.
7. **Çıktılar (F7):** Kurum puantaj dosyası, firma hakediş dosyası, ÖN TABLO, Sürücü Faaliyet, Araç Faaliyet, Bordro Tutar ve plaka formları (Excel/PDF).

Ay değiştirmek için üstteki ay seçiciyi veya `Ctrl+←` / `Ctrl+→` kullanın. Ay seçicinin yanındaki **Güncelle** düğmesi seçili ayı yeniden yükleyip hesaplar (başkalarının girdiği veriler dahil).
**Puantajı hiç girilmemiş ay** için tüm tutarlar sıfır gösterilir; sabit sürücü ücreti ve araç kirası faturalanmaz. Aya tek bir günlük puantaj girildiği anda hesap başlar. Boş bir dönem kapatılamaz.

## Hızlı Ayar: yıllık zam ve ödeme kalemlerini aç/kapat (Ayarlar › Parametreler)
Yeni yıl zammı geldiğinde ya da bir ödeme kalemi kalktığında **Ayarlar › Parametreler** ekranının üstündeki **Hızlı Ayar** çubuğunu açın (yalnız yönetici):
1. **Geçerlilik başlangıç ayı** seçin (ör. Ocak 2027). Yeni değerler o aydan itibaren geçerli olur; **önceki aylar eski değerlerle hesaplanmaya devam eder**.
2. **Zam oranı (%)**: çubuğu kaydırın ya da yüzdeyi yazın (ör. 35). Eksi değer indirim yapar.
3. Zammın uygulanacağı kalemleri işaretleyin: aylık brüt ücretler, tatil/fazla çalışma ücretleri, yemek ve yol, konaklama ve dış görev, asgari ücret, endeks ve yakıt. **Yalnız tutarlar** zamlanır; vergi oranları, çarpanlar, gün sayıları ve kesintilere dokunulmaz. Sonuç kuruşa yuvarlanır.
4. **Ödeme kalemleri (aç / kapat)**: fazla mesai, hafta tatili çalışması, resmi tatil çalışması, dış görev, konaklama, yemek, yol. Kapatılan kalem o dönemden itibaren hesapta **sıfır** sayılır (günlük kayıtlar ve birim ücretler silinmez; tekrar açılınca geri gelir). *Yemek veya yol kapatılınca, sürücü ücretinden yemek/yol düşümü de sıfırlanır; sözleşme ücretini gerekirse ayrıca güncelleyin.*
5. **Önizleme** hangi tutarın neye dönüşeceğini gösterir. **"... itibarıyla uygula"** yeni parametre sürümünü oluşturur (üstteki Sürümler listesinde görünür; yanlışsa sürümü silebilirsiniz).
Tek tek ayarlamak için aynı ekrandaki bölümler (ücret tabloları, bordro, vergi) kullanılır; ödeme kalemi anahtarları da orada "Ödeme kalemleri" bölümünde durur.

## Yıllık / dönemsel güncellemeler (Ayarlar)
Asgari ücret, çarpanlar, yemek/yol/dış görev/konaklama ücretleri, endeksler, EPDK fiyatı, vergi oranları, gelir vergisi dilimleri ve imzacılar **Ayarlar & Parametreler** ekranından değiştirilir.
- Değişiklik bir aydan itibaren geçerliyse **Farklı dönem olarak kaydet** düğmesiyle yeni bir sürüm oluşturun (ör. "2027-01 itibarıyla").
- Eski aylar eski parametrelerle hesaplanmaya devam eder.
- Resmi tatil ve dini bayramlar *Resmi tatil ve bayramlar* sekmesinden yıl yıl girilir.

## Mevcut Excel dosyalarını aktarma
*Veritabanı & Yedek → Excel'den içe aktar* ile kurum puantaj dosyası (ve isteğe bağlı firma hakediş dosyası) seçilir.
- Aktarılanlar: araçlar, sürücüler, günlük puantaj, tatiller ve o ayın parametreleri.
- Aktarılan ay, Excel'deki rakamlarla kuruşu kuruşuna aynı hesaplanır.
