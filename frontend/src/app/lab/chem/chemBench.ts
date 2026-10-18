/**
 * 2026-10-18 — DER LABORTISCH DER CHEMIA: Gefässe, Brenner (mit Dreifuss),
 * Schläuche zwischen Gefässen, Bürette, Gasspritze — und die Zeit.
 *
 * <b>Ein Schritt</b> (1/30 s): in jedem Gefäss reagieren Metalle, Lösungen,
 * Feststoffe; Salze lösen sich und fallen aus; Gase lösen sich und entweichen;
 * Wasser verdunstet; Brenner und Zimmer geben und nehmen Wärme. Dann die
 * Bilanz: die Änderung der chemischen Enthalpie ist Wärme → Temperatur;
 * höher als der Siedepunkt geht es nicht. Ein verschlossenes Gefäss hält
 * Druck, bis der Stopfen fliegt.
 *
 * <b>Schläuche</b>: Gas strömt, wenn der Druck im ersten Gefäss den im
 * zweiten übersteigt — samt dem Druck der Wassersäule über dem Schlauchende
 * (ρ·g·h): das Gas muss das Wasser hinunterdrücken. Fällt der Druck im ersten
 * Gefäss genug (Ammoniak löst sich), steigt das Wasser hinüber: Springbrunnen.
 */

import { DISSOLVES, INDICATORS, P_ATM_KPA, R, SPECIES, T_ROOM, reagentOf, saltOf, type GasId, type Reagent } from './chemData';
import { decomposeStep, fireStep, gasStep, hydrateStep, igniteLump, liquidStep, metalStep } from './chemReact';
import { boilStep, evaporateStep, heatStep, henryStep, iceStep, moveLumps, roomStep, settleStep, spillStep, type Room } from './chemPhase';
import { clarify, saltStep } from './chemSalts';
import { Vessel, colorWord, emptyFx, indicatorColor, type ChemEvent, type Lump, type LumpForm, type Portion } from './chemVessel';

/** Wie hoch der Dreifuss über dem Brenner steht (cm) — dort sitzt ein Gefäss, das erhitzt wird. */
export const SEAT = 17;
export const STEP = 1 / 30;

export interface Burner {
  readonly id: string;
  x: number;
  on: boolean;
  /** Luft auf: blaue, heisse Flamme; zu: gelbe, leuchtende. */
  air: boolean;
  /** Die Flamme färbt sich (Flammenprobe) — Farbe und wie lange noch (s). */
  tint: string | null;
  tintLeft: number;
}

export interface Link {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Was gerade fliesst (für die Bilder): Gas (mol/s) oder Flüssigkeit zurück (mL/s). */
  gas: number;
  back: number;
}

/** Ein Werkzeug, das gerade wirkt (Holzspan an der Öffnung, Papier im Gefäss) — für die Bilder. */
export interface Probe {
  readonly tool: ToolKey;
  readonly vessel: string;
  left: number;
  readonly result: 'relight' | 'out' | 'glow' | 'pop' | 'bright' | 'burn' | 'paper';
  readonly color?: string;
}

export type ToolKey = 'glow' | 'splint' | 'match' | 'paper' | 'wetpaper' | 'loop' | 'stir' | 'stopper' | 'gauge' | 'tube' | 'spoon' | 'probe' | 'empty' | 'delete';

const dHf = (id: string): number => (SPECIES[id]?.dHf ?? 0) * 1000;
const n2 = (x: number) => x.toFixed(x < 10 ? 1 : 0).replace('.', ',');
const FORM_OF: Readonly<Record<string, LumpForm>> = { piece: 'piece', granules: 'granules', powder: 'powder', ribbon: 'ribbon', crystals: 'crystals', candle: 'candle' };
const FLAME_IONS: readonly (readonly [string, number])[] = [['Na+', 6], ['Li+', 1.5], ['Sr+2', 1.5], ['Ca+2', 1], ['Ba+2', 1], ['Cu+2', 1], ['K+', 0.6]];

