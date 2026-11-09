/* i18n-ignore-file */
/**
 * 2026-11-09 — DIE TESTWELTEN DER WELTKARTE (spec §12), ohne Datenbank und ohne echte Daten:
 * <code>
 *   bosko      die Gestalt von Bosko wie im Prototyp: 50 Orte, 4 Erzählungen, ein Block mit 3 Teilen ("part": "up"), eine
 *              Erzählung mit 3 Zweigen an einem Umsteigeort, zwei Vertiefungen (eine von zwei Linien gerufen), geborgte Fragen,
 *              ein Przegląd im alten Muster, ein Tor und eine Bedingung an einer Möglichkeit
 *   generated  n Orte und m Erzählungen, zufällig mit Samen (1 000 / 40; 5 000 für Lage und Gleise)
 *   broken     jeder Fall aus §11 und den Korrekturen (Kreis, baumelnd, unbekannter Typ, Ablauf ohne Ort …)
 * </code>
 * Die Namen sind Daten (Polnisch wie Bosko), keine Texte der Anwendung.
 */

import { readFlow, type Flow } from '../flow';
import type { Facts } from '../logic';
import type { FlowProgress, LearnerInput } from './wmState';
import type { WmCardInput, WmEntry, WmRef, WorldInput } from './wmTypes';

/* -- Bausteine ------------------------------------------------------------------------------------------------------------------- */

interface RawNode { id: string; type: string; x: number; y: number; config: Record<string, unknown> }
interface RawEdge { id: string; from: string; out: string; to: string; in: string }

/** Ein kleiner Bauer für Abläufe: jeder neue Schritt hängt an allen offenen Ausgängen. */
export class FlowBuilder {
  readonly nodes: RawNode[] = [];
  readonly edges: RawEdge[] = [];
  open: [string, string][] = [];
  private n = 0;
  constructor(private readonly prefix: string) {}
  id(kind: string): string { this.n += 1; return `${kind}${this.n}`; }
  private attach(id: string) { for (const [from, out] of this.open) this.edges.push({ id: `${this.prefix}e${this.edges.length}`, from, out, to: id, in: 'in' }); }
  step(type: string, config: Record<string, unknown> = {}, outs: readonly string[] = ['next'], id = this.id(type.slice(0, 2))): string {
    this.attach(id);
    this.nodes.push({ id, type, x: this.nodes.length * 10, y: 0, config });
    this.open = outs.map((o) => [id, o] as [string, string]);
    return id;
  }
  show(of: string, id?: string): string { return this.step('show', { of }, ['next'], id); }
  ask(of: string): string { return this.step('question', { of }, ['right', 'wrong']); }
  detour(flow: string): string { return this.step('detour', { flow }, ['done', 'skip']); }
  /** Eine Wahl: je Möglichkeit ein Zweig; danach hängen alle offenen Enden der Zweige zusammen. */
  choice(options: readonly { label: string; condition?: unknown }[], branches: readonly ((b: FlowBuilder) => void)[]): string {
    const id = this.step('choice', { options: options.map((o) => ({ label: o.label, ...(o.condition === undefined ? {} : { condition: o.condition }) })) }, []);
    const ends: [string, string][] = [];
    branches.forEach((build, i) => { this.open = [[id, `o${i}`]]; build(this); ends.push(...this.open); });
    this.open = ends;
    return id;
  }
  /** Ein Tor: geht weiter, wenn die Bedingung gilt; sonst zum Ende. */
  gate(condition: unknown): string {
    const id = this.step('condition', { condition }, ['yes', 'no']);
    const endId = this.id('stop');
    this.nodes.push({ id: endId, type: 'end', x: 0, y: 50, config: {} });
    this.edges.push({ id: `${this.prefix}e${this.edges.length}`, from: id, out: 'no', to: endId, in: 'in' });
    this.open = [[id, 'yes']];
    return id;
  }
  end(): string { const id = this.step('end', {}, []); this.open = []; return id; }
  flow(id: string, data: Record<string, unknown>): Flow {
    return readFlow(id, { start: this.nodes[0]?.id ?? '', ...data, graph: { nodes: this.nodes, edges: this.edges } });
  }
}

const ref = (field: string, to: string, extra: Partial<WmRef> = {}): WmRef => ({ field, to, ...extra });
const wymaga = (to: string): WmRef => ref('wymaga', to, { prerequisite: 'up', structure: 'up' });

