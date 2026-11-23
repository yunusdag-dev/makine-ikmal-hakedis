import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('hakedis', {
  baslangic: () => ipcRenderer.invoke('baslangic'),
  dbBaglan: (dbYolu: string, secenek?: any) => ipcRenderer.invoke('dbBaglan', dbYolu, secenek),
  veriKlasoruBilgi: () => ipcRenderer.invoke('veriKlasoruBilgi'),
  veriKlasoruDegistir: () => ipcRenderer.invoke('veriKlasoruDegistir'),
  ilkKurulum: (o: any) => ipcRenderer.invoke('ilkKurulum', o),
  girisYap: (o: any) => ipcRenderer.invoke('girisYap', o),
  kurtar: (o: any) => ipcRenderer.invoke('kurtar', o),
  oturumKapat: () => ipcRenderer.invoke('oturumKapat'),
  bozukKurtar: (o: any) => ipcRenderer.invoke('bozukKurtar', o),
  api: (metot: string, ...args: any[]) => ipcRenderer.invoke('api', metot, args),
  kimlik: (metot: string, ...args: any[]) => ipcRenderer.invoke('kimlik', metot, args),
  dosyaSec: (o: any) => ipcRenderer.invoke('dosyaSec', o),
  dosyaAc: (yol: string) => ipcRenderer.invoke('dosyaAc', yol),
  klasordeGoster: (yol: string) => ipcRenderer.invoke('klasordeGoster', yol),
  excelIceAktar: (o: any) => ipcRenderer.invoke('excelIceAktar', o),
  cikti: (o: any) => ipcRenderer.invoke('cikti', o),
  gunlukYaz: (kaynak: string, mesaj: string) => ipcRenderer.invoke('gunlukYaz', kaynak, mesaj),
});