export class Lab {
  readonly vessels: Vessel[] = [];
  readonly burners: Burner[] = [];
  readonly links: Link[] = [];
  readonly room: Room;
  time = 0;
  readonly log: ChemEvent[] = [];
  probes: Probe[] = [];
  /** Der Draht der Flammenprobe: was an ihm hängt. */
  loop: { ion: string; color: string } | null = null;
  /** Was auf dem Löffel liegt (brennender Schwefel …). */
  spoon: Lump | null = null;
  /** Wird gerade gegossen (vom Ziehen eines Gefässes über ein anderes): mL/s. */
  pouring: { from: string; to: string; rate: number } | null = null;
  private acc = 0;
  /** Nach einer Handlung bleibt es eine Weile lebendig (was hineinfällt, braucht ein paar Bilder). */
  private busyUntil = 0;

  constructor(room: Partial<Room> = {}) {
    this.room = { T: room.T ?? T_ROOM, p: room.p ?? P_ATM_KPA };
  }

  vessel(id: string): Vessel | undefined { return this.vessels.find((v) => v.id === id); }

  /** Der Brenner unter einem Gefäss (es sitzt auf seinem Dreifuss). */
  burnerOf(v: Vessel): Burner | null {
    if (Math.abs(v.y - SEAT) > 0.5) return null;
    return this.burners.find((b) => Math.abs(b.x - v.x) < 3) ?? null;
  }

  /** Ein Gefäss neu im Gleichgewicht (nach dem Füllen: ohne Wärme, ohne Meldungen). */
  settle(v: Vessel): void {
    this.poke();
    v.respeciate();
    v.hOld = v.chemical();
    v.hFlow = 0;
    v.qIn = 0;
    const look = v.look();
    v.lastHue = colorWord(look.r, look.g, look.b, look.a);
  }

  /* -- Die Zeit ----------------------------------------------------------------------------------- */

  /** Ein Bild: so viele Schritte, wie die Zeit (mal Tempo) braucht — `true`: es tut sich etwas. */
  frame(dt: number, speed: number): number {
    for (const v of this.vessels) v.fx = emptyFx();
    this.acc += Math.min(0.4, dt) * speed;
    let n = 0;
    while (this.acc >= STEP && n < 150) { this.step(STEP); this.acc -= STEP; n += 1; }
    if (this.acc > STEP) this.acc = STEP;
    if (n > 1) {
      for (const v of this.vessels) {
        const f = v.fx;
        f.bulk /= n; f.boil /= n; f.steam /= n; f.smoke /= n; f.sparks /= n;
        for (const s of f.spots) s.rate /= n;
      }
    }
    for (const b of this.burners) if (b.tint !== null) { b.tintLeft -= dt; if (b.tintLeft <= 0) b.tint = null; }
    this.probes = this.probes.filter((p) => { p.left -= dt; return p.left > 0; });
    return this.activity();
  }

  step(h: number): void {
    this.time += h;
    for (const v of this.vessels) {
      if (v.kind !== 'burette' || v.drip <= 0 || v.over === null) continue;
      const to = this.vessel(v.over);
      const have = v.liquidMl();
      if (to === undefined || have <= 0.001) { v.drip = have <= 0.001 ? 0 : v.drip; continue; }
      const f = Math.min(1, (v.drip * h) / have);
      v.dripped += have * f;
      to.give(v.take(f, false));
    }
    if (this.pouring !== null) this.pourStep(this.pouring.from, this.pouring.to, this.pouring.rate * h);
    this.flowLinks(h);
    for (const v of this.vessels) this.stepVessel(v, h);
    this.flush();
  }

  /** Die Beobachtungen der Gefässe ins Protokoll. */
  flush(): void {
    for (const v of this.vessels) {
      if (v.events.length === 0) continue;
      this.log.push(...v.events);
      v.events.length = 0;
    }
    if (this.log.length > 240) this.log.splice(0, this.log.length - 240);
  }