/** Ein Thema mit `n` Fragen: die Einträge (Thema + Fragen) und die Karten. */
function topic(entries: WmEntry[], cards: WmCardInput[], id: string, label: string, n: number, needs: readonly string[], extra: readonly WmRef[] = []): string[] {
  entries.push({ id, kinds: ['temat'], label, refs: [...needs.map(wymaga), ...extra] });
  const qs: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const q = `q/${id}/${i}`;
    entries.push({ id: q, kinds: ['question'], label: `${label} — ${i + 1}`, refs: [ref('about', id)] });
    cards.push({ key: q, question: q, about: [id], explain: [`s/${id}`] });
    qs.push(q);
  }
  return qs;
}

/* -- 1. Bosko-Gestalt ------------------------------------------------------------------------------------------------------------- */

const HX: readonly (readonly [string, string, readonly string[]])[] = [
  ['becchi', 'Dom w Becchi bez ojca', []], ['sen', 'Sen dziewięciolatka', ['becchi']], ['kuglarz', 'Mały kuglarz', ['sen']], ['antoni', 'Antoni i dwunastolatek', ['becchi']], ['przyj', 'Przyjaciele i wybór drogi', ['antoni']],
  ['semch', 'Seminarium w Chieri', ['przyj']], ['comollo', 'Comollo: przyjaźń i śmierć', ['przyj']], ['swiec', 'Święcenia (1840–1841)', ['semch']], ['konwikt', 'Konwikt i ksiądz Cafasso', ['swiec']],
  ['narodz', 'Narodziny oratorium', ['konwikt']], ['barolo', 'Markiza Barolo i Rifugio', ['narodz']], ['wedr', 'Wędrujące oratorium', ['narodz']], ['murarze', 'Oratorium małych murarzy', ['narodz']], ['choroba', 'Choroba i powrót (1846)', ['wedr']],
  ['goracz', 'Gorączka roku 1848', ['choroba']], ['polityka', '„Polityka Ojcze nasz”', ['goracz']], ['sierota', 'Sierota z Valsesii', ['choroba']], ['ciern', 'Rok ciernisty', ['goracz']],
  ['domkos', 'Dom i kościół (1850–1852)', ['choroba']], ['warsz', 'Pół tuzina warsztatów', ['domkos']], ['cagrua', 'Cagliero, Rua i konwikt studentów', ['domkos']], ['s1854', '1854: „Będziemy się nazywać salezjanami”', ['warsz', 'cagrua']], ['savio', 'Dominik Savio', ['domkos']], ['s1855', '1855: chłopcy z Generali i pierwsze śluby', ['s1854']], ['magone', 'Michał Magone (1857–1859)', ['savio', 'warsz']],
  ['wysn', 'Wyśnione sanktuarium', ['s1859', 'w_sny']], ['nowa', '„Nowa faza”: kolegia', ['s1859']], ['mirab', 'Ksiądz Rua i Mirabello', ['nowa', 'cagrua']], ['monfer', 'Wędrówki po Monferrato', ['domkos']],
  ['pomoc', 'Pomocnicy: współpracownicy', ['s1859']], ['isc', 'Iść daleko: pierwsza wyprawa', ['pomoc', 'mirab']], ['patag', 'Patagonia, ziemia obiecana', ['isc']], ['franc', 'Franciszek, Euzebiusz i inni', ['isc']], ['cagbis', 'Jan Cagliero biskupem', ['patag']],
  ['arcyb', 'Ksiądz Bosko i arcybiskup', ['nowa']], ['placz', 'Wielki płacz (1883–1887)', ['arcyb']], ['pozeg', 'Pożegnanie z ziemią (1888)', ['placz']],
  ['w_mama', 'Wątek: Mamma Małgorzata', ['becchi', 'domkos']], ['w_sny', 'Wątek: sny i Maryja Wspomożycielka', ['sen']], ['w_kapl', 'Wątek: droga do kapłaństwa', ['semch', 'swiec']], ['w_ludzie', 'Wątek: ludzie wokół', ['konwikt', 'barolo']],
  ['w_system', 'Wątek: system prewencyjny', ['narodz', 'savio', 'magone']], ['w_bosko', 'Wątek: ksiądz Bosko', ['becchi']], ['w_orat', 'Wątek: oratorium', ['narodz', 'wedr']], ['w_pisma', 'Wątek: pisma i prasa', ['polityka', 'magone']],
  ['w_zgrom', 'Wątek: Zgromadzenie', ['s1854', 's1859']], ['w_misje', 'Wątek: misje', ['isc', 'patag']]
];
const PARTS: readonly (readonly [string, string])[] = [['s1859a', '18.12.1859: spotkanie założycielskie'], ['s1859b', 'Pierwsi członkowie Towarzystwa'], ['s1859c', 'Rua dyrektorem duchownym']];

