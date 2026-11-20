import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Store, sqlInit, dosyaButunMu } from './store';
import { bozukKurtarUygula, kurtarmaIzniOlustur, KurtarmaIzni } from './kurtarma';
import { Api } from './api';
import { Kimlik } from './auth';
import { tohumdanOlustur } from './tohum';
import { gunlukKlasoruAyarla, hataYaz, kullaniciMesaji } from './hataGunlugu';
import { excelIceAktar } from './importDb';
import { layoutYukle, firmaHakedisExcel, kurumPuantajExcel, tekilExcel, plakaFormlariExcel } from './excelExport';
import { plakaFormuHtml } from './raporHtml';
import { gunSatiriUygula } from '../src/engine/ozellik';
import { AY_ADLARI, parseAy } from '../src/engine/excel';

// Test ve geliştirme ortam değişkenleri yalnız paketlenmemiş (geliştirme) sürümde dikkate alınır; kurulu uygulamada hiçbir etkisi yoktur.
const EKRAN_TEST = app.isPackaged ? undefined : process.env.HAKEDIS_EKRAN_TEST;
// Ekran testi: kullanıcının gerçek profilinden ve açık uygulamasından tamamen ayrı çalışsın
if (EKRAN_TEST) app.setPath('userData', path.join(EKRAN_TEST, 'profil'));

// Windows'ta pencere başka uygulamayla örtüşünce/simge durumundan dönünce oluşan takılma ve donmaları önler
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Tek örnek (aynı makinede ikinci kez açılmasın)
if (!app.requestSingleInstanceLock()) app.quit();

const PORTABLE_DIR = process.env.PORTABLE_EXECUTABLE_DIR;
const KAYNAK = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
const AYAR_DOSYA = path.join(app.getPath('userData'), 'ayarlar.json');

interface YerelAyar {
  dbYolu?: string;
  sonKullanici?: string;
  sonDbler?: string[];
  pencere?: { width: number; height: number; x?: number; y?: number; maximized?: boolean };
  sonCiktiKlasoru?: string;
}

function ayarOku(): YerelAyar {
  try { return JSON.parse(fs.readFileSync(AYAR_DOSYA, 'utf8')); } catch { return {}; }
}
function ayarYaz(a: YerelAyar) {
  try {
    fs.mkdirSync(path.dirname(AYAR_DOSYA), { recursive: true });
    fs.writeFileSync(AYAR_DOSYA, JSON.stringify(a, null, 2));
  } catch { /* yoksay */ }
}
/** Kurulu (paketli) uygulamada veritabanı, uygulama klasörünün yanındaki "veri" klasöründedir: klasörü kopyalayan herkes aynı yapıyı alır. */
const KLASOR_MODU = app.isPackaged && !PORTABLE_DIR && !EKRAN_TEST;
function varsayilanDbYolu() {
  const kok = PORTABLE_DIR ?? (KLASOR_MODU ? path.dirname(process.execPath) : app.getPath('userData'));
  return path.join(kok, 'veri', 'hakedis.db');
}

gunlukKlasoruAyarla(path.join(path.dirname(varsayilanDbYolu()), 'loglar'));
// Yakalanmayan hatalar çökme yerine günlüğe yazılır
process.on('uncaughtException', (e) => hataYaz('uncaughtException', e));
process.on('unhandledRejection', (e) => hataYaz('unhandledRejection', e));

let win: BrowserWindow | null = null;
let store: Store | null = null;
let api: Api | null = null;
let kimlik: Kimlik | null = null;
let girisli = false;
let kurtarmaIzni: KurtarmaIzni | null = null;

function pencereOlustur() {
  const a = ayarOku();
  win = new BrowserWindow({
    width: a.pencere?.width ?? 1440,
    height: a.pencere?.height ?? 900,
    x: a.pencere?.x,
    y: a.pencere?.y,
    minWidth: 1100,
    minHeight: 700,
    title: 'Makine İkmal Hakediş',
    backgroundColor: '#f4f6fa',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(KAYNAK, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  if (a.pencere?.maximized) win.maximize();
  win.once('ready-to-show', () => win?.show());
  const dev = app.isPackaged ? undefined : process.env.VITE_DEV_SERVER_URL;
  if (dev) win.loadURL(dev);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.on('close', () => {
    if (!win) return;
    const b = win.getNormalBounds();
    const s = ayarOku();
    s.pencere = { width: b.width, height: b.height, x: b.x, y: b.y, maximized: win.isMaximized() };
    ayarYaz(s);
  });
  win.webContents.on('render-process-gone', (_e: any, d: any) => hataYaz('render-process-gone', new Error(String(d?.reason))));
  win.on('unresponsive', () => hataYaz('pencere', new Error('Pencere yanıt vermiyor')));
  // Uygulama penceresi başka bir adrese gitmesin (yalnız kendi yerel sayfasını gösterir)
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:') && !(!app.isPackaged && process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL))) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12' && !app.isPackaged) win?.webContents.toggleDevTools();
    if (input.type === 'keyDown' && input.control && input.key.toLowerCase() === 'r' && app.isPackaged) e.preventDefault();
  });
}

