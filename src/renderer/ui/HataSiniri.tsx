import React from 'react';

/** Arayüzde beklenmeyen bir hata olursa beyaz ekran yerine anlaşılır bir mesaj gösterir ve hatayı günlüğe yazar. */
export class HataSiniri extends React.Component<{ children: React.ReactNode }, { hata: string | null }> {
  state = { hata: null as string | null };
  static getDerivedStateFromError(e: any) { return { hata: String(e?.message ?? e) }; }
  componentDidCatch(e: any, info: React.ErrorInfo) {
    try { window.hakedis.gunlukYaz('react', `${String(e?.message ?? e)} ${String(info.componentStack ?? '').split('\n').slice(0, 4).join(' ')}`); } catch { /* */ }
  }
  render() {
    if (this.state.hata == null) return this.props.children;
    return (
      <div style={{ padding: 40, maxWidth: 640, margin: '10vh auto', fontFamily: 'var(--font)' }}>
        <h2>Beklenmeyen bir sorun oluştu</h2>
        <p>Girdiğiniz veriler kaydedildiyse korunmuştur. Ekranı yeniden yüklemek genellikle sorunu giderir. Sorun sürerse yöneticinize bildirin (ayrıntı hata günlüğüne yazıldı).</p>
        <button className="btn birincil" onClick={() => location.reload()}>Yeniden yükle</button>
      </div>
    );
  }
}