export interface BoskoFixture {
  readonly input: WorldInput;
  /** Die Linien (Ablauf-Kennungen). */
  readonly lines: { readonly L1: string; readonly L2: string; readonly L3: string; readonly L4: string; readonly sny: string; readonly misje: string };
  /** Die Wahl mit drei Zweigen (Linie L4, an `domkos`). */
  readonly fork: string;
}

export function boskoWorld(): BoskoFixture {
  const entries: WmEntry[] = [];
  const cards: WmCardInput[] = [];
  const qs = new Map<string, string[]>();
  HX.forEach(([id, label, needs], i) => {
    if (id === 's1859') return;
    qs.set(id, topic(entries, cards, id, label, 10 + ((i * 7 + 3) % 6), needs));
  });
  /* Der Block „18 grudnia 1859" — ohne eigene Fragen; seine drei Teile zeigen mit "part": "up" auf ihn. */
  entries.push({ id: 's1859', kinds: ['temat'], label: '18 grudnia 1859: Towarzystwo', refs: [wymaga('s1854'), wymaga('s1855'), wymaga('magone')] });
  for (const [id, label] of PARTS) qs.set(id, topic(entries, cards, id, label, 15, ['s1854', 's1855', 'magone'], [ref('czesc', 's1859', { part: 'up' })]));
  /* Folien: je Thema eine, die über `o_czym` auf ihr Thema zeigt (Bosko: „Slajd opowieści"). */
  for (const id of qs.keys()) entries.push({ id: `s/${id}`, kinds: ['slajd'], label: `Slajd: ${id}`, refs: [ref('o_czym', id)] });

  /* Einheiten (Części opowieści). */
  const unit = (id: string, label: string, needs: readonly string[], extra: readonly WmRef[] = []) => entries.push({ id, kinds: ['czesc'], label, refs: [...needs.map((n) => ref('wymaga', n, { prerequisite: 'up' })), ...extra] });
  unit('u/L1', 'Z Janem', []);
  unit('u/L2', 'Z Mamą Małgorzatą', []);
  unit('u/L3', 'Z Michałem Ruą', ['narodz']);
  unit('u/L4', 'Z chłopcami z warsztatów', ['domkos', 'u/L2']);
  unit('u/sny', 'Sny', ['u/L1'], [ref('nalezy', 'u/L1', { structure: 'up' })]);
  unit('u/misje', 'Misje', ['u/L4'], [ref('nalezy', 'u/L4', { structure: 'up' })]);

  /* Wer welche Karten eines Themas fragt: die erste Linie 70 %, eine zweite den Rest — die letzte Karte grosser Themen nie. */
  const askedBy = new Map<string, number>();
  const asks = (b: FlowBuilder, id: string, count = 2) => {
    const list = qs.get(id) ?? [];
    const visits = askedBy.get(id) ?? 0;
    askedBy.set(id, visits + 1);
    const last = list.length >= 12 ? list.length - 1 : list.length;
    const cut = Math.ceil(list.length * 0.7);
    const mine = visits === 0 ? list.slice(0, cut) : visits === 1 ? list.slice(cut, last) : [];
    for (const q of mine.slice(0, Math.max(count, mine.length))) b.ask(q);
  };
  const stop = (b: FlowBuilder, id: string) => { b.show(`s/${id}`); asks(b, id); };

  /* L1 „Z Janem" — vom Haus quer durch; bei `sen` eine geborgte Frage über `w_sny` und der Abstecher „Sny"; ein Tor vor `wysn`. */
  const L1 = new FlowBuilder('L1');
  for (const id of ['becchi', 'sen']) stop(L1, id);
  L1.ask(qs.get('w_sny')![0]);
  L1.detour('f/sny');
  for (const id of ['kuglarz', 'przyj', 'semch', 'swiec', 'konwikt', 'narodz', 'wedr', 'choroba', 'goracz', 'polityka', 'ciern', 'domkos', 'warsz', 's1854', 's1855', 's1859a']) stop(L1, id);
  L1.gate({ type: 'knowness', of: 'w_sny', band: 'learned' });
  for (const id of ['wysn', 'nowa', 'mirab', 'pomoc', 'isc', 'patag', 'cagbis', 'placz', 'pozeg']) stop(L1, id);
  L1.step('review', { of: 'story', threshold: 0.9 }, ['passed', 'notyet']);
  L1.end();

  /* L2 „Z Mamą Małgorzatą" — mit einem Przegląd im alten Muster (ab `review`: dieselben Fragen noch einmal) und dem Abstecher „Sny". */
  const L2 = new FlowBuilder('L2');
  stop(L2, 'becchi');
  L2.detour('f/sny');
  for (const id of ['antoni', 'przyj', 'semch', 'comollo', 'swiec', 'choroba', 'domkos', 'savio']) stop(L2, id);
  const reviewAt = L2.step('set', { actions: [{ type: 'set', value: 'przeglad', to: 0 }] }, ['next'], 'review0');
  for (const id of ['antoni', 'comollo']) for (const q of (qs.get(id) ?? []).slice(0, 2)) L2.ask(q);
  L2.step('condition', { condition: { type: 'value', value: 'przeglad', op: 'ge', than: 3 } }, ['yes', 'no']);
  L2.end();

  /* L3 „Z Michałem Ruą" — beginnt mitten in der Welt (die Einheit verlangt `narodz`). */
  const L3 = new FlowBuilder('L3');
  for (const id of ['narodz', 'barolo', 'murarze', 'choroba', 'sierota', 'ciern', 'domkos', 'cagrua', 's1854', 's1855', 's1859b', 'mirab', 'arcyb', 'placz', 'pozeg']) stop(L3, id);
  L3.end();

  /* L4 „Z chłopcami z warsztatów" — an `domkos` drei Zweige (der zweite verlangt `comollo`), die sich bei `magone` treffen. */
  const L4 = new FlowBuilder('L4');
  stop(L4, 'domkos');
  const fork = L4.choice(
    [{ label: 'Do warsztatów' }, { label: 'Do studentów', condition: { type: 'knowness', of: 'comollo', band: 'known' } }, { label: 'Z Dominikiem Savio' }],
    [(b) => stop(b, 'warsz'), (b) => stop(b, 'cagrua'), (b) => stop(b, 'savio')]
  );
  for (const id of ['magone', 's1859c', 'monfer', 'nowa', 'pomoc', 'isc']) stop(L4, id);
  L4.detour('f/misje');
  for (const id of ['franc', 'cagbis']) stop(L4, id);
  L4.end();

  /* Vertiefungen: „Sny" (von L1 bei `sen` und von L2 bei `becchi` gerufen), „Misje" (von L4 bei `isc`). */
  const sny = new FlowBuilder('SN');
  for (const id of ['w_sny', 'w_bosko']) stop(sny, id);
  sny.end();
  const misje = new FlowBuilder('MI');
  for (const id of ['w_misje']) stop(misje, id);
  misje.end();

  const flows = [
    L1.flow('f/L1', { name: 'Z Janem', unit: 'u/L1', _ref: '@fx/L1' }),
    L2.flow('f/L2', { name: 'Z Mamą Małgorzatą', unit: 'u/L2', review: reviewAt }),
    L3.flow('f/L3', { name: 'Z Michałem Ruą', unit: 'u/L3' }),
    L4.flow('f/L4', { name: 'Z chłopcami z warsztatów', unit: 'u/L4' }),
    sny.flow('f/sny', { name: 'Sny', unit: 'u/sny' }),
    misje.flow('f/misje', { name: 'Misje', unit: 'u/misje' })
  ];
  return { input: { entries, cards, flows }, lines: { L1: 'f/L1', L2: 'f/L2', L3: 'f/L3', L4: 'f/L4', sny: 'f/sny', misje: 'f/misje' }, fork };
}

