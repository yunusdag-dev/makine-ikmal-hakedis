import { describe, it, expect } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { Store } from '../electron/store'; import { Api } from '../electron/api';
import { VARSAYILAN_PARAMS } from '../src/engine/params';
import { gelirVergisi, dilimBilgisi } from '../src/engine/firma';

const p = VARSAYILAN_PARAMS; // 190.000 → %15, 400.000 → %20, üstü %27
const WASM = path.resolve('node_modules/sql.js/dist');

describe('Kümülatif gelir vergisi: sürücü bazlı, dilim geçişi ve ay içinde bölünme', () => {
  it('hiç sınır aşmayan sürücü: tüm matrah %15', () => {
    expect(gelirVergisi(p, 0, 50000, 0)).toBe(7500);
    expect(dilimBilgisi(p, 0, 50000)).toEqual({ oranOnceki: 0.15, oranSonraki: 0.15, bolundu: false });
  });
  it('ay içinde 190.000 sınırını aşan sürücü: sınıra kadar %15, aşan kısım %20', () => {
    // önceki kümülatif 180.000 + bu ay 20.000 = 200.000: 10.000×%15 + 10.000×%20
    expect(gelirVergisi(p, 180000, 20000, 0)).toBe(3500);
    expect(dilimBilgisi(p, 180000, 200000)).toEqual({ oranOnceki: 0.15, oranSonraki: 0.2, bolundu: true });
  });
  it('sınırı çoktan aşmış sürücü yeni oranla devam eder; iki sürücü birbirinden bağımsızdır', () => {
    expect(gelirVergisi(p, 250000, 30000, 0)).toBe(6000);      // %20 diliminde
    expect(gelirVergisi(p, 20000, 30000, 0)).toBe(4500);       // aynı ay, diğer sürücü %15 diliminde
    expect(gelirVergisi(p, 390000, 30000, 0)).toBe(7400);      // 10.000×%20 + 20.000×%27
  });
  it('dilimler değiştirilirse (yeni yıl) hesap yeni dilimleri kullanır', () => {
    const yeni = { ...p, bordro: { ...p.bordro, gvDilimleri: [{ ust: 200000, oran: 0.15 }, { ust: 500000, oran: 0.2 }, { ust: 900000, oran: 0.27 }, { ust: null, oran: 0.35 }] } };
    expect(gelirVergisi(yeni, 190000, 20000, 0)).toBe(3500);   // yeni sınır 200.000: 10.000×%15 + 10.000×%20
    expect(gelirVergisi(p, 190000, 20000, 0)).toBe(4000);      // eski dilimlerle: hepsi %20
  });
  it('1 Ocak: kümülatif matrah sıfırlanır (önceki yıl devretmez)', async () => {
    const h = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vg-')), 'h.db');
    const s = new Store(h); await s.ac(WASM, { kullanici: 'T' });
    const api = new Api(s);
    expect(api.donemVerisi('2027-01').oncekiKumulatifOtomatik).toEqual({});
  });
});
