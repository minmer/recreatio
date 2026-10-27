/**
 * DIE STRUKTUR EINES WYWÓD (2026-10-25) — gerechnet, nie gespeichert.
 *
 * Kein eingebautes Schema: der Besitzer erklärt in SEINEN Rodzajen, welche Verweisfelder eine
 * Struktur bilden (`FieldDef.structure`):
 * <code>
 *   up     dieser Eintrag liegt UNTER dem, worauf er zeigt      („Należy do", „Odpowiada na")
 *   down   was er nennt, liegt unter IHM                         („Argumenty za", „Zarzuty")
 * </code>
 * Daraus entsteht hier, für jeden Leser aus dem, was er lesen kann: wer unter wem liegt, die
 * Wurzeln, die Reihenfolge — nach der STELLE IM WERK (ein Verweis mit Stelle auf ein Werk der
 * Bibliothek, gelesen nach dessen Układ miejsc; ohne lesbares Werk wird der Układ aus den Stellen
 * selbst erkannt) —, die Reihenfolge des Textes und die Stelle relativ zur Wurzel („arg. 1",
 * „co.", „ad 1"). Die Bibliothek erfährt davon nichts.
 */

import { fieldsOf, readNumber, valuesOf, type Entity, type FieldDef, type Lookup } from './schema';
import { formatPlace, pageOrdinal, parsePlace, placeSortKey, workScheme, workOptions, type Path, type Place, type PlaceOptions, type SchemeId } from '../library/locations';

/** Was die Rechnung von einer Baza braucht — `CogitaLibrary` und der Kontext einer Auswahl haben es. */
export interface StructureSource {
  entity(id: string): Entity | undefined;
  readonly look: Lookup;
  /** Wer auf einen Eintrag zeigt (Felder und Zapis). */
  pointing(id: string): ReadonlySet<string>;
}

/* -- Die Felder ------------------------------------------------------------------------------- */

/** Die Strukturfelder eines Eintrags — streng nach der Erklärung im Rodzaj, nie nach dem Schlüssel. */
export const structureFields = (entity: Entity, look: Pick<Lookup, 'kind'>): FieldDef[] =>
  fieldsOf(entity, look).filter((f) => f.type === 'ref' && (f.structure === 'up' || f.structure === 'down'));

/** Hat dieser Eintrag (über einen seiner Rodzaje) Felder einer Struktur? */
export const isStructured = (entity: Entity, look: Pick<Lookup, 'kind'>): boolean => structureFields(entity, look).length > 0;

const targets = (entity: Entity, field: FieldDef): string[] =>
  valuesOf(entity, field).map((v) => v.value).filter((v): v is string => typeof v === 'string' && v !== '' && v !== entity.id);

/** Die Einträge direkt ÜBER diesem: seine `up`-Felder und wer ihn in einem `down`-Feld nennt. */
export function parentsOf(id: string, src: StructureSource): string[] {
  const entity = src.entity(id);
  const out: string[] = [];
  if (entity !== undefined) for (const f of structureFields(entity, src.look)) if (f.structure === 'up') out.push(...targets(entity, f));
  for (const from of src.pointing(id)) {
    const other = src.entity(from);
    if (other === undefined || from === id) continue;
    if (structureFields(other, src.look).some((f) => f.structure === 'down' && targets(other, f).includes(id))) out.push(from);
  }
  return [...new Set(out)].filter((x) => src.entity(x) !== undefined);
}

/**
 * Die Einträge direkt UNTER diesem: wer ihn in einem `up`-Feld nennt, und was seine `down`-Felder
 * nennen — diese in ihrer Reihenfolge im Feld (`listed`: die Stelle in der Liste, für Gleichstand).
 */
export function childrenOf(id: string, src: StructureSource): { id: string; listed: number }[] {
  const out = new Map<string, number>();
  const entity = src.entity(id);
  if (entity !== undefined) {
    let n = 0;
    for (const f of structureFields(entity, src.look)) if (f.structure === 'down') for (const t of targets(entity, f)) { if (!out.has(t)) out.set(t, n); n += 1; }
  }
  for (const from of src.pointing(id)) {
    if (from === id || out.has(from)) continue;
    const other = src.entity(from);
    if (other === undefined) continue;
    if (structureFields(other, src.look).some((f) => f.structure === 'up' && targets(other, f).includes(id))) out.set(from, Number.MAX_SAFE_INTEGER);
  }
  return [...out].filter(([x]) => src.entity(x) !== undefined).map(([x, listed]) => ({ id: x, listed }));
}