app.whenReady().then(async () => {
  try { layoutYukle(path.join(KAYNAK, 'templates', 'layout.json')); } catch (e) { console.error(e); }
  if (EKRAN_TEST) await ekranTestiHazirla();
  pencereOlustur();
  if (EKRAN_TEST) ekranTestiCalistir();
});

// ---------------------------------------------------------------- geliştirici ekran testi (yalnız ortam değişkeniyle)
async function ekranTestiHazirla() {
  const dir = EKRAN_TEST!;
  fs.mkdirSync(dir, { recursive: true });
  if (process.env.HAKEDIS_TEST_ILK_KURULUM) return; // temiz profil: uygulama ilk kurulum akışıyla başlar
  const db = path.join(dir, 'test.db');
  for (const f of [db, db + '.bak', db + '.yazma']) try { fs.unlinkSync(f); } catch { /* */ }
  const s = new Store(db);
  await s.ac(__dirname);
  store = s;
  api = new Api(s);
  kimlik = new Kimlik(s);
  kimlik.ilkKurulum({ kullaniciAdi: 'test', ad: 'Ekran Testi', sifre: 'test123' });
  kimlik.giris('test', 'test123');
  girisli = !process.env.HAKEDIS_TEST_GIRIS_EKRANI;
  if (process.env.HAKEDIS_TEST_KURUM) await excelIceAktar(s, process.env.HAKEDIS_TEST_KURUM, process.env.HAKEDIS_TEST_FIRMA ?? null, api.parametreler('2026-01'));
}
async function ekranTestiCalistir() {
  const dir = EKRAN_TEST!;
  const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const sayfalar = (process.env.HAKEDIS_TEST_SAYFALAR ?? 'panel,gunluk,puantaj,arac,asama2,hakedis,bordro,ciktilar,suruculer,araclar,ayarlar,veritabani,kayitlar,kullanicilar').split(',');
  await bekle(2500);
  const konsolHata: string[] = [];
  win!.webContents.on('console-message', (_e: any, level: number, msg: string) => { if (level >= 3) konsolHata.push(msg); });
  win!.webContents.on('render-process-gone', (_e: any, d: any) => konsolHata.push('RENDER ÇÖKTÜ: ' + d.reason));
  if (process.env.HAKEDIS_TEST_CIKTI && api) {
    const son = api.hesapla('2026-08');
    const p = api.parametreler('2026-08');
    await pdfYaz(plakaFormuHtml(son, p, son.giris.map((_, i) => i)), path.join(dir, 'formlar.pdf'));
    await firmaHakedisExcel(son, p, path.join(dir, 'firma.xlsx'));
  }
  for (const sf of sayfalar) {
    await win!.webContents.executeJavaScript(`localStorage.setItem('sayfa', '${sf}'); localStorage.setItem('ay', '${process.env.HAKEDIS_TEST_AY ?? '2026-08'}'); location.reload();`);
    await bekle(2600);
    if (process.env.HAKEDIS_TEST_JS) { const js = await win!.webContents.executeJavaScript(process.env.HAKEDIS_TEST_JS); fs.writeFileSync(path.join(dir, 'js-sonuc.json'), JSON.stringify(js ?? null)); await bekle(900); }
    const img = await win!.webContents.capturePage();
    fs.writeFileSync(path.join(dir, `${sf}.png`), img.toPNG());
  }
  fs.writeFileSync(path.join(dir, 'konsol-hatalari.txt'), konsolHata.join(String.fromCharCode(10)) || 'HATA YOK');
  app.quit();
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => {
  store?.kapat();
  store = null;
  app.quit();
});
app.on('before-quit', () => { store?.kapat(); store = null; });