  private stepVessel(v: Vessel, h: number): void {
    const t = this.time;
    if (v.kind === 'syringe') v.syringeMl = Math.min(v.size, Math.max(0.5, ((v.gasTotal() * R * v.T) / this.room.p) * 1000));
    v.respeciate();
    metalStep(v, h, t);
    liquidStep(v, h, t);
    hydrateStep(v, h, t);
    decomposeStep(v, h, t);
    saltStep(v, h, t);
    henryStep(v, h, t, this.room);
    fireStep(v, h, t);
    gasStep(v, h, t);
    iceStep(v, h, t);
    evaporateStep(v, h, this.room);
    roomStep(v, h, this.room);
    const b = this.burnerOf(v);
    heatStep(v, h, this.room, b !== null && b.on ? b : null);
    spillStep(v, t);
    v.respeciate();
    /* Die Bilanz: was an chemischer Enthalpie fehlt, ist Wärme. */
    const released = v.hOld + v.hFlow - v.chemical();
    v.T = Math.min(2500, Math.max(150, v.T + (released + v.qIn) / v.capacity()));
    boilStep(v, h, t, this.room);
    v.hOld = v.chemical();
    v.hFlow = 0;
    v.qIn = 0;
    moveLumps(v, h);
    settleStep(v, h);
    if (v.closed && v.kind !== 'syringe' && v.pressure(this.room.p) - this.room.p > 45) this.pop(v, t);
    this.watch(v, h, t);
  }

  /** Der Stopfen fliegt (zu viel Druck). */
  private pop(v: Vessel, t: number): void {
    v.closed = false;
    v.gauge = false;
    v.fx.cork = true;
    for (let i = this.links.length - 1; i >= 0; i -= 1) if (this.links[i].from === v.id) this.links.splice(i, 1);
    v.say(`cork:${Math.round(t)}`, 'Za duże ciśnienie — korek wyskakuje z naczynia!', t);
  }

  private hueSince = new Map<string, { word: string; since: number }>();

  /** Was man sehen kann: wärmer, kälter, eine neue Farbe. */
  private watch(v: Vessel, h: number, t: number): void {
    if (v.T - v.tMark > 4) v.say('warm', `Naczynie się ogrzewa — ${n2(v.T - 273.15)} °C.`, t);
    if (v.tMark - v.T > 4) v.say('cold', `Naczynie się oziębia — ${n2(v.T - 273.15)} °C.`, t);
    if (Math.abs(v.T - this.room.T) < 0.6 && Math.abs(v.tMark - this.room.T) > 0.6) { v.tMark = this.room.T; v.forget('warm'); v.forget('cold'); }
    if (!v.wet()) return;
    const look = v.look();
    if (look.turbid > 0.5) return;
    const word = colorWord(look.r, look.g, look.b, look.a);
    const seen = this.hueSince.get(v.id);
    if (seen === undefined || seen.word !== word) { this.hueSince.set(v.id, { word, since: t }); return; }
    if (t - seen.since < 0.4 || word === v.lastHue) return;
    v.forget('color:');
    v.say(`color:${word}`, word === 'bezbarwny' ? 'Roztwór odbarwia się.' : `Roztwór barwi się na ${ADVERB[word] ?? word}.`, t);
    v.lastHue = word;
    void h;
  }

  /** Etwas wurde getan: die nächsten Augenblicke zeichnen. */
  poke(): void { this.busyUntil = this.time + 1.5; }