/* -- Die Stelle im Werk ------------------------------------------------------------------------- */

export interface StepPlace {
  /** Das Werk (eine Kennung, auch wenn dieser Leser es nicht lesen kann). */
  readonly work: string;
  readonly locator: string;
  /** Das Feld, das die Stelle trägt. */
  readonly field: FieldDef;
}

const isWorkTarget = (field: FieldDef, target: Entity | undefined): boolean =>
  target !== undefined ? target.kinds.includes('work') : (field.to ?? []).includes('work');

/**
 * DIE STELLE EINES EINTRAGS IM WERK: der erste Wert eines Verweises mit Stelle, der auf ein Werk
 * der Bibliothek zeigt (ohne Stelle: das ganze Werk — `locator: ''`). Strukturfelder zählen nicht.
 */
export function placeOf(entity: Entity, src: Pick<StructureSource, 'entity' | 'look'>): StepPlace | null {
  for (const f of fieldsOf(entity, src.look)) {
    if (f.type !== 'ref' || f.structure !== undefined) continue;
    for (const v of valuesOf(entity, f)) {
      if (typeof v.value !== 'string' || v.value === '') continue;
      if (f.locator !== true && !(f.to ?? []).includes('work')) continue;
      if (!isWorkTarget(f, src.entity(v.value))) continue;
      return { work: v.value, locator: (v.locator ?? '').trim(), field: f };
    }
  }
  return null;
}

/**
 * Die Układy, die eine Stelle als Struktur lesen — in dieser Reihenfolge gewinnt bei Gleichstand der
 * frühere: zuerst die strengen (Quaestio und Artikel, ein Buch der Schrift, Dezimalzahlen, ein Wort
 * der Gliederung), zuletzt die nachsichtigen — „Paragrafy" und „Numerowane" lesen jede Zahl nach
 * einem beliebigen Wort („rozdz. 3" wäre sonst „§ 3" oder „nr 3").
 */
const STRUCTURAL: readonly SchemeId[] = ['aquinas', 'bible', 'decimal', 'outline', 'sections', 'numbered'];

/**
 * DER UKŁAD AUS DEN STELLEN SELBST — für einen Leser, der das Werk nicht lesen kann (kein Zugang,
 * die Bibliothek nicht unter den Quellen, das Werk gelöscht). Eine Stelle zählt für einen Układ nur,
 * wenn er sie GANZ liest (nichts bleibt übrig, keine Seiten dabei); Seiten gewinnen bei Gleichstand;
 * „§" am Anfang spricht für die Paragrafy eines Werks (Dociekania), nicht für eine Gliederung.
 * Nichts davon wird gespeichert.
 */
export function recogniseScheme(locators: readonly string[]): SchemeId {
  const list = locators.map((l) => l.trim()).filter((l) => l !== '');
  /*
    2026-10-25 — eine Gliederung liest eine Anmerkung („rozdz. 3, przypis 2") nicht, doch die Stelle ist ihre;
    nur eine nackte Zahl, die sie nicht lesen kann („cz. II, xi": eine Bemerkung der Dociekania), spricht gegen sie.
  */
  const bare = /^[0-9ivxlcdm]+(?:\s*-\s*[0-9ivxlcdm]+)?$/i;
  const whole = (l: string, scheme: SchemeId) => {
    const p = parsePlace(l, scheme);
    if (p.spans.length === 0 || p.pages.length > 0) return false;
    return p.rest === '' || (scheme === 'outline' && !p.rest.split(/,\s*/).some((x) => bare.test(x.trim())));
  };
  const pages = list.filter((l) => { const p = parsePlace(l, 'pages'); return p.pages.length > 0 && p.spans.length === 0 && p.rest === ''; }).length;
  const sectionMarks = list.length > 0 && list.every((l) => /^§/.test(l));
  let best: SchemeId = 'pages';
  let most = 0;
  for (const scheme of sectionMarks ? (['sections', ...STRUCTURAL.filter((s) => s !== 'sections')] as const) : STRUCTURAL) {
    const read = list.filter((l) => whole(l, scheme)).length;
    if (read > most) { most = read; best = scheme; }
  }
  return pages >= most ? 'pages' : best;
}

