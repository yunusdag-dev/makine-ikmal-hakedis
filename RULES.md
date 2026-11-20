# Makine İkmal Araç/Sürücü Hakediş — Hesap Kuralları (v0.1, ONAY BEKLİYOR)

Kaynak: `örnek exceller/Ağustos 2026.xlsx` (kurum) ve `Enzel İnşaat Ağustos 2026 Hakediş.xlsx` (firma).
Yöntem: Tüm sayfalar (gizliler dahil), tüm formüller, tanımlı adlar, veri doğrulamaları, koşullu biçimler, elle yazılmış sabitler hücre hücre okundu. 41 plaka sayfası birbiriyle formül formül karşılaştırıldı (kopya/yapıştırma hataları bu yolla bulundu). Excel'in kayıtlı (cache) değerleri testlerin "beklenen değeri" olacak.

> Bu belge **Excel'in yaptığını** anlatır, yorumlamaz. Yorum gerektiren yerler `[SORU Sx]` ile işaretlidir; bölüm 7'de toplandı. Şüpheli yerler `[TUTARSIZLIK Tx]` ile işaretlidir; bölüm 6'da toplandı.
> Gizlilik: Bu belgede kişi adı yok, yalnız plaka var.

---

## 0. Envanter

### 0.1 Kurum dosyası (47 sayfa)
| Sayfa | Durum | İçerik |
|---|---|---|
| `iş günü` | gizli | Ay/yıl/Seçim parametreleri (`R5`, `V5`, `U5`), tatil ağırlık tablosu `V12:W17`, ayın iş günü toplamı `T25`. A4:O510 arası 500 satırlık "SİCİL/NEDEN KODU/BAŞLAMA-BİTİŞ" tablosu (3998 formül) **hiçbir yerden kullanılmıyor** (eski bir SGK iş günü aracı artığı). |
| `Günler` | gizli | Seçili ayın gün gün takvim sınıflaması (aşağıda 2.1). Yalnız `iş günü` sayfasına besleme yapıyor. |
| `Tatil` | gizli | Sabit tarih listeleri: resmi tatil (2012-2027), 28 Ekim arifesi (2012-2027), dini bayram günleri (2012-2027), dini bayram arifeleri. **Formül yok, yalnız veri.** |
| `Giriş` | görünür | Araç/sürücü ana listesi (A:E) 41 satır (satır 3-43). |
| `Sürücü Puantaj` | görünür | EK-4 formu; sürücü başına 2 satır (durum satırı + ek çalışma/mesai satırı), 31 gün + özet sütunları. |
| 41 plaka sayfası | görünür | Aylık araç + sürücü puantajı (günlük giriş). **41 adet, 43 değil** [SORU S1]. |
| `HAKEDİŞ` | görünür | Plaka başına aylık özet (satır 2-42) + toplam satırı 43 + elle çalışma sütunları S:AA. |

### 0.2 Firma dosyası (46 sayfa, gizli sayfa yok, tanımlı ad yok)
`Giriş` · `ÖN TABLO` · 41 plaka formu · `Sürücü Faaliyet` · `Araç Faaliyet` · `Bordro Tutar`.
`Giriş` sayfasında 1089 hücrenin yalnızca 9'u formül, gerisi **yapıştırılmış değer**.

### 0.3 Tanımlı adlar (kurum dosyası)
| Ad | Hedef | Anlamı |
|---|---|---|
| `AyS` | `'iş günü'!$R$5` = `'34GDY157'!P5` | Seçili ay adı (Ocak…Aralık). **Yalnız ilk plaka sayfasındaki seçim geçerli**; diğer 40 sayfadaki `P5/S5` hücreleri sadece görüntü. |
| `YılS` | `'iş günü'!$V$5` = `'34GDY157'!$S$5` | Seçili yıl. |
| `Seçim` | `'iş günü'!$U$5` (değer **2**) | **"Cumartesi günleri İŞ GÜNÜ müdür?"** anahtarı (`Q9` etiketi). 1 = Cumartesi iş günü sayılır; 2 = sayılmaz. Mevcut değer 2. [SORU S2] |
| `aylar` | `Tatil!$P$5:$P$16` | Ay adı listesi (MATCH ile ay no bulmak için). |
| `ilkgün` / `songün` | `'iş günü'!T27 / T28` | Ayın ilk/son günü (kullanılmıyor). |
| 11 ad | `#REF!` | Bozuk, kullanılmıyor (`A11Q`, `ayK`, `yılK`, `yılL`, `KKK`, `DFG` …). `a` ise dış bağlantı `[1]ay!$V$5`. **Taşınmayacak.** |

### 0.4 Veri doğrulamaları (plaka sayfası)
| Sütun | Liste | Anlamı |
|---|---|---|
| `K` Sürücü Çalışma | `AO5:AO12` = 0, X, R, Sİ, Üİ, Mİ, B, İİ | Gün durum kodu (kodlar `Sürücü Puantaj` alt lejantında): X=Çalışma günü, B=Ulusal bayram/genel tatil, R=Raporlu-istirahatli, Sİ=Senelik ücretli izin, Üİ=Ücretsiz izin, Mİ=Mazeret izni, İİ=İdari izin, 0=çalışmadı. |
| `I` Araç Çalışma İG | `X` | |
| `J` Araç Çalışma İGD | 0,5 / 1 | |
| `P` Fazla Mesai (saat) | 0,5 … 24 (0,5 adım) | |
| `R` Resmi Tatil | 0,5 / 1 | |
| `Q`, `T` Hafta Tatili, Konaklama | `X` | |
| `S` Dış Görev | **doğrulama yok**; `X` veya sayı (259 hücre `0.66`, 33 hücre `X`) | [SORU S6] |
| `P5`, `S5` | ay listesi, yıl listesi (2019-2052) | |

---

## 1. Veri akışı (Excel'deki hali)

```
KURUM
 plaka sayfası (günlük giriş) ─┬─> Sürücü Puantaj (EK-4 görünümü)
                               └─> HAKEDİŞ (plaka başına aylık özet; S,X elle sütunları)
                                        │  elle kopyala-yapıştır (+ elle fazla mesai dağıtımı)
                                        ▼
FİRMA
 Giriş (değer + parametre bloğu X:AD) ─┬─> 41 plaka hakediş formu ─> ÖN TABLO ─> fatura özeti (V48:V58)
                                       ├─> Sürücü Faaliyet (brüt→net) ─> Bordro Tutar
                                       └─> Araç Faaliyet
```

Takvim (Günler/Tatil) **hiçbir tutarı doğrudan etkilemiyor**: plaka sayfalarındaki gün sınıflama sütunları (`V:AB`, `C`) yalnız koşullu biçimlendirme (hafta sonu/tatil renklendirme) ve gün sayısı bilgisi için; `HAKEDİŞ` ve `Sürücü Puantaj` bu hücrelere referans vermiyor. Araç çalışma günü (İG) gerçekte **elle `X` işaretiyle** giriliyor. Yeni uygulamada takvim, günlük forma varsayılan değer ve uyarı olarak girecek.

---

## 2. KURUM DOSYASI KURALLARI (Aşama 1)

### 2.1 Takvim sınıflaması (`Günler`, plaka `V:AB`)
Bir tarih `d`, Excel `WEEKDAY(d)` (1=Pazar … 7=Cumartesi) ile:

| Kod | Kural |
|---|---|
| `RT` Resmi tatil | `d` ∈ `Tatil!B5:B107` (hafta günü fark etmez) |
| `DB` Dini bayram | `d` ∈ `Tatil!G5:G116` |
| `RTA` Resmi tatil arifesi | `d` ∈ `Tatil!D5:D20` (28 Ekim) **ve** `WEEKDAY>1` (Pazar değil); `Seçim=2` ise ek olarak `WEEKDAY<7` (Cumartesi değil) |
| `DBA` Dini bayram arifesi | `d` ∈ `Tatil!I5:I36` ve aynı hafta günü koşulları |
| `Ctesi` | `WEEKDAY=7` ve aynı gün `RT` ve `DB` yok |
| `Pzr` | `WEEKDAY=1` ve aynı gün `RT` ve `DB` yok |
| `X` Hafta içi iş günü | D:I sütunlarında hiçbir bayrak yoksa (yani Pzt-Cum, tatil/arife değil) |

> Not: `Ctesi` ve `Pzr` kontrolü yalnız `RT`/`DB`'ye bakıyor, `RTA`/`DBA`'ya bakmıyor (bkz. T4).
> Sabit aralık sınırları (`$B$5:$B$107`, `$D$5:$D$20`, `$G$5:$G$116`, `$I$5:$I$36`): 2028 ve sonrası için tablo genişletilmeden çalışmaz → Ayarlar'da yıl bazlı tatil yönetimi gerekecek.