  /** Wie viel los ist: 2 — sichtbar (Blasen, Flammen, Fallen, Giessen), 1 — leise (Abkühlen), 0 — Ruhe. */
  activity(): number {
    if (this.time < this.busyUntil) return 2;
    if (this.pouring !== null || this.probes.length > 0 || this.burners.some((b) => b.on)) return 2;
    let slow = false;
    for (const v of this.vessels) {
      const f = v.fx;
      if (f.spots.some((s) => s.rate > 1e-8) || f.bulk > 1e-8 || f.boil > 0 || f.steam > 2e-6 || f.smoke > 0 || f.precip.size > 0 || f.swirl.length > 0 || f.splash > 0 || f.cork) return 2;
      if (v.lumps.some((l) => l.burning || Math.abs(l.vy) > 0.01 || Math.abs(l.vx) > 0.02 || (l.form === 'precipitate' && l.suspended > 0.03))) return 2;
      if (v.burning || v.drip > 0 || v.foam > 0.5 || v.spray > 0) return 2;
      if (Math.abs(v.T - this.room.T) > 0.15) slow = true;
      if (!v.closed && v.gasTotal() > 0 && (Math.abs(v.frac('O2') - 0.207) > 0.004 || v.frac('CO2') > 0.004)) slow = true;
    }
    if (this.links.some((k) => k.gas > 1e-9 || k.back > 0)) return 2;
    return slow ? 1 : 0;
  }

  /* -- Schläuche ------------------------------------------------------------------------------------ */

  private flowLinks(h: number): void {
    const p0 = this.room.p;
    for (const k of this.links) {
      k.gas = 0;
      k.back = 0;
      const a = this.vessel(k.from);
      const b = this.vessel(k.to);
      if (a === undefined || b === undefined || !a.closed) continue;
      const pa = a.pressure(p0);
      const depth = b.kind !== 'syringe' && b.wet() ? Math.max(0, b.level() - 0.6) : 0;
      const head = 0.0981 * b.density() * depth;
      const pb = b.pressure(p0) + head;
      const dp = pa - pb;
      if (dp > 0) {
        const nA = a.gasTotal();
        const n = Math.min(nA * (dp / pa) * 0.5, 0.004 * dp * h);
        if (n <= 0) continue;
        k.gas = n / h;
        for (const [g, ng] of [...a.gas]) {
          const m = (n * ng) / nA;
          a.exchange(g, -m);
          b.exchange(g, m);
          if (depth > 0) this.bubbleIn(b, g, m);
        }
        if (depth > 0) b.fx.spots.push({ x: 0.15, y: 0.6, rate: n / h });
      } else if (depth > 0) {
        const top = Math.max(a.y + a.shape.H, b.y + b.shape.H) + 4;
        const lift = top - (b.y + b.level());
        const need = 0.0981 * b.density() * lift;
        /* Voll ist voll: ein Rest Gas bleibt immer (es wird zusammengedrückt, bis der Strom steht). */
        const room = a.shape.full * 0.96 - a.liquidMl() - a.solidsMl();
        if (-dp > need && b.liquidMl() > 0.01 && room > 0.05) {
          const ml = Math.min(b.liquidMl(), room, 6 * (-dp - need) * h);
          a.give(b.take(ml / b.liquidMl(), false));
          a.spray = 0.6;
          k.back = ml / h;
          a.say('suck', 'Ciśnienie w naczyniu spadło — ciecz wpływa przez rurkę do środka!', this.time);
        }
      }
    }
  }

  /** Gas perlt durch eine Flüssigkeit: was sich gut löst, bleibt (CO₂ in Kalkwasser, NH₃, HCl). */
  private bubbleIn(b: Vessel, g: GasId, n: number): void {
    const into: Partial<Record<GasId, string>> = { CO2: 'C', NH3: 'N', SO2: 'S', 'HCl(g)': 'Cl-' };
    const target = into[g];
    if (target === undefined) return;
    b.addGas(g, -n);
    b.addAq(target, n);
  }

  /* -- Giessen ------------------------------------------------------------------------------------ */