/** Wie die Stellen eines Werks gelesen werden: nach seinem Układ — oder, ohne lesbares Werk, erkannt. */
export function schemeFor(work: string, src: Pick<StructureSource, 'entity'>, locators: readonly string[]): { scheme: SchemeId; recognised: boolean; options: ReturnType<typeof workOptions> } {
  const entity = src.entity(work);
  if (entity !== undefined && entity.kinds.includes('work')) return { scheme: workScheme(entity.data), recognised: false, options: workOptions(entity.data) };
  return { scheme: recogniseScheme(locators), recognised: true, options: {} };
}

/**
 * Eine Stelle als Schlüssel zum Ordnen. Seiten (im Układ „strony") nach der ersten Seite und bei
 * gleichem Anfang das Grössere zuerst (das Ganze vor seinen Teilen) — auch wenn ein Kapitel davorsteht.
 */
function placeKey(place: Place, options: PlaceOptions = {}): string {
  if (place.scheme === 'pages' && place.pages.length > 0) {
    /* 2026-10-27 — Seiten in Serien: in der Reihenfolge der Serien des Werks (die Bibliothek ordnet sie); bei gleichem Anfang die längere Spanne zuerst. */
    const at = (n: number) => pageOrdinal(n, options) + 20000;
    const first = place.pages[0]!;
    return `p.${String(at(first.from)).padStart(12, '0')}.${String(999_999_999_999 - at(first.to)).padStart(12, '0')}`;
  }
  return placeSortKey(place, options);
}