// ---------------------------------------------------------------- IPC
type Sonuc<T> = { ok: true; veri: T } | { ok: false; hata: string; kod?: string; ek?: any };
function sar<T>(fn: () => T | Promise<T>, etiket = ''): Promise<Sonuc<T>> {
  return Promise.resolve()
    .then(fn)
    .then((veri) => ({ ok: true as const, veri }))
    .catch((e: any) => {
      // Teknik hatalar günlüğe yazılır, kullanıcıya anlaşılır ileti gösterilir; doğrulama iletileri aynen geçer
      const k = kullaniciMesaji(e);
      if (k.teknik) hataYaz(etiket || 'ipc', e);
      return { ok: false as const, hata: k.mesaj, kod: e?.kod, ek: e?.ek };
    });
}

ipcMain.handle('gunlukYaz', (_e, kaynak: string, mesaj: string) => { hataYaz(`arayüz/${String(kaynak).slice(0, 40)}`, new Error(String(mesaj).slice(0, 2000))); return true; });

ipcMain.handle('baslangic', () => sar(() => {
  // ekran testinde kullanıcının gerçek ayarlarına / varsayılan veritabanına dokunma
  const a = EKRAN_TEST ? { dbYolu: store?.dosya } as YerelAyar : ayarOku();
  return {
    dbYolu: KLASOR_MODU ? varsayilanDbYolu() : (a.dbYolu ?? varsayilanDbYolu()),
    varsayilanDbYolu: varsayilanDbYolu(),
    sonKullanici: a.sonKullanici ?? '',
    sonDbler: a.sonDbler ?? [],
    dbKayitli: KLASOR_MODU || !!a.dbYolu,
    makine: os.hostname(),
    surum: app.getVersion(),
    portable: !!PORTABLE_DIR,
    oturum: girisli && api ? api.oturum() : null,
  };
}));

function oturumuKapat() {
  girisli = false;
  store?.kapat();
  store = null;
  api = null;
  kimlik = null;
}

/** Veritabanı dosyasına bağlan (giriş öncesi). Dosya yoksa oluşturulur. */
ipcMain.handle('dbBaglan', (_e, dbYolu: string) => sar(async () => {
  oturumuKapat();
  if (!dbYolu?.trim()) throw new Error('Veritabanı dosya yolu giriniz.');
  // Dosya yoksa ve kurulumla hazır başlangıç verisi geldiyse ondan oluştur (araçlar, sürücüler, atamalar, parametreler, tatiller)
  const hazirVeri = tohumdanOlustur(path.resolve(dbYolu.trim()), path.join(KAYNAK, 'hazir-veri', 'hakedis.db'));
  const s = new Store(dbYolu.trim());
  try {
    await s.ac(__dirname);
  } catch (e: any) {
    if (e?.message === 'BUTUNLUK_HATASI') {
      const err: any = new Error('Veritabanı dosyası bozuk görünüyor. Yedekten geri yükleme önerilir.');
      err.kod = 'BOZUK';
      err.ek = { yedekler: s.yedekler().slice(0, 20), bak: fs.existsSync(s.dosya + '.bak') ? s.dosya + '.bak' : null };
      kurtarmaIzni = kurtarmaIzniOlustur(s.dosya, [...err.ek.yedekler.map((y: any) => y.yol), err.ek.bak]);
      throw err;
    }
    throw e;
  }
  store = s;
  api = new Api(s);
  kimlik = new Kimlik(s);
  const a = ayarOku();
  if (EKRAN_TEST) return { dosya: s.dosya, kurulumGerekli: kimlik.kurulumGerekli() };
  a.dbYolu = s.dosya;
  a.sonDbler = [s.dosya, ...(a.sonDbler ?? []).filter((x) => x !== s.dosya)].slice(0, 6);
  ayarYaz(a);
  return { dosya: s.dosya, kurulumGerekli: kimlik.kurulumGerekli(), hazirVeri };
}));

ipcMain.handle('ilkKurulum', (_e, o: { kullaniciAdi: string; ad: string; sifre: string }) => sar(() => {
  if (!kimlik || !api) throw new Error('Önce veritabanına bağlanın.');
  const { kurtarmaKodu } = kimlik.ilkKurulum(o);
  const g = kimlik.giris(o.kullaniciAdi, o.sifre);
  girisli = true;
  const a = ayarOku(); a.sonKullanici = g.kullaniciAdi; ayarYaz(a);
  return { kurtarmaKodu, oturum: api.oturum() };
}));

ipcMain.handle('girisYap', (_e, o: { kullaniciAdi: string; sifre: string }) => sar(() => {
  if (!kimlik || !api) throw new Error('Önce veritabanına bağlanın.');
  const g = kimlik.giris(o.kullaniciAdi, o.sifre);
  girisli = true;
  const a = ayarOku(); a.sonKullanici = g.kullaniciAdi; ayarYaz(a);
  try { store?.kayitBudama(); } catch { /* budama başarısızsa giriş engellenmez */ }
  return { ...api.oturum(), sifreDegistirmeli: g.sifreDegistirmeli };
}));

