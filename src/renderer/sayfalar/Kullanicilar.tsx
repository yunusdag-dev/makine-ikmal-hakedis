/** Kullanıcı yönetimi (yalnız yönetici): hesap ekle, rol/aktiflik değiştir, şifre ata, kurtarma kodu yenile */
import React, { useEffect, useState } from 'react';
import { Plus, Pencil, KeyRound, ShieldCheck, Copy, UserCog } from 'lucide-react';
import { kimlik } from '../lib/api';
import { useBaglam, ROL_AD, Rol } from '../lib/baglam';
import { Alan, Modal, useBildirim, useIslem, useOnay } from '../ui/temel';
import { zamanTR } from '../lib/bicim';

interface K { id: number; kullanici_adi: string; ad: string; rol: Rol; aktif: number; sifre_degistirmeli: number; son_giris: string; olusturma: string }
type Form = { id?: number; kullaniciAdi: string; ad: string; rol: Rol; aktif: boolean; sifre: string; tekrar: string };

export default function Kullanicilar() {
  const { oturum, acikOturumlar } = useBaglam();
  const [liste, setListe] = useState<K[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [sifreAta, setSifreAta] = useState<{ k: K; sifre: string; tekrar: string } | null>(null);
  const [kod, setKod] = useState<string | null>(null);
  const [hata, setHata] = useState('');
  const islem = useIslem();
  const onay = useOnay();
  const bildir = useBildirim();
  const yukle = async () => setListe(await kimlik<K[]>('liste'));
  useEffect(() => { yukle(); }, []);
  const acik = new Set(acikOturumlar.map((o) => o.kullanici));

  const kaydet = async () => {
    if (!form) return;
    setHata('');
    if (!form.id || form.sifre) {
      if (form.sifre.length < 6) { setHata('Şifre en az 6 karakter olmalı.'); return; }
      if (form.sifre !== form.tekrar) { setHata('Şifreler aynı değil.'); return; }
    }
    try {
      await kimlik('kaydet', { id: form.id, kullaniciAdi: form.kullaniciAdi, ad: form.ad, rol: form.rol, aktif: form.aktif, sifre: form.sifre || undefined });
      bildir('ok', form.id ? 'Kullanıcı güncellendi.' : `Kullanıcı eklendi. İlk girişte şifresini değiştirmesi istenecek.`);
      setForm(null);
      yukle();
    } catch (e: any) { setHata(e.message); }
  };
  const ata = async () => {
    if (!sifreAta) return;
    setHata('');
    if (sifreAta.sifre.length < 6) { setHata('Şifre en az 6 karakter olmalı.'); return; }
    if (sifreAta.sifre !== sifreAta.tekrar) { setHata('Şifreler aynı değil.'); return; }
    try {
      await kimlik('sifreAta', sifreAta.k.id, sifreAta.sifre);
      bildir('ok', `${sifreAta.k.ad} için yeni şifre atandı.${sifreAta.k.id !== oturum.kullaniciId ? ' İlk girişte değiştirmesi istenecek.' : ''}`);
      setSifreAta(null);
      yukle();
    } catch (e: any) { setHata(e.message); }
  };
  const kodYenile = async () => {
    if (!(await onay({ baslik: 'Yeni kurtarma kodu', metin: 'Yeni bir kurtarma kodu oluşturulacak; eski kod geçersiz olur.\nKodu güvenli bir yere yazmanız gerekecek.', evet: 'Oluştur' }))) return;
    const k = await islem(() => kimlik<string>('kurtarmaKoduYenile'));
    if (k) setKod(k);
  };

  return (
    <div className="izgara" style={{ gap: 14 }}>
      <div className="satir">
        <div className="soluk" style={{ maxWidth: 760, lineHeight: 1.5 }}>
          <b>Yönetici:</b> her şey + kullanıcı yönetimi, parametreler, tatiller, dönem açma, yedekten geri yükleme, Excel içe aktarma.
          {' '}<b>Kullanıcı:</b> puantaj, araç/sürücü kayıtları, hakediş girişleri, dönem kapatma, çıktılar.
          {' '}<b>İzleyici:</b> yalnız görüntüleme ve çıktı alma.
        </div>
        <div className="bosluk" />
        <button className="btn" onClick={kodYenile}><ShieldCheck size={15} /> Kurtarma kodunu yenile</button>
        <button className="btn birincil" onClick={() => { setHata(''); setForm({ kullaniciAdi: '', ad: '', rol: 'kullanici', aktif: true, sifre: '', tekrar: '' }); }}><Plus size={16} /> Yeni kullanıcı</button>
      </div>
      <div className="kart tablo-sar">
        <table className="tablo">
          <thead><tr><th>Ad soyad</th><th>Kullanıcı adı</th><th>Rol</th><th>Durum</th><th>Son giriş</th><th>Oluşturma</th><th></th></tr></thead>
          <tbody>
            {liste.map((k) => (
              <tr key={k.id} style={{ opacity: k.aktif ? 1 : 0.55 }}>
                <td className="kalin">{k.ad} {k.id === oturum.kullaniciId && <span className="rozet mavi">siz</span>} {acik.has(k.ad) && <span className="rozet ok">açık</span>}</td>
                <td style={{ fontFamily: 'var(--mono)' }}>{k.kullanici_adi}</td>
                <td>{k.rol === 'yonetici' ? <span className="rozet mavi">Yönetici</span> : k.rol === 'izleyici' ? <span className="rozet">İzleyici</span> : 'Kullanıcı'}</td>
                <td>{k.aktif ? <span className="rozet ok">Aktif</span> : <span className="rozet">Pasif</span>} {k.sifre_degistirmeli ? <span className="rozet uyari">geçici şifre</span> : null}</td>
                <td>{zamanTR(k.son_giris) || <span className="soluk">—</span>}</td>
                <td className="soluk">{zamanTR(k.olusturma)}</td>
                <td className="sag">
                  <button className="btn kucuk" onClick={() => { setHata(''); setSifreAta({ k, sifre: '', tekrar: '' }); }}><KeyRound size={13} /> Şifre ata</button>
                  <button className="btn ikon kucuk hayalet" title="Düzenle" onClick={() => { setHata(''); setForm({ id: k.id, kullaniciAdi: k.kullanici_adi, ad: k.ad, rol: k.rol, aktif: !!k.aktif, sifre: '', tekrar: '' }); }}><Pencil size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="soluk kucuk-yazi">Hesaplar silinmez (değişiklik kaydında adları geçtiği için); kullanılmayan hesabı pasif yapın. En az bir aktif yönetici her zaman bulunmalıdır.</div>

      {form && (
        <Modal baslik={form.id ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'} kapat={() => setForm(null)} ikon={<UserCog size={20} />}
          alt={<><button className="btn" onClick={() => setForm(null)}>Vazgeç</button><button className="btn birincil" onClick={kaydet}>Kaydet</button></>}>
          <form onSubmit={(e) => { e.preventDefault(); kaydet(); }} className="izgara" style={{ gap: 12 }}>
            <div className="izgara k2">
              <Alan etiket="Ad soyad"><input className="girdi" autoFocus value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} /></Alan>
              <Alan etiket="Kullanıcı adı" ipucu="Boşluksuz, ör. ayse.kaya"><input className="girdi" value={form.kullaniciAdi} onChange={(e) => setForm({ ...form, kullaniciAdi: e.target.value })} /></Alan>
              <Alan etiket="Rol">
                <select className="girdi" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>
                  {(Object.keys(ROL_AD) as Rol[]).map((r) => <option key={r} value={r}>{ROL_AD[r]}</option>)}
                </select>
              </Alan>
              <Alan etiket="Durum"><label className="onay" style={{ height: 34 }}><input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} /> Aktif (giriş yapabilir)</label></Alan>
              <Alan etiket={form.id ? 'Yeni şifre (değiştirmeyecekseniz boş bırakın)' : 'Geçici şifre'} ipucu="En az 6 karakter. Kullanıcı ilk girişte kendi şifresini belirler.">
                <input type="password" className="girdi" value={form.sifre} onChange={(e) => setForm({ ...form, sifre: e.target.value })} />
              </Alan>
              <Alan etiket="Şifre (tekrar)"><input type="password" className="girdi" value={form.tekrar} onChange={(e) => setForm({ ...form, tekrar: e.target.value })} /></Alan>
            </div>
            {hata && <div className="uyari-oge hata">{hata}</div>}
            <button type="submit" hidden />
          </form>
        </Modal>
      )}

      {sifreAta && (
        <Modal baslik={`Şifre ata — ${sifreAta.k.ad}`} kapat={() => setSifreAta(null)} ikon={<KeyRound size={20} />}
          alt={<><button className="btn" onClick={() => setSifreAta(null)}>Vazgeç</button><button className="btn birincil" onClick={ata}>Şifreyi ata</button></>}>
          <form onSubmit={(e) => { e.preventDefault(); ata(); }} className="izgara" style={{ gap: 12 }}>
            <div className="soluk">Şifresini unutan veya hesabı kilitlenen kullanıcıya yeni bir geçici şifre verin. Hesap pasifse aktif yapılır; kullanıcı ilk girişte kendi şifresini belirler.</div>
            <Alan etiket="Yeni şifre" ipucu="En az 6 karakter"><input type="password" className="girdi" autoFocus value={sifreAta.sifre} onChange={(e) => setSifreAta({ ...sifreAta, sifre: e.target.value })} /></Alan>
            <Alan etiket="Yeni şifre (tekrar)"><input type="password" className="girdi" value={sifreAta.tekrar} onChange={(e) => setSifreAta({ ...sifreAta, tekrar: e.target.value })} /></Alan>
            {hata && <div className="uyari-oge hata">{hata}</div>}
            <button type="submit" hidden />
          </form>
        </Modal>
      )}

      {kod && (
        <Modal baslik="Yeni kurtarma kodu" kapat={() => setKod(null)} ikon={<ShieldCheck size={20} color="var(--ok)" />} alt={<button className="btn birincil" onClick={() => setKod(null)}>Not aldım</button>}>
          <p style={{ marginTop: 0 }}>Bu kod yalnız bir kez gösterilir. Tüm yöneticiler şifresini unutursa giriş ekranındaki "Şifremi unuttum" bağlantısıyla kullanılır.</p>
          <div className="satir" style={{ justifyContent: 'center', margin: '18px 0' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700, letterSpacing: 2, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 18px' }}>{kod}</span>
            <button className="btn ikon" title="Kopyala" onClick={() => { navigator.clipboard?.writeText(kod); bildir('ok', 'Kopyalandı'); }}><Copy size={16} /></button>
          </div>
        </Modal>
      )}
    </div>
  );
}