/** Zwei Stellen im selben Werk vergleichen (nach seinem Układ). */
export function comparePlaces(a: string, b: string, scheme: SchemeId, options: ReturnType<typeof workOptions> = {}): number {
  const ka = placeKey(parsePlace(a, scheme, options), options);
  const kb = placeKey(parsePlace(b, scheme, options), options);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** Eine Stelle einheitlich geschrieben (im Układ ihres Werks). */
export const placeLabel = (locator: string, scheme: SchemeId, options: ReturnType<typeof workOptions> = {}): string =>
  locator.trim() === '' ? '' : formatPlace(parsePlace(locator, scheme, options), locator.trim());

/**
 * DIE STELLE RELATIV ZUR WURZEL — „I, q. 2, a. 3, arg. 1" unter „I, q. 2, a. 3" ist „arg. 1",
 * „J 1,14" unter „J 1" ist „14". Nur wenn die Stelle der Wurzel (eine Struktur) die des Schritts
 * als Anfang ihres Pfades enthält und danach ein Trenner folgt; Seiten bleiben ganz („s. 47").
 * 2026-10-25 — in der Gliederung ist ein Pfad immer sechs Ebenen lang (`null`: nicht genannt), der
 * Anfang also anders geprüft (`outlineUnder`): „rozdz. 3, § 4" unter „rozdz. 3" ist „§ 4".
 */
export function relativePlace(locator: string, root: string, scheme: SchemeId, options: ReturnType<typeof workOptions> = {}): string {
  const full = placeLabel(locator, scheme, options);
  if (scheme === 'pages' || root.trim() === '') return full;
  const r = parsePlace(root, scheme, options);
  const c = parsePlace(locator, scheme, options);
  const rp = r.spans.length === 1 ? r.spans[0]!.from : null;
  const cp = c.spans[0]?.from;
  const same = r.spans.length === 1 && r.spans[0]!.from.every((x, i) => x === r.spans[0]!.to[i]);
  if (rp === null || cp === undefined || !same) return full;
  const under = scheme === 'outline' ? outlineUnder(cp, rp) : cp.length > rp.length && rp.every((x, i) => x === cp[i]);
  if (!under) return full;
  const head = placeLabel(root, scheme, options);
  if (head === '' || !full.startsWith(head) || !/^[\s,;:]/.test(full.slice(head.length))) return full;
  return full.slice(head.length).replace(/^[\s,;:]+/, '');
}

/**
 * 2026-10-25 — LIEGT EINE STELLE DER GLIEDERUNG UNTER DER WURZEL? Jede Ebene, die die Wurzel nennt,
 * ist beim Schritt dieselbe, und der Schritt nennt noch eine tiefere als die tiefste der Wurzel
 * („t. 2, rozdz. 3" unter „t. 2" ja; „rozdz. 12" unter „rozdz. 1" nein, „rozdz. 3" unter „rozdz. 3" nein).
 */
function outlineUnder(step: Path, root: Path): boolean {
  const deepest = root.reduce<number>((at, x, i) => (x === null ? at : i), -1);
  return deepest >= 0 && root.every((x, i) => x === null || step[i] === x) && step.some((x, i) => i > deepest && x !== null);
}

/* -- Der Baum --------------------------------------------------------------------------------- */

export interface StructNode {
  readonly id: string;
  readonly children: readonly StructNode[];
  /** Schon weiter oben auf diesem Weg — nicht noch einmal aufgeklappt. */
  readonly again?: true;
  /** So viele lagen noch darunter, als eine Grenze erreicht war. */
  readonly cut?: number;
}

export interface TreeLimits {
  readonly depth?: number;
  readonly nodes?: number;
}

/** Wie Geschwister geordnet werden: nach der Stelle im Werk, dann (wer es so will) nach einem Feld, dann nach der Liste, dann nach dem Namen. */
export interface SiblingOrder {
  /**
   * 2026-10-25 — ZUERST NACH DIESEM FELD (statt nach der Stelle): etwa „czas", die Zeit der Erzählung —
   * eine Rückblende aus dem Ende des Buches steht dann vorn. Wer keinen Wert hat, steht dahinter, nach
   * der Stelle. Leer: nach der Stelle im Werk (wie bisher).
   */
  readonly by?: string;
  /** Der Schlüssel eines Zahlen- oder Textfeldes für Gleichstand an derselben Stelle. */
  readonly tie?: string;
  /** Wie ein Eintrag heisst (für den letzten Gleichstand). */
  readonly label: (entity: Entity) => string;
}

/**
 * 2026-10-25 — EIN Vergleicher für jeden Text beim Ordnen (Namen, Gleichstand nach einem Textfeld):
 * `localeCompare(…, 'pl', { numeric: true })` baut bei jedem Vergleich einen neuen — 10 000 Wurzeln
 * zu ordnen dauerte so über eine Sekunde (nach jedem Speichern), mit diesem einen rund 0,1 s.
 * Dieselbe Ordnung. Die Schlüssel der Stellen bleiben, wie sie sind (aufgefüllt, Zeichen für Zeichen).
 */
const PL = new Intl.Collator('pl', { numeric: true });

/**
 * Ordnet Einträge (Geschwister oder Wurzeln) nach der Stelle im Werk — jedes Werk nach seinem Układ.
 * Erst wird jede Zeile einmal ausgerechnet (eine Stelle wird einmal gelesen), dann nach festen
 * Schlüsseln sortiert: wer eine Stelle hat; das Werk (in der Reihenfolge, in der die Werke zuerst
 * auftauchen — so bleibt die Ordnung über mehrere Werke hinweg widerspruchsfrei); das ganze Werk vor
 * seinen Teilen; die Stelle; das Feld für Gleichstand; die Liste eines `down`-Feldes; der Name.
 */
export function orderByPlace(ids: readonly { id: string; listed?: number }[], src: Pick<StructureSource, 'entity' | 'look'>, order: SiblingOrder): string[] {
  const rows = ids.map(({ id, listed }) => {
    const entity = src.entity(id);
    const place = entity === undefined ? null : placeOf(entity, src);
    return { id, entity, place, listed: listed ?? Number.MAX_SAFE_INTEGER };
  });
  const byWork = new Map<string, string[]>();
  const rank = new Map<string, number>();
  for (const r of rows) {
    if (r.place === null) continue;
    if (!rank.has(r.place.work)) rank.set(r.place.work, rank.size);
    if (r.place.locator === '') continue;
    let list = byWork.get(r.place.work);
    if (list === undefined) { list = []; byWork.set(r.place.work, list); }
    list.push(r.place.locator);
  }
  const schemes = new Map([...byWork].map(([work, locators]) => [work, schemeFor(work, src, locators)]));
  const fieldValue = (e: Entity | undefined, key: string | undefined): string | number => {
    if (e === undefined || key === undefined || key === '') return '';
    const f = fieldsOf(e, src.look).find((x) => x.key === key);
    const v = f === undefined ? undefined : valuesOf(e, f)[0]?.value;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') { const n = readNumber(v); return n !== null && /^\s*-?\d/.test(v) ? n : v; }
    /* Eine Größe ({value, unit, si}) nach ihrem Wert in SI. */
    const si = typeof v === 'object' && v !== null ? (v as unknown as { si?: unknown }).si : undefined;
    if (typeof si === 'number') return si;
    return '';
  };
  const compareValues = (a: string | number, b: string | number): number => {
    if (a === b) return 0;
    if (a === '') return 1;
    if (b === '') return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'number') return -1;
    if (typeof b === 'number') return 1;
    return PL.compare(a, b);
  };
  const keyed = rows.map((r) => {
    const s = r.place === null ? undefined : schemes.get(r.place.work);
    return {
      id: r.id,
      by: fieldValue(r.entity, order.by),
      placed: r.place === null ? 1 : 0,
      work: r.place === null ? Number.MAX_SAFE_INTEGER : rank.get(r.place.work) ?? Number.MAX_SAFE_INTEGER,
      whole: r.place !== null && r.place.locator === '' ? 0 : 1,
      key: r.place === null || r.place.locator === '' || s === undefined ? '' : placeKey(parsePlace(r.place.locator, s.scheme, s.options), s.options),
      tie: fieldValue(r.entity, order.tie),
      listed: r.listed,
      label: r.entity === undefined ? r.id : order.label(r.entity)
    };
  });
  keyed.sort((a, b) => {
    const by = compareValues(a.by, b.by);
    if (by !== 0) return by;
    if (a.placed !== b.placed) return a.placed - b.placed;
    if (a.work !== b.work) return a.work - b.work;
    if (a.whole !== b.whole) return a.whole - b.whole;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    const tie = compareValues(a.tie, b.tie);
    if (tie !== 0) return tie;
    if (a.listed !== b.listed) return a.listed - b.listed;
    return PL.compare(a.label, b.label);
  });
  return keyed.map((r) => r.id);
}