  pourStep(from: string, to: string, ml: number): void {
    const a = this.vessel(from);
    const b = this.vessel(to);
    if (a === undefined || b === undefined || a === b || ml <= 0) return;
    const have = a.liquidMl();
    if (have > 0.02) { b.give(a.take(Math.min(1, ml / have), true)); return; }
    const solids = a.lumps.filter((l) => l.where === 'in');
    if (solids.length > 0) { b.give(a.take(1, true)); for (const l of solids) { l.n = 0; } a.prune(); return; }
    /* Leer: ein Gas, das schwerer als Luft ist, fliesst hinüber (CO₂ auf die Kerze). */
    const nTot = a.gasTotal();
    if (nTot <= 0) return;
    for (const [g, n] of [...a.gas]) {
      if ((SPECIES[g]?.M ?? 29) <= 30) continue;
      const m = n * Math.min(0.5, ml / 40);
      a.exchange(g, -m);
      b.exchange(g, m);
      if (m > 1e-6 && g === 'CO2') b.say('pour-gas', 'Ciężki tlenek węgla(IV) spływa do naczynia jak niewidzialna ciecz.', this.time);
    }
  }

  /* -- Hineingeben ----------------------------------------------------------------------------------- */

  /** Ein Reagenz in ein Gefäss: Gramm, Milliliter, Tropfen oder Milliliter Gas. */
  add(v: Vessel, id: string, amount: number): boolean {
    const done = this.put(v, id, amount);
    this.poke();
    this.flush();
    return done;
  }

  private put(v: Vessel, id: string, amount: number): boolean {
    const r = reagentOf(id);
    if (r === undefined || !(amount > 0)) return false;
    const t = this.time;
    if (r.form === 'gas' && r.solid !== undefined) {
      const n = (this.room.p * amount) / 1000 / (R * this.room.T);
      v.exchange(r.solid as GasId, n);
      v.say(`act:${t}`, `→ Do naczynia wpuszczono ${r.name} (${n2(amount)} cm³).`, t);
      return true;
    }
    if (r.solid !== undefined) {
      const s = SPECIES[r.solid];
      const n = amount / (s?.M ?? 100);
      const form = FORM_OF[r.form] ?? 'piece';
      const l = v.addLump(r.solid, n, form);
      if (form === 'candle') { l.x = 0; l.y = 0; }
      v.hFlow += n * dHf(r.solid);
      /* Eis kommt aus dem Gefrierfach (−10 °C), alles andere hat Zimmertemperatur. */
      v.qIn += amount * (r.solid === 'ice' ? 2.1 : 0.8) * ((r.solid === 'ice' ? 263.15 : this.room.T) - v.T);
      v.say(`act:${t}:${l.id}`, `→ Dodano ${r.name} (${n2(amount)} g).`, t);
      return true;
    }
    v.give(portionOf(r, amount, this.room.T));
    v.say(`act:${t}:${id}`, `→ Dodano ${r.name} (${n2(amount)} ${r.form === 'indicator' ? (amount === 1 ? 'kropla' : 'krople') : 'cm³'}).`, t);
    return true;
  }

  /* -- Werkzeuge ---------------------------------------------------------------------------------- */

  /** Ein Werkzeug an einem Gefäss — die Beobachtung kommt ins Protokoll. */
  use(tool: ToolKey, v: Vessel): void {
    this.apply(tool, v);
    this.poke();
    this.flush();
  }

