@echo off
setlocal
rem Makine Ikmal Hakedis - kurulum (yonetici izni gerekmez)
rem Bu klasoru C:\Hakedis klasorune kopyalar, masaustune kisayol olusturur.
rem Veri (veritabani) C:\Hakedis'e KOPYALANMAZ; ortak veri klasoru yapilandirma.json'daki "veriYolu" ile belirlenir.
set "HEDEF=C:\Hakedis"
set "KAYNAK=%~dp0"
if "%KAYNAK:~-1%"=="\" set "KAYNAK=%KAYNAK:~0,-1%"

if not exist "%KAYNAK%\Makine Ikmal Hakedis.exe" (
  echo HATA: Bu klasorde "Makine Ikmal Hakedis.exe" bulunamadi. kur.bat dosyasini uygulama klasorunun icinden calistirin.
  pause
  exit /b 1
)

tasklist /FI "IMAGENAME eq Makine Ikmal Hakedis.exe" 2>nul | find /I "Makine Ikmal Hakedis.exe" >nul
if not errorlevel 1 (
  echo Uygulama su an acik. Lutfen kapatip kur.bat dosyasini yeniden calistirin.
  pause
  exit /b 1
)

echo Kurulum klasoru: %HEDEF%
if not exist "%HEDEF%" mkdir "%HEDEF%"
if not exist "%HEDEF%" (
  echo HATA: %HEDEF% klasoru olusturulamadi. Bilgisayar yoneticisine basvurun.
  pause
  exit /b 1
)

rem Program dosyalarini kopyala (varsa uzerine yazar). "veri" klasorune ve mevcut yapilandirma.json dosyasina dokunmaz.
robocopy "%KAYNAK%" "%HEDEF%" /E /XD veri /XF kur.bat yapilandirma.json /NFL /NDL /NJH /NP >nul
if errorlevel 8 (
  echo HATA: Dosyalar kopyalanamadi. C:\Hakedis klasorune yazma izniniz olmayabilir.
  pause
  exit /b 1
)

rem yapilandirma.json: yoksa paketten al; veri yolu bossa sor
if not exist "%HEDEF%\yapilandirma.json" copy /Y "%KAYNAK%\yapilandirma.json" "%HEDEF%\yapilandirma.json" >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%HEDEF%\yapilandirma.json'; $j=Get-Content -Raw -LiteralPath $f | ConvertFrom-Json; if (-not $j.veriYolu) { $y=Read-Host 'Ortak veri klasoru yolu (ornek \sunucu\ortak\hakedis\veri) - bos birakirsaniz veri bu bilgisayarda C:\Hakedis\veri klasorunde tutulur'; if ($y) { $j | Add-Member -NotePropertyName veriYolu -NotePropertyValue $y.Trim() -Force; ($j | ConvertTo-Json) | Set-Content -LiteralPath $f -Encoding UTF8 } }"

rem Masaustu kisayolu
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%HEDEF%'; $exe=Join-Path $d 'Makine Ikmal Hakedis.exe'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Makine Ikmal Hakedis.lnk'); $s.TargetPath=$exe; $s.WorkingDirectory=$d; $s.IconLocation=$exe; $s.Save()"

echo.
echo Kurulum tamam
echo Uygulama: %HEDEF%\Makine Ikmal Hakedis.exe (masaustunde kisayol olusturuldu)
pause
endlocal