/**
 * DER BAUM UNTER EINEM EINTRAG — rekursiv über die Strukturfelder, Geschwister nach der Stelle im
 * Werk; ein Weg, der zu sich zurückführt, endet mit „schon weiter oben"; Tiefe und Zahl begrenzt.
 */
export function structureTree(rootId: string, src: StructureSource, order: SiblingOrder, limits: TreeLimits = {}): { root: StructNode; count: number; capped: boolean } {
  const maxDepth = limits.depth ?? 24;
  const maxNodes = limits.nodes ?? 2000;
  let count = 1;
  let capped = false;
  const grow = (id: string, depth: number, path: ReadonlySet<string>): StructNode => {
    const kids = childrenOf(id, src);
    if (kids.length === 0) return { id, children: [] };
    if (depth >= maxDepth || count >= maxNodes) { capped = true; return { id, children: [], cut: kids.length }; }
    const children: StructNode[] = [];
    for (const child of orderByPlace(kids, src, order)) {
      if (count >= maxNodes) { capped = true; return { id, children, cut: kids.length - children.length }; }
      count += 1;
      children.push(path.has(child) ? { id: child, children: [], again: true } : grow(child, depth + 1, new Set([...path, child])));
    }
    return { id, children };
  };
  return { root: grow(rootId, 0, new Set([rootId])), count, capped };
}

/** Alle Einträge unter einem (ohne ihn), in der Reihenfolge des Baumes. */
export function descendantsOf(node: StructNode): StructNode[] {
  const out: StructNode[] = [];
  const walk = (n: StructNode) => { for (const c of n.children) { out.push(c); if (c.again !== true) walk(c); } };
  walk(node);
  return out;
}

/** Ein Eintrag in der Reihenfolge des Textes: wer über ihm liegt, wie tief. */
export interface TextRow {
  readonly node: StructNode;
  readonly parent: string;
  readonly depth: number;
}

/**
 * DIE REIHENFOLGE DES TEXTES — der Baum flach, nach der Stelle im Werk; gleiche Stellen in der
 * Reihenfolge des Baumes (die Antwort vor ihren fünf Wegen); ein Schritt ohne Stelle (eine
 * mitgedachte Prämisse) gleich nach dem, unter dem er liegt.
 */