/* -- 2./3. Erzeugte Welten --------------------------------------------------------------------------------------------------------- */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedOptions {
  readonly places: number;
  readonly stories: number;
  readonly seed?: number;
  /** Halte je Erzählung (ungefähr). */
  readonly stops?: number;
  /** Fragen je Ort (min, max). */
  readonly cards?: readonly [number, number];
}

/** n Orte in Schichten mit 0–3 Voraussetzungen, m Erzählungen entlang der Voraussetzungen; einige mit Zweigen und Abstechern. */
export function generatedWorld(o: GeneratedOptions): WorldInput {
  const r = rng(o.seed ?? 7);
  const entries: WmEntry[] = [];
  const cards: WmCardInput[] = [];
  const ids: string[] = [];
  const builds = new Map<string, string[]>();
  const counts = new Map<string, number>();
  const [cmin, cmax] = o.cards ?? [8, 14];
  for (let i = 0; i < o.places; i += 1) {
    const id = `p${i}`;
    const needs: string[] = [];
    if (i > 0) {
      const k = r() < 0.12 ? 0 : 1 + Math.floor(r() * 3);
      for (let j = 0; j < k; j += 1) {
        const back = 1 + Math.floor(r() * Math.min(i, 40));
        const p = `p${i - back}`;
        if (!needs.includes(p)) needs.push(p);
      }
    }
    for (const p of needs) { const l = builds.get(p) ?? []; l.push(id); builds.set(p, l); }
    entries.push({ id, kinds: ['topic'], label: `Miejsce ${i}`, refs: needs.map(wymaga) });
    entries.push({ id: `s/${id}`, kinds: ['slide'], label: `Slajd ${i}`, refs: [ref('o_czym', id)] });
    const n = cmin + Math.floor(r() * (cmax - cmin + 1));
    counts.set(id, n);
    for (let q = 0; q < n; q += 1) {
      const qid = `q/${id}/${q}`;
      cards.push({ key: qid, question: qid, about: [id] });
    }
    ids.push(id);
  }
  const flows: Flow[] = [];
  const byId = new Map(entries.map((e) => [e.id, e] as const));
  const stopsPer = o.stops ?? 25;
  const deepCount = Math.max(1, Math.floor(o.stories / 8));
  /* Vertiefungen: kurze Linien über zwei, drei Orte. */
  const deep: string[] = [];
  for (let d = 0; d < deepCount; d += 1) {
    const b = new FlowBuilder(`D${d}`);
    const start = Math.floor(r() * o.places);
    let at = ids[start];
    for (let k = 0; k < 2 + Math.floor(r() * 2); k += 1) {
      b.show(`s/${at}`);
      b.ask(`q/${at}/0`);
      const next = builds.get(at);
      if (next === undefined || next.length === 0) break;
      at = next[Math.floor(r() * next.length)];
    }
    b.end();
    const unitId = `u/d${d}`;
    entries.push({ id: unitId, kinds: ['unit'], label: `Pogłębienie ${d}`, refs: [] });
    flows.push(b.flow(`f/d${d}`, { name: `Pogłębienie ${d}`, unit: unitId }));
    deep.push(`f/d${d}`);
  }
  for (let s = 0; s < o.stories; s += 1) {
    const b = new FlowBuilder(`S${s}`);
    let at = ids[Math.floor(r() * Math.min(o.places, Math.max(20, o.places / 3)))];
    const seen = new Set<string>();
    const walk = (bb: FlowBuilder, count: number) => {
      for (let k = 0; k < count; k += 1) {
        if (seen.has(at)) break;
        seen.add(at);
        bb.show(`s/${at}`);
        const n = counts.get(at) ?? 0;
        for (let q = 0; q < Math.min(n, 3); q += 1) bb.ask(`q/${at}/${(s + q) % n}`);
        if (r() < 0.06 && deep.length > 0) bb.detour(deep[Math.floor(r() * deep.length)]);
        const next = (builds.get(at) ?? []).filter((x) => !seen.has(x));
        if (next.length === 0) break;
        at = next[Math.floor(r() * next.length)];
      }
    };
    walk(b, Math.floor(stopsPer / 2));
    /* Jede vierte Erzählung: drei Zweige, die sich wieder treffen. */
    if (s % 4 === 1) {
      const from = at;
      const options = (builds.get(from) ?? []).filter((x) => !seen.has(x)).slice(0, 3);
      if (options.length >= 2) {
        const join = (builds.get(options[0]) ?? [])[0];
        b.choice(options.map((x) => ({ label: `Przez ${x}` })), options.map((x) => (bb: FlowBuilder) => { bb.show(`s/${x}`); bb.ask(`q/${x}/0`); }));
        for (const x of options) seen.add(x);
        if (join !== undefined && !seen.has(join)) at = join;
      }
    }
    walk(b, stopsPer - Math.floor(stopsPer / 2));
    b.end();
    const unitId = `u/s${s}`;
    const first = b.nodes.find((n) => n.type === 'show')?.config.of as string | undefined;
    const firstPlace = first?.slice(2);
    const req = s % 9 === 0 || firstPlace === undefined ? [] : (byId.get(firstPlace)?.refs ?? []).filter((x) => x.prerequisite === 'up').slice(0, 1).map((x) => x.to);
    entries.push({ id: unitId, kinds: ['unit'], label: `Opowieść ${s}`, refs: req.map((x) => ref('wymaga', x, { prerequisite: 'up' })) });
    flows.push(b.flow(`f/s${s}`, { name: `Opowieść ${s}`, unit: unitId }));
  }
  /* Die Fragen als Einträge: nur ihre Art zählt (die Karten tragen „about"). */
  for (const c of cards) entries.push({ id: c.question, kinds: ['question'], label: c.question, refs: [ref('about', c.about[0])] });
  return { entries, cards, flows };
}