  private apply(tool: ToolKey, v: Vessel): void {
    const t = this.time;
    const xo = v.frac('O2');
    const xh = v.frac('H2');
    const xc = v.frac('CO2');
    const say = (text: string, eq?: string) => v.say(`tool:${tool}:${t}`, text, t, eq);
    switch (tool) {
      case 'glow': {
        if (xo > 0.3) { say('Żarzące się łuczywo zapala się jasnym płomieniem — w naczyniu jest tlen.'); this.probes.push({ tool, vessel: v.id, left: 1.8, result: 'relight' }); }
        else if (xo < 0.12 || xc > 0.35) { say('Żarzące się łuczywo gaśnie — gaz nie podtrzymuje spalania.'); this.probes.push({ tool, vessel: v.id, left: 1.8, result: 'out' }); }
        else { say('Łuczywo tli się dalej — w naczyniu jest zwykłe powietrze.'); this.probes.push({ tool, vessel: v.id, left: 1.8, result: 'glow' }); }
        return;
      }
      case 'splint': {
        if (xh > 0.04 && xo + 0.2 > 0.05) {
          v.exchange('H2', -(v.gas.get('H2') ?? 0) * 0.8);
          v.fx.pop += 1;
          say('Pyk! — gaz spala się z charakterystycznym odgłosem: to wodór.', '2H₂ + O₂ → 2H₂O');
          this.probes.push({ tool, vessel: v.id, left: 1.2, result: 'pop' });
        } else if (xo < 0.15 || xc > 0.3 || v.frac('N2') > 0.9 || v.frac('NH3') > 0.15) {
          say('Płonące łuczywo gaśnie — ten gaz nie podtrzymuje spalania.');
          this.probes.push({ tool, vessel: v.id, left: 1.6, result: 'out' });
        } else if (xo > 0.3) {
          say('Płomień łuczywa jaśnieje i powiększa się — w naczyniu jest tlen.');
          this.probes.push({ tool, vessel: v.id, left: 1.6, result: 'bright' });
        } else {
          say('Łuczywo pali się dalej spokojnie — powietrze.');
          this.probes.push({ tool, vessel: v.id, left: 1.6, result: 'burn' });
        }
        this.lightIn(v, 950);
        return;
      }
      case 'match': {
        if (this.lightIn(v, 900)) this.probes.push({ tool, vessel: v.id, left: 1, result: 'burn' });
        else say('Nie ma tu czego zapalić.');
        return;
      }
      case 'paper': {
        if (!v.wet()) { say('Papierek pozostaje suchy — w naczyniu nie ma cieczy.'); return; }
        const pH = v.spec.pH;
        const color = indicatorColor(INDICATORS.find((i) => i.id === 'universal')?.stops ?? [], pH);
        say(`Papierek wskaźnikowy barwi się: pH ≈ ${Math.round(pH)} (${pH < 6.5 ? 'odczyn kwasowy' : pH > 7.5 ? 'odczyn zasadowy' : 'odczyn obojętny'}).`);
        this.probes.push({ tool, vessel: v.id, left: 3, result: 'paper', color });
        return;
      }
      case 'wetpaper': {
        const base = v.frac('NH3') > 0.002;
        const acid = v.frac('HCl(g)') + v.frac('SO2') + v.frac('NO2') > 0.002;
        const weak = xc > 0.3;
        const color = base ? '#2878c8' : acid ? '#d0202a' : weak ? '#f0b020' : '#40a040';
        say(base ? 'Wilgotny papierek wskaźnikowy u wylotu barwi się na niebiesko — gaz o odczynie zasadowym (amoniak).'
          : acid ? 'Wilgotny papierek u wylotu barwi się na czerwono — gaz tworzy z wodą kwas.'
            : weak ? 'Wilgotny papierek lekko żółknie — tlenek węgla(IV) tworzy słaby kwas.' : 'Wilgotny papierek się nie zmienia.');
        this.probes.push({ tool, vessel: v.id, left: 3, result: 'paper', color });
        return;
      }
      case 'loop': {
        this.loop = flameSample(v);
        say(this.loop === null ? 'Drucik zanurzony — nie ma tu soli barwiących płomień.' : 'Drucik zanurzony — teraz wprowadź go do płomienia palnika.');
        return;
      }
      case 'stir': v.stir = 6; return;
      case 'stopper': {
        v.closed = !v.closed;
        if (!v.closed) { v.gauge = false; for (let i = this.links.length - 1; i >= 0; i -= 1) if (this.links[i].from === v.id) this.links.splice(i, 1); }
        return;
      }
      case 'gauge': v.gauge = !v.gauge; if (v.gauge) v.closed = true; return;
      case 'spoon': {
        if (this.spoon !== null) {
          const l = this.spoon;
          l.where = 'spoon';
          v.lumps.push(l);
          v.hFlow += l.n * dHf(l.sp);
          this.spoon = null;
          say(l.burning ? 'Łyżeczkę z płonącą substancją wprowadzono do naczynia.' : 'Łyżeczkę wprowadzono do naczynia.');
          return;
        }
        const l = v.lumps.find((x) => x.where === 'spoon') ?? v.lumps.find((x) => x.where === 'in' && (x.form === 'powder' || x.form === 'ribbon' || x.form === 'piece') && !(v.wet() && x.y < v.level()));
        if (l === undefined) { say('Na łyżeczkę nie ma czego nabrać (suche ciało stałe).'); return; }
        v.lumps = v.lumps.filter((x) => x !== l);
        v.hFlow -= l.n * dHf(l.sp);
        l.where = 'in';
        this.spoon = l;
        return;
      }
      case 'empty': {
        v.take(1, true);
        for (const l of v.lumps) l.n = 0;
        v.prune();
        v.foam = 0;
        v.burning = false;
        say('Naczynie opróżniono.');
        return;
      }
      default: return;
    }
  }