export function textOrder(root: StructNode, src: Pick<StructureSource, 'entity' | 'look'>): TextRow[] {
  const rows: (TextRow & { index: number })[] = [];
  const walk = (n: StructNode, parent: string, depth: number) => {
    for (const c of n.children) {
      rows.push({ node: c, parent, depth, index: rows.length });
      if (c.again !== true) walk(c, c.id, depth + 1);
    }
  };
  walk(root, root.id, 1);
  const places = rows.map((r) => { const e = src.entity(r.node.id); return e === undefined ? null : placeOf(e, src); });
  const byWork = new Map<string, string[]>();
  const rank = new Map<string, number>();
  for (const p of places) {
    if (p === null || p.locator === '') continue;
    if (!rank.has(p.work)) rank.set(p.work, rank.size);
    let list = byWork.get(p.work);
    if (list === undefined) { list = []; byWork.set(p.work, list); }
    list.push(p.locator);
  }
  const schemes = new Map([...byWork].map(([work, locators]) => [work, schemeFor(work, src, locators)]));
  /* Jede Stelle einmal gelesen; dann: das Werk (wie es im Baum zuerst auftaucht), die Stelle, die Reihenfolge des Baumes. */
  const placed = rows.map((r, i) => ({ r, p: places[i] })).filter((x) => x.p !== null && x.p.locator !== '')
    .map(({ r, p }) => { const s = schemes.get(p!.work)!; return { r, work: rank.get(p!.work)!, key: placeKey(parsePlace(p!.locator, s.scheme, s.options), s.options) }; });
  const sortedPlaced = placed.sort((a, b) => (a.work !== b.work ? a.work - b.work : a.key !== b.key ? (a.key < b.key ? -1 : 1) : a.r.index - b.r.index)).map((x) => x.r);
  /* Was keine Stelle hat, folgt dem, unter dem es liegt (oder steht am Ende, wenn der auch keine hat). */
  const loose = rows.filter((_, i) => places[i] === null || places[i]!.locator === '');
  const looseUnder = new Map<string, typeof loose>();
  for (const l of loose) { const list = looseUnder.get(l.parent) ?? []; list.push(l); looseUnder.set(l.parent, list); }
  const out: TextRow[] = [];
  const done = new Set<TextRow>();
  const placeAfter = (id: string) => {
    for (const l of looseUnder.get(id) ?? []) { if (!done.has(l)) { done.add(l); out.push(l); placeAfter(l.node.id); } }
  };
  placeAfter(root.id);
  for (const r of sortedPlaced) { done.add(r); out.push(r); placeAfter(r.node.id); }
  for (const l of loose) if (!done.has(l)) { done.add(l); out.push(l); }
  return out.map(({ node, parent, depth }) => ({ node, parent, depth }));
}

/** Die Wurzel(n) über einem Eintrag — den Strukturfeldern nach oben folgend, ohne Kreis. */
export function rootsAbove(id: string, src: StructureSource, limit = 64): string[] {
  const roots = new Set<string>();
  const seen = new Set<string>([id]);
  let layer = [id];
  for (let step = 0; step < limit && layer.length > 0; step += 1) {
    const next: string[] = [];
    for (const x of layer) {
      const parents = parentsOf(x, src);
      if (parents.length === 0) roots.add(x);
      for (const p of parents) if (!seen.has(p)) { seen.add(p); next.push(p); }
    }
    layer = next;
  }
  return [...roots];
}

/** Der Weg von einer Wurzel bis zu diesem Eintrag (der erste, den es gibt) — für die Brotkrumen. */
export function pathFromRoot(id: string, src: StructureSource, limit = 64): string[] {
  const path = [id];
  const seen = new Set<string>([id]);
  let at = id;
  for (let step = 0; step < limit; step += 1) {
    const up = parentsOf(at, src).find((p) => !seen.has(p));
    if (up === undefined) break;
    path.unshift(up);
    seen.add(up);
    at = up;
  }
  return path;
}

/* -- Ein Artikel nach Tomasz (Układ „aquinas") ------------------------------------------------- */

/** Die Stücke eines Artikels in der Reihenfolge des Textes: Zarzuty (arg.), Sed contra, Odpowiedź (co.), Odpowiedzi na zarzuty (ad). */
export const PIECE_HEADING: Readonly<Record<1 | 2 | 3 | 4, string>> = {
  1: 'Zarzuty — Videtur quod',
  2: 'Sed contra',
  3: 'Odpowiedź — Respondeo',
  4: 'Odpowiedzi na zarzuty'
};

/** Welches Stück eines Artikels eine Stelle nennt (nur im Układ „Tomasz z Akwinu"; sonst `null`). */
export function pieceOf(locator: string, scheme: SchemeId): 1 | 2 | 3 | 4 | null {
  if (scheme !== 'aquinas' || locator.trim() === '') return null;
  const piece = parsePlace(locator, 'aquinas').spans[0]?.from[3];
  return piece === 1 || piece === 2 || piece === 3 || piece === 4 ? piece : null;
}

/** Die Nummer, die der Autor selbst gibt („arg. 3", „ad 3") — sonst `null`. */
export function authorNumber(locator: string, scheme: SchemeId): number | null {
  if (scheme !== 'aquinas' || locator.trim() === '') return null;
  const from = parsePlace(locator, 'aquinas').spans[0]?.from;
  const n = from?.[4];
  return (from?.[3] === 1 || from?.[3] === 4) && typeof n === 'number' ? n : null;
}