ipcMain.handle('kurtar', (_e, o: { kod: string; kullaniciAdi: string; yeniSifre: string }) => sar(() => {
  if (!kimlik) throw new Error('Önce veritabanına bağlanın.');
  kimlik.kurtar(o.kod, o.kullaniciAdi, o.yeniSifre);
  return true;
}));

/** Bozuk veritabanını yedekle değiştir (oturum açılmadan). Yalnız bozuk bulunan dosya ve listelenen, bütünlüğü doğrulanan yedekler kabul edilir. */
ipcMain.handle('bozukKurtar', (_e, o: { dbYolu: string; yedekYolu: string }) => sar(async () => {
  oturumuKapat();
  await sqlInit(__dirname);
  const r = bozukKurtarUygula(kurtarmaIzni, o.dbYolu, o.yedekYolu, dosyaButunMu);
  kurtarmaIzni = null;
  return r;
}, 'bozukKurtar'));

ipcMain.handle('oturumKapat', () => sar(() => {
  try {
    if (girisli && store && !store.saltOkunur) store.tx(() => store!.run('INSERT INTO degisiklik_kaydi (kullanici, makine, islem, varlik, ozet) VALUES (?,?,?,?,?)', [store!.kullanici, os.hostname(), 'oturum kapat', 'oturum', 'Çıkış yapıldı']));
  } catch { /* */ }
  oturumuKapat();
  return true;
}));

/** Arayüzden çağrılmaması gereken iç yardımcılar (TypeScript 'private' çalışma anında korunmaz) */
const IC_METOTLAR = new Set(['kayit', 'donemKapaliMi', 'donemAcikOlmali', 'donemVerisiIc', 'oncekiKmOtomatik', 'kumulatifOtomatik']);

/** Yalnız yöneticinin çağırabileceği veri işlemleri */
const YONETICI_ISLEMLERI = new Set(['parametreKaydet', 'parametreSil', 'tatilKaydet', 'tatilSil', 'yedektenYukle', 'donemAc', 'donemKapat', 'aracSil', 'surucuSil', 'atamaKaydet', 'atamaSil']);

function girisGerekli() {
  if (!api || !store || !girisli) throw new Error('Oturum açık değil. Lütfen yeniden giriş yapın.');
}

ipcMain.handle('api', (_e, metot: string, args: any[]) => sar(() => {
  girisGerekli();
  const fn = (api as any)[metot];
  if (typeof fn !== 'function' || metot.startsWith('_') || metot === 'constructor' || IC_METOTLAR.has(metot)) throw new Error(`Bilinmeyen işlem: ${metot}`);
  if (YONETICI_ISLEMLERI.has(metot) && store!.rol !== 'yonetici') throw new Error('Bu işlem için yönetici yetkisi gerekir.');
  store!.tazele(); // başka kullanıcıların kaydettiği en güncel veriyle çalış
  return fn.apply(api, args ?? []);
}, 'api'));

const KIMLIK_ISLEMLERI = ['liste', 'kaydet', 'sifreAta', 'kurtarmaKoduYenile', 'sifremiDegistir'];
ipcMain.handle('kimlik', (_e, metot: string, args: any[]) => sar(() => {
  girisGerekli();
  if (!KIMLIK_ISLEMLERI.includes(metot)) throw new Error('Bilinmeyen işlem.');
  store!.tazele();
  return (kimlik as any)[metot](...(args ?? []));
}));

