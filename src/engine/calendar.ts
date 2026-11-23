import { Params } from './params';
import { ayGunSayisi, tarihStr } from './excel';

export type TatilTuru = 'RT' | 'RTA' | 'DB' | 'DBA';

export interface Tatil {
  tarih: string; // YYYY-MM-DD
  tur: TatilTuru;
  ad: string;
}

export interface GunSinifi {
  tarih: string;
  gun: number;
  /** Excel WEEKDAY: 1=Pazar ... 7=Cumartesi */
  weekday: number;
  X: boolean;     // hafta içi iş günü
  Ctesi: boolean;
  Pzr: boolean;
  RTA: boolean;
  RT: boolean;
  DBA: boolean;
  DB: boolean;
  /** Tatil adı (varsa) */
  ad: string;
  /** Kısa gösterim: 'İş', 'Cts', 'Pzr', 'RT', 'RTA', 'DB', 'DBA' */
  tip: string;
}

/** RULES.md 2.1: Günler sayfasının birebir uygulaması */
export function gunSinifla(tarih: string, tatiller: Map<string, Tatil[]>, p: Params): GunSinifi {
  const [y, m, d] = tarih.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1;
  const list = tatiller.get(tarih) ?? [];
  const has = (t: TatilTuru) => list.some((x) => x.tur === t);
  const RT = has('RT');
  const DB = has('DB');
  const seçim2 = !p.takvim.cumartesiIsGunu;
  const areCond = weekday > 1 && (seçim2 ? weekday < 7 : true);
  const RTA = has('RTA') && areCond;
  const DBA = has('DBA') && areCond;
  const Ctesi = weekday === 7 && !RT && !DB;
  const Pzr = weekday === 1 && !RT && !DB;
  const X = !(Ctesi || Pzr || RTA || RT || DBA || DB);
  const tip = RT ? 'RT' : DB ? 'DB' : RTA ? 'RTA' : DBA ? 'DBA' : Ctesi ? 'Cts' : Pzr ? 'Pzr' : 'İş';
  return { tarih, gun: d, weekday, X, Ctesi, Pzr, RTA, RT, DBA, DB, ad: list.map((x) => x.ad).join(', '), tip };
}

export interface AyTakvimi {
  gunler: GunSinifi[];
  sayilar: { X: number; Ctesi: number; Pzr: number; RTA: number; RT: number; DBA: number; DB: number };
  /** 'iş günü'!T25 */
  toplamIsGunu: number;
}

export function tatilHaritasi(tatiller: Tatil[]): Map<string, Tatil[]> {
  const m = new Map<string, Tatil[]>();
  for (const t of tatiller) {
    const a = m.get(t.tarih) ?? [];
    a.push(t);
    m.set(t.tarih, a);
  }
  return m;
}

export function ayTakvimi(yil: number, ay: number, tatiller: Tatil[], p: Params): AyTakvimi {
  const harita = tatilHaritasi(tatiller);
  const n = ayGunSayisi(yil, ay);
  const gunler: GunSinifi[] = [];
  for (let g = 1; g <= n; g++) gunler.push(gunSinifla(tarihStr(yil, ay, g), harita, p));
  const say = (k: keyof GunSinifi) => gunler.filter((x) => x[k] === true).length;
  const sayilar = { X: say('X'), Ctesi: say('Ctesi'), Pzr: say('Pzr'), RTA: say('RTA'), RT: say('RT'), DBA: say('DBA'), DB: say('DB') };
  const toplamIsGunu = p.takvim.cumartesiIsGunu
    ? sayilar.X + sayilar.Ctesi + sayilar.RTA * p.takvim.agirlikRTA + sayilar.DBA * p.takvim.agirlikDBA
    : sayilar.X + sayilar.RTA * p.takvim.agirlikRTA + sayilar.DBA * p.takvim.agirlikDBA;
  return { gunler, sayilar, toplamIsGunu };
}