/* -- 4. Die kaputte Welt ---------------------------------------------------------------------------------------------------------- */

export function brokenWorld(): WorldInput {
  const entries: WmEntry[] = [];
  const cards: WmCardInput[] = [];
  const t = (id: string, n: number, needs: readonly string[] = [], extra: readonly WmRef[] = []) => topic(entries, cards, id, `Temat ${id}`, n, needs, extra);
  const a = t('A', 4);
  const b = t('B', 4, ['A']);
  t('C', 3, ['B']);
  /* Kreis: X → Y → Z → X. */
  t('X', 3, ['Z']); t('Y', 3, ['X']); t('Z', 3, ['Y']);
  /* Baumelnd: verlangt etwas, das es nicht gibt. */
  t('D', 3, ['ghost']);
  /* Ein Ort ohne Linie. */
  t('lonely', 5);
  /* Ein Feld mit "part" UND "prerequisite". */
  t('P', 3, [], [ref('mix', 'A', { part: 'up', prerequisite: 'up' })]);
  /* Eine Karte über etwas, das es nicht gibt. */
  cards.push({ key: 'q/ghost', question: 'q/ghost', about: ['nowhere'] });
  for (const id of ['A', 'B', 'C', 'X', 'Y', 'Z', 'D', 'P']) entries.push({ id: `s/${id}`, kinds: ['slajd'], label: `Slajd ${id}`, refs: [ref('o_czym', id)] });
  entries.push({ id: 'note', kinds: ['notatka'], label: 'Notatka bez miejsca', refs: [] });

  /* Eine Linie, die mitten in der Welt beginnt (verlangt B) und eine Karte verlangt, die sie selbst erst später einführt (C). */
  entries.push({ id: 'u/mid', kinds: ['czesc'], label: 'Środek', refs: [ref('wymaga', 'B', { prerequisite: 'up' }), ref('wymaga', 'C', { prerequisite: 'up' })] });
  const mid = new FlowBuilder('M');
  mid.show('s/A'); mid.ask(a[0]);
  mid.choice([{ label: 'Kod', condition: { type: 'qr', code: 'tajne' } }, { label: 'Dalej' }], [(x) => { x.show('s/X'); x.ask('q/X/0'); }, (x) => { x.show('s/Y'); x.ask('q/Y/0'); }]);
  mid.gate({ type: 'and', items: [{ type: 'knowness', of: 'A', band: 'known' }, { type: 'geo-fence', radius: 5 }] });
  mid.show('s/C'); mid.ask('q/C/0');
  mid.detour('f/missing');
  mid.end();
  /* Ein Ablauf ohne erkennbaren Ort. */
  entries.push({ id: 'u/empty', kinds: ['czesc'], label: 'Pusty', refs: [] });
  const empty = new FlowBuilder('E');
  empty.show('note');
  empty.end();
  /* Ein Ablauf, der an seiner zweiten Folie beginnt; dazu eine Folie, die nie erreicht wird. */
  entries.push({ id: 'u/late', kinds: ['czesc'], label: 'Późno', refs: [] });
  const late = new FlowBuilder('L');
  late.show('s/A', 'sA');
  late.show('s/B', 'sB');
  late.ask(b[0]);
  late.end();
  /* Einheiten wie Bosko: ein Stamm ruft eine Vertiefung, die verlangt, was der Stamm verlangt (nicht den Stamm); ein Mitglied des Stammes wird nie gerufen. */
  entries.push({ id: 'u/stage', kinds: ['czesc'], label: 'Etap', refs: [ref('wymaga', 'A', { prerequisite: 'up' })] });
  entries.push({ id: 'u/deep', kinds: ['czesc'], label: 'Pogłębienie', refs: [ref('wymaga', 'A', { prerequisite: 'up' }), ref('nalezy', 'u/stage', { structure: 'up' })] });
  entries.push({ id: 'u/member', kinds: ['czesc'], label: 'Członek', refs: [ref('nalezy', 'u/stage', { structure: 'up' })] });
  const stage = new FlowBuilder('ST');
  stage.show('s/B'); stage.ask(b[1]); stage.detour('f/deep'); stage.end();
  const deep = new FlowBuilder('DP');
  deep.show('s/Z'); deep.ask('q/Z/1'); deep.end();
  const member = new FlowBuilder('MB');
  member.show('s/D'); member.ask('q/D/0'); member.end();
  const flows = [
    mid.flow('f/mid', { name: 'Środek', unit: 'u/mid' }),
    empty.flow('f/empty', { name: 'Pusty', unit: 'u/empty' }),
    late.flow('f/late', { name: 'Późno', unit: 'u/late', start: 'sB' }),
    stage.flow('f/stage', { name: 'Etap', unit: 'u/stage' }),
    deep.flow('f/deep', { name: 'Pogłębienie', unit: 'u/deep' }),
    member.flow('f/member', { name: 'Członek', unit: 'u/member' }),
    new FlowBuilder('G').flow('f/ghostunit', { name: 'Bez jednostki', unit: 'u/none' })
  ];
  return { entries, cards, flows };
}