  /** Eine Flamme an etwas Brennbarem im Gefäss — `true`: es brennt jetzt. */
  lightIn(v: Vessel, source: number): boolean {
    let lit = false;
    for (const l of v.lumps) if (!l.burning && !(v.wet() && l.where === 'in' && l.y < v.level() - 0.05 && l.form !== 'candle') && igniteLump(l, source)) { lit = true; v.say(`ignite:${l.sp}:${this.time}`, `${(SPECIES[l.sp]?.name ?? l.sp).replace(/^./, (c) => c.toUpperCase())} zapala się.`, this.time); }
    const eth = v.aq.get('ethanol') ?? 0;
    if (!v.burning && eth > 0 && eth / (eth + v.water) > 0.2) { v.burning = true; lit = true; }
    return lit;
  }

  /** Der Brenner: an/aus, Luft, und was der Draht oder der Löffel mit ihm tun. */
  useBurner(b: Burner, tool: ToolKey | null): string | null {
    this.poke();
    if (tool === 'loop') {
      if (!b.on) return 'Najpierw zapal palnik.';
      if (this.loop === null) { b.tint = null; return 'Czysty drucik nie zmienia barwy płomienia.'; }
      b.tint = this.loop.color;
      b.tintLeft = 3.5;
      const text = `Płomień barwi się na ${FLAME_WORD[this.loop.ion] ?? 'inny kolor'} — ${SPECIES[this.loop.ion]?.name ?? this.loop.ion}.`;
      this.log.push({ key: `flame:${this.time}`, vessel: b.id, text, t: this.time });
      this.loop = null;
      return text;
    }
    if (tool === 'spoon' && this.spoon !== null) {
      if (!b.on) return 'Najpierw zapal palnik.';
      const lit = igniteLump(this.spoon, b.air ? 1300 : 1000);
      const text = lit ? `${(SPECIES[this.spoon.sp]?.name ?? '').replace(/^./, (c) => c.toUpperCase())} na łyżeczce zapala się w płomieniu palnika.` : 'Substancja na łyżeczce nie zapala się.';
      this.log.push({ key: `spoon:${this.time}`, vessel: b.id, text, t: this.time });
      return text;
    }
    b.on = !b.on;
    return null;
  }

  /** Der Hahn der Bürette: auf (mL/s) oder zu — mit dem, was schon abgelassen ist, im Protokoll. */
  drip(v: Vessel, rate: number): void {
    const was = v.drip;
    v.drip = Math.max(0, rate);
    const t = this.time;
    if (was <= 0 && v.drip > 0) v.say(`act:drip:${t}`, `→ Kranik biurety otwarty (${n2(v.drip)} cm³/s).`, t);
    if (was > 0 && v.drip <= 0) v.say(`act:drip:${t}`, `→ Kranik zamknięty — z biurety wypłynęło ${v.dripped.toFixed(1).replace('.', ',')} cm³.`, t);
    this.poke();
    this.flush();
  }