ipcMain.handle('dosyaSec', (_e, o: { baslik: string; filtre?: { name: string; extensions: string[] }[]; kaydet?: boolean; varsayilan?: string; klasor?: boolean }) => sar(async () => {
  if (o.klasor) {
    const r = await dialog.showOpenDialog(win!, { title: o.baslik, properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  }
  if (o.kaydet) {
    const a = ayarOku();
    const r = await dialog.showSaveDialog(win!, { title: o.baslik, filters: o.filtre, defaultPath: o.varsayilan && a.sonCiktiKlasoru ? path.join(a.sonCiktiKlasoru, o.varsayilan) : o.varsayilan });
    if (!r.canceled && r.filePath) { a.sonCiktiKlasoru = path.dirname(r.filePath); ayarYaz(a); }
    return r.canceled ? null : r.filePath;
  }
  const r = await dialog.showOpenDialog(win!, { title: o.baslik, filters: o.filtre, properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
}));

/** Yalnız uygulamanın ürettiği belge türleri açılır (çalıştırılabilir dosya açılamaz) */
const ACILABILIR_UZANTILAR = new Set(['.xlsx', '.xls', '.pdf', '.csv']);
ipcMain.handle('dosyaAc', (_e, yol: string) => sar(async () => {
  const y = path.resolve(String(yol ?? ''));
  if (!ACILABILIR_UZANTILAR.has(path.extname(y).toLowerCase()) || !fs.existsSync(y)) throw new Error('Bu dosya türü açılamaz.');
  const h = await shell.openPath(y); if (h) throw new Error(h); return true;
}));
ipcMain.handle('klasordeGoster', (_e, yol: string) => sar(() => { shell.showItemInFolder(yol); return true; }));

function ayEtiket(ay: string) { const { yil, ay: m } = parseAy(ay); return `${AY_ADLARI[m - 1]} ${yil}`; }

ipcMain.handle('excelIceAktar', (_e, o: { kurum: string; firma: string | null; yalnizKartlar?: boolean }) => sar(async () => {
  girisGerekli();
  if (store!.rol !== 'yonetici') throw new Error("Excel'den içe aktarma için yönetici yetkisi gerekir.");
  store!.tazele();
  if (!store || !api) throw new Error('Oturum açık değil.');
  const kurumWb = o.kurum;
  const ay0 = '2026-01';
  const r = await excelIceAktar(store, kurumWb, o.firma, api.parametreler(ay0), { yalnizKartlar: !!o.yalnizKartlar });
  return r;
}));

ipcMain.handle('cikti', (_e, o: { tur: string; ay: string; hedef: string; indeksler?: number[] }) => sar(async () => {
  girisGerekli();
  store!.tazele();
  if (!store || !api) throw new Error('Oturum açık değil.');
  const son = api.hesapla(o.ay);
  const p = api.parametreler(o.ay);
  switch (o.tur) {
    case 'firma': await firmaHakedisExcel(son, p, o.hedef); break;
    case 'kurum': {
      const yolHakkiHaritasi = new Map(store.all<any>('SELECT id, yol_hakki FROM suruculer').map((x) => [x.id, !!x.yol_hakki]));
      await kurumPuantajExcel(son, p, {
        tatiller: api.tatiller(),
        surucuGunleri: store.all<any>('SELECT * FROM surucu_gunleri WHERE tarih LIKE ?', [`${o.ay}-%`]).map((r) => gunSatiriUygula(r, p.ozellikler, yolHakkiHaritasi.get(r.surucu_id) ?? true)),
        seferler: store.all('SELECT * FROM seferler WHERE tarih LIKE ?', [`${o.ay}-%`]),
        suruculer: store.all('SELECT id, ad_soyad, yol_hakki FROM suruculer'),
      }, o.hedef);
      break;
    }
    case 'surucuFaaliyet': case 'aracFaaliyet': case 'bordro': case 'onTablo':
      await tekilExcel(o.tur as any, son, p, o.hedef); break;
    case 'plakaExcel': await plakaFormlariExcel(son, p, o.indeksler ?? son.giris.map((_, i) => i), o.hedef); break;
    case 'plakaPdf': await pdfYaz(plakaFormuHtml(son, p, o.indeksler ?? son.giris.map((_, i) => i)), o.hedef); break;
    default: throw new Error('Bilinmeyen çıktı türü');
  }
  if (!store.saltOkunur) {
    try {
      store.tx(() => store!.run("INSERT INTO degisiklik_kaydi (kullanici, makine, islem, varlik, varlik_id, ozet) VALUES (?,?,?,?,?,?)",
        [store!.kullanici, os.hostname(), 'çıktı', 'rapor', o.ay, `${ayEtiket(o.ay)} — ${o.tur}: ${path.basename(o.hedef)}`]));
    } catch { /* kayıt meşgulse çıktı yine verilir */ }
  }
  return o.hedef;
}));

async function pdfYaz(html: string, hedef: string) {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true, sandbox: true, javascript: false, contextIsolation: true } });
  try {
    const tmp = path.join(app.getPath('temp'), `hakedis-${Date.now()}.html`);
    fs.writeFileSync(tmp, html, 'utf8');
    await w.loadFile(tmp);
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.35, bottom: 0.35, left: 0.4, right: 0.4 } });
    fs.writeFileSync(hedef, pdf);
    try { fs.unlinkSync(tmp); } catch { /* */ }
  } finally {
    w.destroy();
  }
}