/* -- Lernende ohne Datenbank ---------------------------------------------------------------------------------------------------------- */

export interface FakeLearner {
  /** Kenntnis je Karte (fehlt: 0, nie gefragt). */
  readonly knowness?: Readonly<Record<string, number>>;
  /** Je Ablauf: besuchte Schritte und ob er zu Ende ist. */
  readonly progress?: Readonly<Record<string, { readonly visited: readonly string[]; readonly done?: boolean }>>;
  readonly levels?: Readonly<Record<string, number>>;
  readonly values?: Readonly<Record<string, number>>;
  readonly now?: number;
  /** Ausgesetzte Karten (Step 3 · 1). */
  readonly suspended?: readonly string[];
  /** Orte mit einem Durchgang „Mistrzowsko". */
  readonly perfect?: readonly string[];
}

export function fakeLearner(f: FakeLearner = {}): LearnerInput {
  const now = f.now ?? Date.UTC(2026, 10, 9, 12);
  const prog = new Map<string, FlowProgress>(Object.entries(f.progress ?? {}).map(([k, v]) => [k, { visited: new Set(v.visited), done: v.done === true }]));
  const facts: Facts = {
    values: f.values ?? {}, knowness: (id) => f.knowness?.[id] ?? 0, answered: () => null,
    visited: new Set([...prog.values()].flatMap((p) => [...p.visited])), now: new Date(now),
    flow: (id) => { const p = prog.get(id); return p === undefined ? undefined : { started: true, done: p.done, goals: p.done ? ['przeglad'] : [] }; }
  };
  return {
    now, facts,
    knowness: (card) => f.knowness?.[card] ?? 0,
    progress: (flow) => prog.get(flow),
    level: (place) => f.levels?.[place] ?? 0,
    perfect: (place) => f.perfect?.includes(place) === true,
    ...(f.suspended === undefined ? {} : { suspended: ((set) => (card: string) => set.has(card))(new Set(f.suspended)) })
  };
}