  /** Einen Schlauch legen (das erste Gefäss bekommt den Stopfen mit Rohr). */
  connect(from: Vessel, to: Vessel): void {
    if (from === to || this.links.some((k) => k.from === from.id && k.to === to.id)) return;
    from.closed = true;
    this.poke();
    this.links.push({ id: `l${this.links.length + 1}`, from: from.id, to: to.id, gas: 0, back: 0 });
  }
}

const ADVERB: Readonly<Record<string, string>> = {
  różowy: 'różowo', czerwony: 'czerwono', pomarańczowy: 'pomarańczowo', żółty: 'żółto', zielony: 'zielono', niebieskozielony: 'niebieskozielono',
  niebieski: 'niebiesko', fioletowy: 'fioletowo', brunatny: 'brunatno', biały: 'biało', szary: 'szaro', czarny: 'czarno'
};

const FLAME_WORD: Readonly<Record<string, string>> = {
  'Na+': 'intensywnie żółto', 'K+': 'fioletowo', 'Li+': 'karminowo', 'Ca+2': 'ceglastoczerwono', 'Sr+2': 'czerwono', 'Ba+2': 'zielono', 'Cu+2': 'niebieskozielono'
};

/** Was am Draht hängen bleibt: das Kation, das die Flamme am stärksten färbt (Natrium übertönt alles). */
function flameSample(v: Vessel): { ion: string; color: string } | null {
  let best: { ion: string; color: string } | null = null;
  let most = 0;
  const amounts = new Map<string, number>();
  for (const [id, n] of v.aq) amounts.set(id, n);
  for (const l of v.lumps) {
    const s = saltOf(l.sp);
    if (s !== undefined) amounts.set(s.cation, (amounts.get(s.cation) ?? 0) + l.n * s.nc);
  }
  for (const [ion, k] of FLAME_IONS) {
    const n = (amounts.get(ion) ?? 0) * k;
    if (n > most && n > 1e-6) { most = n; best = { ion, color: SPECIES[ion]?.flame ?? '#ffffff' }; }
  }
  return best;
}

/** Eine Portion eines Reagenzes (Lösung, Flüssigkeit, Tropfen) — im eigenen Gleichgewicht, bei Zimmertemperatur. */
export function portionOf(r: Reagent, amount: number, T: number): Portion {
  const tmp = new Vessel('~tmp', 'beaker', 600, 0, T);
  tmp.gas.clear();
  const ml = r.form === 'indicator' ? amount * 0.05 : amount;
  if (r.form === 'indicator') tmp.addAq(`ind:${r.id}`, amount);
  if (r.solute === 'H2O') tmp.water = ml / 18.015;
  else if (r.solute === 'ethanol' && r.form === 'liquid') tmp.addAq('ethanol', (ml * 0.789) / 46.07);
  else if (r.form === 'indicator') tmp.water = ml / 18.015;
  else {
    const conc = r.conc ?? 0;
    const n = (conc * ml) / 1000;
    const parts = r.solute === undefined ? [] : DISSOLVES[r.solute] ?? [];
    const soluteMass = n * parts.reduce((a, [id, k]) => a + (id === 'water' ? 18.015 : SPECIES[id === 'C' ? 'CO2(aq)' : id === 'Ac' ? 'CH3COOH' : id === 'N' ? 'NH3(aq)' : id]?.M ?? 40) * k, 0);
    const grams = ml * (1 + 0.03 * conc) - soluteMass;
    tmp.water = Math.max(0, grams) / 18.015;
    for (const [id, k] of parts) { if (id === 'water') tmp.water += n * k; else tmp.addAq(id, n * k); }
    for (const [solute, c] of r.also ?? []) {
      for (const [id, k] of DISSOLVES[solute] ?? []) { if (id === 'water') tmp.water += (c * ml * k) / 1000; else tmp.addAq(id, (c * ml * k) / 1000); }
    }
  }
  tmp.respeciate();
  clarify(tmp);
  const p = tmp.take(1, false);
  return { ...p, T };
}