Ağırlık tablosu (`'iş günü'!V12:W17`): RTA=**1**, RT=1, DBA=**0,5**, DB=1, Ctesi=`IF(Seçim=1.0, 1)`, Pzr=1.
Ayın toplam iş günü (`T25`):
- `Seçim=1`: `Hİ + Cts + RTA×W(RTA) + DBA×W(DBA)`
- `Seçim=2`: `Hİ + RTA×W(RTA) + DBA×W(DBA)`
Ağustos 2026 (Seçim=2): Hİ=21, Cts=5, Pzr=4 (30 Ağu Pazar ama RT olduğu için RT'ye gider), RT=1, toplam iş günü = **21**.

### 2.2 Plaka sayfası (günlük satırlar 8-38, bir ay en fazla 31 gün)
Sütunlar ve anlamı:

| Sütun | Anlam | Kaynak |
|---|---|---|
| B | Tarih | `B8 = DATE(YılS, ay_no, 1)`; `B9..B38`: ayın o gününü, ay biterse `""` üretir |
| C | Gün bayrak metni | `=Y&Z&AA&AB` (bilgi) |
| D | Görevli personel / ziyaret yeri notu | serbest metin |
| E | Görevli gidilen yer | serbest metin |
| F, G | Çıkış KM, Dönüş KM | elle |
| H | Satır KM | `=G−F` |
| I | Araç çalışma İG | elle `X` |
| J | Araç çalışma İGD | elle 0,5 / 1 (iş günü dışında araç kullanımı) |
| K | Sürücü çalışma durum kodu | elle (0, X, R, Sİ, Üİ, Mİ, B, İİ) |
| L | Yemek | `=AP×IF(OR(S="x",T="x"),0,1)` |
| M | Yol | **aynı formül** — ama bkz. T2 |
| N, O | Çıkış/Dönüş saati | elle, **hiçbir hesaba girmiyor** (bilgi) |
| P | Fazla mesai (saat) | elle |
| Q | Hafta tatili çalışması | elle `X` |
| R | Resmi tatil çalışması | elle 0,5 / 1 |
| S | Dış görev | elle `X` (=1 gün) **veya** sayı (0,66) |
| T | Konaklama | elle `X` |
| AP | Yemek/yol hak günü | `=IF(OR(K="X",K="B"),1,0)` |
| AQ | Gün var mı | `=IF(ISTEXT(B),0,1)` (ay gün sayısı için) |

Not: `COUNTIF(...,"x")` büyük/küçük harf duyarsızdır.

Toplam satırı 39:
| Hücre | Formül |
|---|---|
| H39 | `SUM(H8:H38)` |
| I39 | `COUNTIF(I8:I38,"x")` |
| J39 | `SUM(J8:J38)` |
| K39 | `COUNTIF(K8:K38,"x")` (**yalnız X; B sayılmaz** — T6) |
| L39, M39 | `SUM` |
| P39, R39 | `SUM` |
| Q39, T39 | `COUNTIF(…,"x")` |
| S39 | `SUM(S8:S38)+COUNTIF(S8:S38,"x")` |
| AQ39 | `SUM(AQ8:AQ38)` = ayın gün sayısı |

"Puantaja esas toplam veriler" (satır 41):
| Hücre | Anlam | Formül |
|---|---|---|
| F41 | Araç çalışma | `SUM(I39:J39)` (İG + İGD) |
| G41 | Sürücü çalışma | `K39` |
| H41 | Toplam KM | `MAX(F8:G38) − MIN(F8:G38)` (ay boyunca en büyük − en küçük kilometre) |
| I41 | Hizmet içi KM | `H39` (satır KM toplamı) |
| J41 | Harici KM | `H41 − I41` |
| K41 | Yemek günü | `L39` |
| L41 | Yol günü | `M39` |
| M41 | Fazla mesai saat | `P39` |
| N41 | Hafta tatili gün | `Q39` |
| O41 | Resmi tatil gün | `R39` |
| P41 | Dış görev gün | `S39` |
| Q41 | Konaklama gün | `T39` |

### 2.3 `Sürücü Puantaj` (EK-4)
Sürücü `i` (1..41): durum satırı `10+2(i−1)`, mesai satırı `11+2(i−1)`; `C:AG` = gün 1-31. Gün 29-31 hücreleri `=IF('34GDY157'!AQ(36|37|38)=1, değer, "")` (kısa aylarda boş).
| Sütun | Formül (durum satırı) |
|---|---|
| AH Çalışılan gün | `COUNTIF(C:AG,"B")+COUNTIF(C:AG,"X")` |
| AI Raporlu | `COUNTIF(…,"R")` |
| AJ İzin | `Üİ + Sİ + Mİ + İİ` sayıları |
| AK Çalışılmayan | `COUNTIF(…,0)` (boş hücreler referans yoluyla 0 gelir, kayıt yok = çalışılmadı) |
| AL Toplam gün | `'34GDY157'!AQ39` |
| AM Fazla çalışma saati | `plaka!M41 + plaka!N41 × 7.5` (**7,5 sabit**, T5) |
| AN Resmi tatil gün | `plaka!O41` |
| AO Yemek | `plaka!K41` |
| AP Yol | `plaka!L41` |
| AQ Dış görev | `plaka!P41` |
| AR Konaklama | `plaka!Q41` |
Kontrol: `AH+AI+AJ+AK = AL`. Bu sayfa **aşağı akışta kullanılmıyor** (HAKEDİŞ doğrudan plakadan alıyor), sadece resmi imzalı belge.

### 2.4 `HAKEDİŞ` (satır `2..42` = Giriş satır `3..43`)
| Sütun | Anlam | Formül |
|---|---|---|
| A, B | Plaka, Sürücü | `Giriş!A,B` |
| C | Araç çalışma (İG) | `plaka!I39` |
| D | Araç çalışma (İGD) | `plaka!J39` |
| E | Sürücü çalışma | `plaka!G41` |
| F | Kapanış KM | `MAX(plaka!F8:G38)` |
| G | Hizmet içi KM | `plaka!I41` |
| H | Fazla mesai | `plaka!M41` |
| I | Hafta tatili (gün) | `plaka!N41` |
| J | Resmi tatil | `plaka!O41` |
| K | Dış görev | `plaka!P41` |
| L | Konaklama | `plaka!Q41` |
| M | Yemek | `plaka!K41` |
| N | Yol | `plaka!L41` |

**Elle çalışma sütunları (S:AA)** — Aşama 2'ye giden fazla mesai buradan çıkıyor:
| Sütun | Formül / değer | Not |
|---|---|---|
| S | elle sayı (32 satırda ≠0, toplam 244) | anlamı bilinmiyor [SORU S7] |
| T | `H + 7.5×I` | ham toplam mesai saati (hafta tatili günleri × 7,5) |
| U | `S + T` | toplam 1293,5 |
| W | `ROUND(1000/1288, 2) × U` | **1000 ve 1288 sabit** → 0,78×U |
| X | elle sayı, **toplamı tam 1000** | kurumun onayladığı nihai mesai (havuz sınırı?) |
| Y | `X − 7.5×I` | **= firma Giriş "FAZLA MESAİ" (Q)** — 41/41 satırda doğrulandı |
| AA | `U − X` | fark |
| `I44` | `I43×7.5 + H43` | |
| `S45`,`S46` | serbest not metni | not (iki plaka için düzeltme hatırlatması) |

**Firma Giriş'e aktarım eşlemesi** (`HAKEDİŞ` → firma `Giriş`; 41/41 satır karşılaştırıldı, **yalnız fazla mesai farklı**):
`C→L, D→M, E→N, F→O (Kapanış KM), G→P (Hizmet içi KM), Y→Q (Fazla mesai), I→R, J→S, K→T, L→U, M→V, N→W`.
Yani firma tarafına giden fazla mesai **ham puantaj mesaisi değil**, `X − 7.5×HT`'dir; 35 plakada HAKEDİŞ!H ile firma Giriş!Q farklıdır.

---

## 3. FİRMA DOSYASI KURALLARI (Aşama 2)

### 3.1 Firma `Giriş` sayfası
Satır `2..42` = 41 plaka. Sütunlar: `A` Plaka · `B` Sürücü · `C` Marka/Model · `D` Model yılı · `E` Araç tipi · `F` Görev yeri · `G` Yakıt tüketim oranı (lt/km: binek 0,08, kamyonet 4+1 0,10, kamyonet 5+1/4x4/6+1 0,12, minibüs 0,14, kamyon 0,30) · `H` Araç kira bedeli (binek 12.750, kamyonet 78.000, kamyon 222.000) · `I` Önceki ay kapanış KM · `J` Hizmet dışı gün sürücü · `K` Hizmet dışı gün araç · `L:W` Aşama 1'den gelen değerler (bölüm 2.4 eşleme).

Sağ blok `X:AD` (parametreler):
| Hücre | Anlam | Değer |
|---|---|---|
| `X2:X4` / `Z2:Z4` | İmza: Kontrol, Üye, Üye (ad / unvan) | metin |
| `Z7:Z11` | Yüklenici firma, İhale, Sözleşme, İşe başlama, **Hakediş tarihi** (`Z11`=2026-08-01, ay gün sayısını da belirler) | metin/tarih |
| `X16:AD16` | **a1, a2, b1, b2, b3, c, Sabit katsayı (B)** | 0,5; 0; 0; 0; 0,03; 0,47; 0,9 |
| `X18:AC18` | **Go, Gn, Io, In, Mo, Mn** (Yi-ÜFE temel/güncel, asgari ücret temel/güncel, malzeme-ekipman temel/güncel) | 5145,36; 5781,74; 33030; 33030; 3726,74; 4036,91 |
| `AD18` | Asgari ücret farkı (M26'ya gider) | 0 |
| `AD19` | EPDK akaryakıt (motorin) fiyatı | 64,52083 |
| `AD21:AD28` | **Sürücü ücretleri**: sürücü ücreti `AD21` = `75233.62−771.63` (formül içi sabit), resmi tatil 1912,93, hafta tatili saati 382,60, fazla çalışma saati 382,60, konaklama 2700, dış görev 1000, yemek 337,50, yol 408,75 | |
| `AD29`, `AC29` | Konaklama KDV/tevkifat eşiği 12.000, oran 10 | |
| `AD31:AD37` | **Sürücü ücretleri fiyat farkı hesabı** (aynı değerler; `AD31=75233.62−771.63`) | |
| `AD39:AD47` | **Operatör ücretleri** (kamyon): ücret `AD39` = `87986.51−771.63`, resmi tatil 2338,02, hafta tatili 467,60, fazla çalışma 467,60, konaklama 2700, dış görev 1000, yemek 337,50, yol 408,75, eşik 12000 | |
| `AD49:AD55` | **Operatör fiyat farkı hesabı** (`AD49=87986.51−771.63`; 2338,02; 467,60; 467,60; 1000; 337,50; 408,75) | **hiçbir yerden kullanılmıyor** (T10) |
| `Q43`, `R43`, `R44`, `S44` | `Q43=Σ fazla mesai`, `R43=Σ hafta tatili gün`, `R44=R43×7.5`, `S44=Q43+R44` → 1000 (havuz kontrolü) | |
| `AG24` | `=89.43*1.23755` | artık hücre |

### 3.2 Plaka hakediş formu (her plaka için, `Giriş` satırı `r`)
Girdiler: `G15=Giriş!I` (önceki ay kapanış), `G16=Giriş!O` (kapanış), `G17=Giriş!P` (hizmet içi KM), `I17=Giriş!K` (araç hizmet dışı gün), `L7=Giriş!G` (tüketim), `L8=Giriş!AD19` (EPDK), `L9=Giriş!H` (kira), `C15..C20`=a1,a2,b1,b2,b3,c; `E15..E20`=Go,Gn,Io,In,Mo,Mn; `K20=Giriş!AD16`.

**Akaryakıt yansıtma (hizmet dışı KM)**
```
G19 = G16 − G15 − G17                      (hizmet dışı km)
I15 = ROUND(1 × (G19 × L7 × L8), 2)        (3 plakada çarpan 2 — T11)
K44 = ROUND(I15,2);  K45 = ROUND(K44×0.2, 2);  K46 = ROUND(K44+K45, 2)
```
**Araç kira + fiyat farkı**
```
I18 = I17 × L9 / 30                          (yuvarlama YOK)
M19 = ROUND( C15 + ROUND(C19×(E16/E15),5) + ROUND(C20×(E20/E19),5), 5 )   Fiyat farkı katsayısı Pn
M20 = ROUND( (L9 − I18) × (M19 − 1) × K20, 2 )
K35 = ROUND( L9 − I18 + M20, 2 )             Araç kiralama
K36 = ROUND(K35 × 0.2, 2)
K37 = ROUND(K36 × 0.5, 2)                    5/10 tevkifat
K38 = ROUND( K35 + K36 − K37, 2 )
```
Not: sayfanın üstündeki formül açıklaması `a2·İn/İo + b1·AYn/AYo + b2·Yn/Yo` terimlerini içeriyor ama **hücre formülü yalnız a1, b3·(Gn/Go), c·(Mn/Mo)** terimlerini hesaplıyor (T9). a2=b1=b2=0 olduğu için bugün sonuç aynı.

**Sürücü kalemleri** (`B26:I26` birim fiyat, `B27:I27` miktar, `B28:I28` tutar)
| Kalem | Fiyat (satır 26) | Miktar (satır 27) | Tutar (satır 28) |
|---|---|---|---|
| B Fazla çalışma (saat) | `Giriş!AD24` | `Giriş!Q` | `ROUND(B26×B27, 2)` |
| D Hafta tatili (saat) | `Giriş!AD23` | `7.5 × Giriş!R` | `ROUND(D26×D27, 2)` |
| E UBGT (gün) | `Giriş!AD22` | `Giriş!S` | `ROUND(E26×E27, 2)` |
| F Dış görev (gün) | `Giriş!AD26` | `Giriş!T` | `ROUND(F26×F27, 2)` |
| G Konaklama (gün) | `Giriş!AD25` (**7 plakada elle sabit**, T12) | `Giriş!U` | `ROUND(G26×G27, 2)` |
| H Yemek | `Giriş!AD27` | `Giriş!V` | `ROUND(H26×H27, 2)` |
| I Yol | `Giriş!AD28` | `Giriş!W` | `ROUND(I26×I27, 2)` |

```
K26 = Giriş!AD21 − (Giriş!AD27×22 + Giriş!AD28×22)          Sürücü ücreti (yemek-yol hariç) — 22 gün SABİT (T8)
      (06 FAT 348 operatör: AD39 − (AD45×22 + AD46×22))
L26 = (K20×(M19−1)) × ( AD31 + B27×AD34 + D27×AD33 + E27×AD32 + H27×AD36 + I27×AD37 − (AD31/30)×Giriş!J )
      İşçilik fiyat farkı; YUVARLAMA YOK. Dış görev ve konaklama fiyat farkına girmez.
      (06 FAT 348 de aynı AD31..AD37 bloğunu kullanıyor — T10)
M26 = Giriş!AD18                                           Asgari ücret farkı
K28 = ROUND( K26 + L26 + M26 + B28 + D28 + E28 + F28 + H28 + I28, 2 )   Toplam sürücü ücreti (G28 konaklama DAHİL DEĞİL)
```
Fatura bloğu:
```
K31 = ROUND(K28, 2)           Toplam işçilik
K32 = ROUND(K31×0.2, 2)      KDV %20
K33 = ROUND(K32×0.9, 2)      Tevkifat 9/10
K34 = ROUND( K31 + (K32 − K33), 2 )
K39 = G28                    Konaklama (KDV hariç)
K40 = 'ÖN TABLO'!R(satır)    Konaklama KDV
K41 = ROUND(K39+K40, 2)
K42 = ROUND(K31 + K35 + K39, 2)    KDV'siz genel toplam
K43 = ROUND(K34 + K38 + K41, 2)    Ödenecek genel toplam
```
(`0.2`, `0.9`, `0.5` formül içinde sabit.)

### 3.3 `ÖN TABLO` (satır `6..46`, plaka başına 1 satır; sıra kurum `Giriş` sırası)
| Sütun | Formül (plaka sayfası `P`) |
|---|---|
| B:E | `Giriş!B, F, E, A` (sürücü, görev yeri, araç tipi, plaka) |
| F Sürücü ücreti | `ROUND(P!K28 − P!L26 − P!M26 − P!F28, 2)` (**L26 yuvarlanmamış haliyle çıkarılır**) |
| G İşçilik fiyat farkı | `ROUND(P!L26, 2)` |
| H Asgari ücret farkı | `ROUND(P!M26, 2)` |
| I İşçilik toplamı | `P!K28` |
| J İşçilik KDV | `P!K32 − P!K33` |
| K İşçilik genel toplam | `P!K34` |
| L Araç kiralama bedeli | `P!L9 − P!I18` |
| M Araç fiyat farkı | `P!M20` |
| N Araç kiralama toplamı | `P!K35` |
| O Araç KDV | `P!K36 − P!K37` |
| P Araç genel toplam | `P!K38` |
| Q Konaklama | `P!K39` |
| R Konaklama KDV | `IF($Q$47 >= ROUND(Giriş!AD29/1.01, 2), ROUND(Q×0.01, 2), ROUND(Q×0.1, 2))` |
| S Konaklama genel | `P!K41` |
| T Dış görev | `P!F28` |
| U Akaryakıt yansıtma (KDV hariç) | `P!I15` |
| V KDV hariç genel | `P!K42` |
| W KDV dahil genel | `P!K43` |

Toplam satırı 47:
```
F,G,H,L,M,T,U,V = SUM
I47 = ROUND(SUM(I6:I46),2);  J47 = ROUND(I47×0.2, 2) − ROUND(I47×0.2×0.9, 2)
K47 = ROUND(I47+J47, 2)
N47 = ROUND(SUM(N),2);  O47 = ROUND(N47×0.2, 2) − ROUND(N47×0.2×0.5, 2);  P47 = ROUND(N47+O47,2)
Q47 = ROUND(SUM(Q),2);  S47 = ROUND(Q47+R47, 2)
W47 = P47 + K47 + S47;  X47 = V47 − T47 − Q47
```
Fatura özeti (`V48:V58`):
```
V48 = I47   (işçilik)          V49 = N47 (araç)         V50 = Q47 (konaklama)
V51 = ROUND(V48×0.2, 2)         V52 = ROUND(V49×0.2, 2)    V53 = ROUND(V50×0.1, 2)
V54 = ROUND(V51×0.9, 2)         V55 = ROUND(V52×0.5, 2)
V56 = IF(Q47 >= ROUND(Giriş!AD29/1.01, 2), ROUND(V53×0.9, 2), 0)   (konaklama tevkifatı)
V57 = V48+V51−V54+V49+V52−V55+V50+V53−V56   (Fatura toplamı)  [= W47 olmalı]
V58 = ROUND( SUM(G47,H47,M47,Q47,T47) × 0.00948 , 2 )          Damga vergisi kesintisi
```
Konaklama tevkifatı kuralı: plaka bazında değil **toplam** konaklama (`Q47`) `12000/1.01 = 11881.19` TL eşiğini aşıyorsa KDV'nin 9/10'u tevkif edilir (net %1), aşmıyorsa %10 KDV tevkifatsız. Mevcut: `Q47=20196.42` → tevkifatlı.

### 3.4 `Sürücü Faaliyet` (brüt → net)
Satır `i+1`, `Giriş` satır `i+1` (i=1..41). Sembol: `Asg = Giriş!AA18` (brüt asgari ücret; **aslında "In" endeks hücresi**, T13).

Girdiler: `C=Giriş!N` çalışma günü · `D=Giriş!S` resmi tatil · `E=Giriş!R` hafta tatili gün · `F=7.5×E` · `G=Giriş!Q` fazla mesai · `H=F+G` toplam fazla mesai · `I=Giriş!U` konaklama · `J=Giriş!T` dış görev · `K=Giriş!V` yemek · `L=Giriş!W` yol · `AP=Giriş!J` hizmet dışı gün.
Elle/satır başına: `X` Emekli mi? (Evet/Hayır) · `Y` **önceki aylar kümülatif GV matrahı (elle sabit)** · `AK` çalışma ayı (40 satır 8, bir satır 4) · `AM` özel sigorta (0).

Gün düzeltmesi:
```
AO = DAY(EDATE(Giriş!Z11, 1) − DAY(Giriş!Z11))   ay gün sayısı (31)
AQ = AO − AP ;  AR = IF(AP>0, 30 − AQ, 0)        kesinti günü
```
Kalemler (hepsi satır başına):
```
P  Temel ücret   = ROUND(Asg×1.35, 2) × ((30 − AR)/30)            (06 FAT 348: ×1.65)
Q  Resmi tatil   = ROUND(Asg×1.35/30 × D, 2)                      (×1.65)
R  Fazla mesai   = ROUND(Asg×1.35/225 × 1.5 × H, 2)               (×1.65)
S  Konaklama     = ROUND( IF(plaka!G26 = Giriş!AD25, plaka!G28×1.1, plaka!G28×1.12), 2 )
T  Dış görev     = J × Giriş!AD26                                 (yuvarlama yok)
U  Yemek         = ROUND(330.3 × K, 2)
V  Yol           = ROUND(330.3 × L, 2)
W  Brüt toplam   = ROUND(SUM(P:V), 2)                             (S dahil)
Z  SGK istisna   = ROUND(300 × K, 2)                              (yemek istisnası)
AA SGK matrahı   = ROUND(W − S − Z, 2)
AD SİP/SGPD      = ROUND( IF(X="HAYIR", AA×14%, AA×7.5%), 2 )
AE İşsizlik      = ROUND( IF(X="HAYIR", AA×1%,  AA×0%), 2 )
AB GVM aylık     = ROUND(W − S − Z − AD − AE, 2) − AM
AC GVM yıllık    = ROUND(Y + AB, 2)                               (kümülatif)
AL Vergi indirimi= VLOOKUP(AK, $AS$2:$AT$13, 2, FALSE)
AG Gelir vergisi (hesap)  : K = Y+AB
        K <  AN5(190000)                         → AB×0.15 − AL
        Y < AN5 < K                              → (AN5−Y)×0.15 + (K−AN5)×0.20 − AL
        AN5 < K < AN6(400000) (ve Y ≥ AN5)       → AB×0.20 − AL
        Y < AN6 < K                              → (AN6−Y)×0.20 + (K−AN6)×0.27 − AL
        aksi                                     → AB×0.27 − AL
        sonuç ROUND(.,2)
AF Gelir vergisi = IF(AG<0, 0, AG)
AI Damga (hesap) = ROUND( (W − Z − Asg) × 0.00759 , 2 )
AH Damga vergisi = IF(AI<0, 0, AI)
AJ Ödenecek tutar= W − AD − AE − AF − AH                          (yuvarlama YOK ama bileşenler 2 hane)
```
Vergi indirimi tablosu (`AS2:AT13`, ay no → tutar):
- ay 1-6: `ROUND(Asg×0.85×0.15, 2)` = 4211,33
- ay 7: `ROUND((AN5 − AW7)×0.15 + (AW8 − AN5)×0.20, 2)` = 4537,75 (kümülatif asgari matrah dilim geçişi)
- ay 8-12: `ROUND(Asg×0.85×0.20, 2)` = 5615,10
- `AV = ROUND(Asg×0.85, 2)` aylık asgari net matrah, `AW` kümülatif toplam.
Hücre `AK` (çalışma ayı) bu tabloyu seçer.

Toplam: `AJ43 = ROUND(SUM(AJ2:AJ42),2)` = 2.234.797,22; `W45 = SUM(W)`.
`W48 = W42 − 2003.82` ve `AX14:AY29` bloğu: el hesabı (karalama) — taşınmayacak.

### 3.5 `Araç Faaliyet` (satır 2-42)
`A,B = Giriş!A,B` · `C = plaka!G16 − plaka!G15` (toplam KM) · `D = 'ÖN TABLO'!N` · `E = 'ÖN TABLO'!F` · `F = 'ÖN TABLO'!U` (hizmet dışı kullanım = yakıt yansıtma) · `G = plaka!G16` · `H = 'Sürücü Faaliyet'!AC` ("KMLTF", T14).

### 3.6 `Bordro Tutar`
- `A1:A41`: sürücü adları **elle alfabetik sıralanmış**; `C`: **yapıştırılmış değerler**; `B = VLOOKUP(A, 'Sürücü Faaliyet'!B2:AJ42, 35, 0)` = `AJ` (ödenecek net); `G` orijinal sıra; `H = VLOOKUP(G, A1:E44, 2, FALSE)`.
- `B42 = SUM(B)`=2.234.797,22; `C42` elle yazılmış 2.234.797,22; `C43 = SUM(C)` = 2.234.797,20.
- Formül (B) ile yapıştırılan (C) arasında **12 satırda ±0,01 TL fark** (T15).
- Eşleştirme adla yapılıyor (sondaki boşluklar dahil, ör. bir adın sonunda boşluk var) → yeni sistemde sürücü kimliğiyle eşleştirme.

---

## 4. YENİ MODELİN KURALLARI (tasarım gereği, Excel'den farklı olan yerler)

1. **Günlük kayıt = (tarih, sürücü, araç)**. Bir günde bir sürücü birden çok araç, bir araç birden çok sürücü olabilir.
2. **Sürücüye yazılan**: durum kodu (X,B,R,Sİ,Üİ,Mİ,İİ,0), fazla mesai saat, hafta tatili, resmi tatil, dış görev, konaklama, yemek, yol.
3. **Araca yazılan**: çıkış/dönüş KM, araç çalışma İG/İGD.
4. Aylık araç özeti: İG, İGD, hizmet içi KM = Σ satır KM, kapanış KM = max KM, toplam KM = max − min (Excel formülü) — çok sürücülü araçta KM'ler tüm sürücülerin satırlarından birleşir.
5. Aylık sürücü özeti: sürücü çalışma (`X` sayısı; `B` ayrı bkz. T6), mesai, HT, RT, dış görev, konaklama, yemek, yol.
6. Aşama 2 plaka formunda **sürücü kalemleri sürücünün ana (varsayılan) aracının formuna** yazılır, KM/araç kalemleri aracın formuna [SORU S12].
7. Takvim: `Tatil` verisi + `Seçim` Ayarlar'dan; gün sınıflaması 2.1'e **birebir** uygulanır.
8. Hesap motoru saf TypeScript; `ROUND` Excel'deki gibi *ondalık* yuvarlama (yarım yukarı, işaret uzağa), ara değerler çift duyarlıklı sayı, yuvarlama noktaları bu belgedeki formül sırasıyla.

---

## 5. PARAMETRE ENVANTERİ (koda gömülmeyecek, Ayarlar'da dönem bazlı)

| # | Parametre | Excel'deki yeri / değeri | Önerilen ayar | Kapsam |
|---|---|---|---|---|
| P1 | Cumartesi iş günü mü (`Seçim`) | `'iş günü'!U5`=2 | `takvim.cumartesiIsGunu` | dönem |
| P2 | Gün ağırlıkları RTA/RT/DBA/DB/Pzr | `V12:W17` = 1/1/0,5/1/1 | `takvim.agirlik.*` | dönem |
| P3 | Tatil listeleri (4 tablo) | `Tatil` 2012-2027 | tatil tablosu (tarih, tür, ad) | yıl |
| P4 | Günlük çalışma saati (HT→saat) | 7,5 (5 yerde: `D27`, `F`, `AM`, `T`, `Y`) | `puantaj.haftaTatiliSaat` | dönem |
| P5 | Fiyat farkı ağırlıkları a1,a2,b1,b2,b3,c, B | `Giriş!X16:AD16` | `fiyatFarki.*` | dönem |
| P6 | Endeksler Go,Gn,Io,In,Mo,Mn | `Giriş!X18:AC18` | `endeks.*` | dönem |
| P7 | EPDK motorin fiyatı | `Giriş!AD19` | `yakit.epdk` | dönem |
| P8 | Sürücü / operatör ücret tabloları (ücret, RT, HT, FM, konaklama, dış görev, yemek, yol) | `AD21:AD28`, `AD31:AD37`, `AD39:AD46`, `AD49:AD55` | `ucret.surucu.*`, `ucret.operator.*` | dönem |
| P9 | Sürücü ücreti `75233.62−771.63`, operatör `87986.51−771.63` | formül içi sabit | iki ayrı değer (brüt ve düşüm) | dönem |
| P10 | Aylık sabit gün çarpanı 22 (yemek+yol düşümü) | `K26` | `ucret.yemekYolGun` | dönem |
| P11 | Kira ay bölen 30 | `I18`, `L26` | `kira.aylikGun` | dönem |
| P12 | KDV %20/%10, tevkifat 9/10, 5/10, konaklama eşiği 12.000, %1 net | `K32…`, `ÖN TABLO R`, `V51:V56` | `vergi.kdv.*`, `vergi.tevkifat.*` | dönem |
| P13 | Damga vergisi (hakediş) 0,00948 | `V58` | `vergi.damgaHakedis` | dönem |
| P14 | Araç kira bedeli, yakıt tüketim oranı | `Giriş!G,H` | araç kartı + dönem override | araç+dönem |
| P15 | İhale/sözleşme/işe başlama/hakediş tarihleri, imzacılar, firma adı | `Giriş!Z2:Z11` | `sozlesme.*`, `imza.*` | dönem |
| P16 | Brüt asgari ücret (bordro) | `Giriş!AA18` (endeks hücresi!) | **ayrı** `asgariUcret.brut` | dönem |
| P17 | Bordro çarpanları 1,35 / 1,65 (operatör), 225, 1,5, 30 | `Sürücü Faaliyet P,Q,R` | `bordro.*` | dönem |
| P18 | Yemek/yol bordro günlük tutarı 330,3 (= asgari×0,3/30), yemek istisnası 300/gün | `U,V,Z` | `bordro.yemekYol.*` | dönem |
| P19 | SGK işçi payı 14%, emekli 7,5%, işsizlik 1% | `AD,AE` | `sgk.*` | dönem |
| P20 | Gelir vergisi dilimleri (190.000 / 400.000; %15/%20/%27) | `AN5,AN6`, formül | `gv.dilimler` (üst dilim sayısı sınırsız) | **yıl** |
| P21 | Vergi indirimi/asgari ücret GV istisnası tablosu (ay 1-12) | `AS2:AT13`, `AV`, `AW` | hesaplanan tablo | dönem |
| P22 | Damga vergisi (bordro) 0,00759 ve istisna = asgari ücret | `AI` | `bordro.damga` | dönem |
| P23 | Konaklama KDV çarpanı 1,10 / 1,12 | `S` | `konaklama.kdvCarpan.*` | dönem |
| P24 | Sürücü: Emekli mi?, kümülatif GVM (açılış), çalışma ayı, özel sigorta | `X,Y,AK,AM` | sürücü kartı + aylık otomatik devir | sürücü |
| P25 | Başlık metinleri (kurum / bölge adı vb.) | sayfa başlıkları | `kurum.*` | genel |

---

## 6. TUTARSIZLIKLAR / ŞÜPHELİ YERLER

| # | Yer | Bulgu | Etki | Önerim |
|---|---|---|---|---|
| T1 | Kurum/Firma | Plaka sayısı **41**, 43 değil. | — | [S1] |
| T2 | Kurum plaka `M` (Yol) | Yol sütunu formüllüdür ama **218 hücre (29 plaka) elle `0` ile ezilmiş**. `Yol gün` < `Yemek gün` olan plakalar bu yüzden. | Doğrudan tutarı değiştirir | Günlük "yol hakkı" işaretini açıkça modelle (varsayılan = yemek hak günü) [S5] |
| T3 | `iş günü` W12 | RTA ağırlığı **1**; `Tatil` başlığı "Arefe: 0,5 gün". DBA=0,5. Ağırlık iş günü toplamına **ekleniyor**, "tatil süresi" gibi etiketli. | Ağustosta etkisiz (arefe yok) | [S3] |
| T4 | `Günler/plaka D,E` | Cumartesi/Pazar kontrolü `RTA`/`DBA`'yı hesaba katmıyor. `Seçim=1` iken Cumartesi'ye denk gelen arefe günü hem `Ctesi` hem `RTA` sayılır → **çift sayım**. | `Seçim=2`'de oluşmaz | Testte Seçim=2; Seçim=1 için hata düzeltmeli mi? [S2] |
| T5 | 7,5 sabit | `AM=M41+N41×7.5`, `HAKEDİŞ T/Y`, firma `D27`, `F` | Hafta tatili günü→mesai saati | P4 olarak ayara |
| T6 | `K39` ve `B` kodu | `K39 = COUNTIF("x")` yalnız X'i sayar; `Sürücü Puantaj AH` X+B sayar; yemek/yol `B`'yi hak sayar. Verilerde `B` hiç yok. | `B` kullanılırsa HAKEDİŞ!E ile EK-4 çelişir | [S4] |
| T7 | `HAKEDİŞ W` | `ROUND(1000/1288, 2)×U`: 1000 ve 1288 sabit. | W sütunu aşağı akışta kullanılmıyor | [S7] |
| T8 | Firma `K26` | **22 gün sabit** (`AD27×22 + AD28×22`); sürücünün hizmet dışı günü fatura ücretini düşürmüyor (yalnız fiyat farkı ve bordro düşüyor). | Fatura vs bordro tutarsızlığı | [S9] |
| T9 | Plaka `M19` | Formül yalnız a1, b3, c terimlerini içeriyor; a2/b1/b2 yok. | Bugün etkisiz (ağırlıklar 0) | Genel formülle yaz, ağırlık 0 iken aynı sonuç [S10] |
| T10 | `06 FAT 348` | Operatör ücret bloğu `AD39:AD46` kullanıyor (doğru) ama **fiyat farkı `L26` sürücü bloğu `AD31:AD37`** ile hesaplanıyor; `AD49:AD55` (operatör fiyat farkı bloğu) hiç kullanılmıyor. | Fiyat farkı tutarı (4.255,28) etkilenir | [S11] |
| T11 | `I15` çarpan | 3 plakada (`20 AEK 841`, `06 EHT 745`, `34 CTK 499`) `2×(G19×L7×L8)`, diğer 38'de `1×`. Bu üçünde `G19=0` olduğu için bugün etkisiz. | Gizli | [S13] |
| T12 | Plaka `G26` konaklama birim fiyatı | 7 plakada `Giriş!AD25` yerine elle sabit: `34 GDY 157`=2700, `06 EHT 745`=**1071,428**, `06 EHU 698`=**2410,71**, `06 EIS 817`/`06 EAL 460`/`25 ADS 708`/`06 FAT 348`=2700. `Sürücü Faaliyet S` fiyat ≠ AD25 ise tutarı ×1,12, eşitse ×1,10 hesaplıyor. | Konaklama tutarı | [S8] |
| T13 | `Sürücü Faaliyet` asgari ücret | Bordro brüt asgari ücreti **fiyat farkı endeks hücresi `Giriş!AA18` (In)**'den alınıyor; ayrıca elle kopyaları `AY14=33030`, `AY17=33030×1.35`. | Endeks güncellenirse bordro bozulur | P16 ayrı ayar |
| T14 | `Araç Faaliyet H` | Başlık "KMLTF" ama değer `Sürücü Faaliyet!AC` (kümülatif GV matrahı). | Yanlış sütun olabilir | [S15] |
| T15 | `Bordro Tutar` | 12 satırda formül ile yapıştırılan değer ±0,01 farklı; toplam `C43=2.234.797,20`, `B42=2.234.797,22`. | Ödeme tutarı | Aşağıdaki tablo, [S16] |
| T16 | `Sürücü Faaliyet M2:N42` | 74 hücre `#REF!`, başlıksız; `M2,N2` plaka `H27/I27`'e gidiyor. | Etkisiz | Taşıma |
| T17 | Kurum plaka `06 EHT 743` `C31` | `=-D35` (anlamsız formül, diğerleri `Y&Z&AA&AB`). | Etkisiz | Düzelt |
| T18 | Plaka `06 EAL 460` `H26` | Boş (diğerlerinde `=G26−F26`). | Etkisiz | — |
| T19 | Firma Giriş vs kurum Giriş | 6 plakada ana veri farklı: model yılı (`34 GDY 157`, `35 CEC 348`: kurum 2020, firma 2022), görev yeri (`06 BTE 143`, `16 BHV 238`, `06 EHU 699`), tip (`06 BTE 143`: KOMBİ↔KAMYONET (4+1); `06 FAT 348`: YSİP↔KAMYON). | Basılı belge | Tek kaynak (araç kartı) [S17] |
| T20 | `KAMTONET (5+1)` | `06 EHT 742` araç tipi her iki dosyada yazım hatası. | Basılı belge | "KAMYONET (5+1)" düzelt? [S18] |
| T21 | Plaka `G17` elle düzeltmeler | `06 EAJ 931`: `Giriş!P−19` (hizmet dışı km=19 yaratıyor), `34 CTK 634` ve `25 ADS 708`: `Giriş!P+1` (1 km'yi sıfırlıyor). | Yakıt yansıtma tutarı (örn. 147,11 TL) | Açık "hizmet dışı KM düzeltmesi" alanı + gerekçe [S14] |
| T22 | `ÖN TABLO F` | `K28 − L26(yuvarlanmamış) − M26 − F28` sonra ROUND; `G`'de L26 ayrıca ROUND. Yuvarlama sırası önemli. | ±0,01 | **Birebir korunacak** |
| T23 | `Sürücü Faaliyet AK` | Çalışma ayı 40 satırda 8, `06 FAT 348`'de 4. Vergi indirimi tablosuna giriş. | GV tutarı | [S19] |
| T24 | `Sürücü Faaliyet Y` | Kümülatif GV matrahı **elle yazılmış** (41 sabit). | Her ay elle taşınıyor | Önceki ayın `AC` değerinden otomatik devir [S19] |
| T25 | GV dilimleri | Formül yalnız %15/%20/%27 dilimlerini içeriyor; üst dilim yok; sınırlar (190.000/400.000) formül içinde. | Yıl sonuna doğru yanlış olabilir | Dilim tablosu ayardan [S20] |
| T26 | `ÖN TABLO V58` | Damga vergisi matrahı = fiyat farkları (G,H,M) + konaklama (Q) + dış görev (T); sürücü ücreti/kira matrahı dışı. | Fatura | Birebir uygula, onay [S21] |
| T27 | Bozuk adlar/koşullu biçim | 11 `#REF!` ad, bozuk koşullu biçim kuralları, dış bağlantı `[1]ay`. | — | Taşıma yok |
| T28 | `iş günü` A4:O510 | Kullanılmayan 500 satırlık tablo. | — | Taşıma yok |

### T15 ayrıntı — Bordro (formül ↔ yapıştırılan), farkı olan 12 plaka
| Plaka | Formül (AJ) | Yapıştırılan | Fark |
|---|---|---|---|
| 06 CZR 334 | 51.946,02 | 51.946,01 | +0,01 |
| 34 CTK 499 | 54.477,12 | 54.477,11 | +0,01 |
| 06 EHU 703 | 47.396,96 | 47.396,95 | +0,01 |
| 06 EIS 817 | 58.260,41 | 58.260,40 | +0,01 |
| 06 EAL 460 | 48.170,37 | 48.170,38 | −0,01 |
| 06 EJE 923 | 65.732,40 | 65.732,39 | +0,01 |
| 06 EAJ 932 | 48.822,18 | 48.822,19 | −0,01 |
| 06 EHT 742 | 49.090,62 | 49.090,63 | −0,01 |
| 34 CTK 634 | 53.644,21 | 53.644,20 | +0,01 |
| 06 EHT 743 | 54.614,33 | 54.614,34 | −0,01 |
| 35 CBD 819 | 52.647,54 | 52.647,53 | +0,01 |
| 06 EHU 698 | 62.607,14 | 62.607,15 | −0,01 |

---

## 7. SORULAR (onayınız ve cevaplarınız gerekiyor)

**Kritik (motoru etkiliyor)**
- **S1** Plaka sayısı iki dosyada da **41**. 43 beklediğiniz iki araç (veya sürücü) mü eksik?
- **S2** `Seçim`: 1 = "Cumartesi iş günüdür", 2 = "değildir" yorumu doğru mu? Tutarsızlık T4 (Seçim=1'de Cumartesi arefe çift sayımı) düzeltilsin mi, yoksa Excel gibi mi kalsın?
- **S3** Resmi tatil arefesi (28 Ekim) iş günü ağırlığı **1** mi (şimdiki hâl) yoksa başlıktaki gibi **0,5** mi? "Tatil Süreleri" tablosu iş günü ağırlığı mı, tatil süresi mi?
- **S4** `B` kodu (ulusal bayram/genel tatil günü): sürücü çalışma günü sayılsın mı (EK-4 evet, HAKEDİŞ!E hayır)? Maaşta karşılığı ne?
- **S5** **Yol** günleri: 29 plakada elle `0` yazılan günlerin kuralı nedir (servis, yakın mesafe, başka sebep)? Yeni tasarımda "yol hakkı" günlük/aylık işaret olarak mı tutulsun, sürücü kartında varsayılan mı?
- **S6** **Dış görev** `0.66`: 259 hücrede 0,66, 33'ünde `X`. 0,66 neyi ifade ediyor (gün oranı mı, saat bandı mı)? Yeni formda nasıl girilsin?
- **S7** `HAKEDİŞ S, X, W` elle sütunları: S nedir? X (toplamı tam **1000**) nasıl belirleniyor (sözleşmedeki aylık fazla mesai havuzu mu)? 1288 nereden? Uygulama X'i "orantılı dağıtım önerisi + elle düzeltme" olarak mı üretsin? Firma `Q = X − 7.5×HT` kuralı doğru mu?
- **S8** Konaklama: günlük birim fiyat sabitleri (`1071.428`, `2410.71`) ve `×1.10 / ×1.12` ayrımı hangi mantığa dayanıyor? (Fiyat KDV'li mi, konaklama vergisi %2 mi?) Birim fiyat plaka bazlı girilsin, ×1,12 kuralı ayarda mı olsun?
- **S9** Fatura sürücü ücreti `K26` **ay boyunca sabit** (22 gün düşümü) mı kalacak, yoksa hizmet dışı sürücü günü fatura ücretini de azaltacak mı (şu an yalnız fiyat farkı + bordro azalıyor)?
- **S10** Fiyat farkı katsayısına a2, b1, b2 terimleri (şu an 0) eklensin mi? (Ağırlıklar 0 iken sonuç aynı kalır.)
- **S11** `06 FAT 348` fiyat farkı operatör bloğuyla (`AD49:AD55`) mı hesaplansın (Excel şimdi sürücü bloğuyla yapıyor)? Test beklentisi Excel'in mevcut değeri olur; "düzeltmek" tutarı değiştirir.
- **S12** Çok sürücülü araç: sürücü kalemleri sürücünün ana aracı formunda, KM/araç kalemleri aracın formunda mı gösterilsin? Aynı gün iki araç kullanan sürücünün yemek/yol günü **tek** mi sayılır?
- **S13** `I15` yansıtma çarpanı 1 mi 2 mi olmalı (3 plakada 2)?
- **S14** `G17` elle düzeltmeler (`−19`, `+1`, `+1`): açık bir "hizmet dışı KM düzeltmesi" alanı olarak modelleyelim mi? (Test için Excel'deki değerler girdi olarak yüklenecek.)

**Biçim/kapsam**
- **S15** `Araç Faaliyet!H "KMLTF"` gerçekten kümülatif GV matrahı mı olmalı, yoksa kümülatif KM mi?
- **S16** `Bordro Tutar`: ödenen tutar olarak formül (`AJ`) mı, yapıştırılan (`C`) mı esas? Önerim: formül esas, 12 satır farkı rapor ekranında gösterilsin.
- **S17** Araç ana verisi tek kaynak (araç kartı) olsun; iki dosyadaki farklar (T19) hangisi doğru?
- **S18** "KAMTONET" → "KAMYONET" düzeltilsin mi?
- **S19** `Sürücü Faaliyet`: (a) Kümülatif GV matrahı (`Y`) önceki ayın `AC` değerinden otomatik taşınsın, Ocak'ta elle açılış; (b) `AK` "çalışma ayı" = ayın numarası mı (8) — `06 FAT 348` için 4 (işe başlama 1 Mayıs'a rağmen) neden?
- **S20** GV dilimleri: formülde 3 dilim var (15/20/27, sınırlar 190.000/400.000); %35 üst dilimi ve sınırı eklensin mi? Hangi yılın dilimleri?
- **S21** `ÖN TABLO V58` damga matrahı (fiyat farkları + konaklama + dış görev) böyle mi olmalı?
- **S22** Hesaplanmayan karalama/not hücreleri (`W48`, `AY14:AY29`, `AG24`, `HAKEDİŞ S45:S46`) taşınmayacak, uygun mu?
- **S23** Excel çıktı şablonu: örnek dosya şablon olarak kullanılacak; gerçek kişi adlı hâli repoya **konmayacak**. Şablonun adsız (maskeli) kopyasını oluşturmama izin var mı?
- **S24** Tatil tablosu 2012-2027; 2028+ yılları için Ayarlar'da elle mi girilecek, yoksa dini bayram günlerini ben (Diyanet takvimi) önceden doldurayım mı?

---

## 8. Doğrulama planı
- Beklenen değer kaynağı: iki Excel'in kayıtlı hücre değerleri (okuma: `exceljs`/`openpyxl`, dosyalar repoda yok, `.gitignore`).
- Test girdisi: kurum plaka sayfalarındaki günlük satırlar + firma `Giriş` elle alanları. Beklenen: `HAKEDİŞ` (41×14), plaka formları (`K26…K46`), `ÖN TABLO` (41×22 + toplamlar), `Sürücü Faaliyet` (41×~25), `Araç Faaliyet`, `Bordro Tutar`.
- Tolerans: **0** (kuruşu kuruşuna); yuvarlama noktaları bölüm 3'teki sırayla.
- Excel'deki hatalı/şüpheli davranışlar (T-listesi) kararınıza göre "Excel birebir" veya "düzeltilmiş" olarak işaretlenecek; "Excel birebir" olanlar testte Excel değerini, "düzeltilmiş" olanlar yeni beklenen değeri (farkıyla birlikte raporlanarak) kullanır.

---

## 9. KARARLAR (20.11.2026, kullanıcı onayı)
- Plaka/sürücü sayısı sabit değildir; uygulamada araç ve sürücü eklenip çıkarılabilir. Hesap **sürücü bazlıdır**; araçlar KM ve araç çalışma günü içindir.
- Dış görev `0,66` = ⅔ dış görev mesaisi (1 üzerinden). Puantajda "⅔" ve "Tam" olarak girilir; değer Ayarlar'dan değiştirilebilir.
- HAKEDİŞ sayfasındaki S, X, W, Y, AA sütunları ve 1288 sabiti yalnızca bilgi amaçlıdır; dikkate alınmaz. Aşama 2'ye giden fazla mesai = puantaj fazla mesaisi + (varsa) sürücü ayına girilen **fazla mesai düzeltmesi**. Excel içe aktarımında firma dosyasıyla aradaki fark bu alana otomatik yazılır; böylece içe aktarılan ay Excel ile birebir aynı çıkar.
- Excel'deki tüm hesaplar **birebir** uygulanır (tutarsızlık yoktur kararı). Excel'deki plakaya özel elle yazılmış değerler veri alanı olarak modellendi:
  - **Hizmet içi KM düzeltmesi** (araç ayı): G17 formüllerindeki −19 / +1 / +1
  - **Yakıt yansıtma çarpanı** (araç kartı veya araç ayı): `2×` olan 3 plaka
  - **Konaklama birim fiyatı** (sürücü ayı): 1071,428 / 2410,71. Standart fiyattan farklıysa Sürücü Faaliyet ×1,12, aynıysa ×1,10.
  - **Operatör fiyat farkı:** Excel davranışı (sürücü fiyat farkı tablosu) varsayılan; Ayarlar'dan değiştirilebilir.
- Bordro Tutar: esas olan **formül sonucudur** (Sürücü Faaliyet AJ). Yapıştırılmış değerlerdeki ±0,01 farklar kullanılmaz.
- Gelir vergisi: Excel'in 3 dilimli iç içe IF yapısı, dilim tablosuyla genelleştirildi. Ağustos 2026 verisinde 41/41 sürücüde aynı sonucu verir; dilimler Ayarlar'dan yönetilir.
- Önceki ay kapanış KM ve kümülatif GV matrahı önceki aydan otomatik gelir; elle değiştirilebilir. Kümülatif matrah Ocak ayında sıfırlanır.

## 10. Doğrulama sonucu
`npm test` — 10 test, tamamı geçti:
- **Aşama 1:** HAKEDİŞ 41×12 hücre, EK-4 özetleri, takvim sayıları
- **Aşama 2:** 41 plaka formu × 31 hesap hücresi, ÖN TABLO 41×18 + toplamlar + fatura özeti, Sürücü Faaliyet 41×33 + vergi indirim tablosu, Araç Faaliyet, Bordro Tutar
- **Uçtan uca:** Excel içe aktarma → veritabanı → hesap → Excel ile birebir; yeniden açma, yedek, geri yükleme, dönem kapatma ve kümülatif devir
- **Excel çıktısı:** üretilen dosya Microsoft Excel'de tam yeniden hesaplatıldı; W47 = 6.728.986,13 · V58 = 4.514,16 · AJ toplam = 2.234.797,22, örnekle aynı.
