/**
 * 2026-11-03 — EINE BAZA WIEDZY IM SPEICHER, aus einem Dokument im Format „knowledge-base" (`recreatio.cogita.course`,
 * auch `…schema`): für die Vorschau der Assistenten (`preview_knowledge`, `frontend/mcp/`, documentation/PREVIEW-MCP.md)
 * und für Prüfungen ohne Dienst.
 *
 * <b>Derselbe Weg wie der Import</b>: `planImport` und `applyImport` der App gehen in einen Speicher, der nichts
 * versiegelt und nichts sendet (`MemoryStore`). Was danach steht, rechnet die App wie in der Nauka: Karten, Ebenen,
 * Kenntnis, Widoki.
 *
 * <b>Ein Fortschritt zum Ansehen</b> (`previewLearner`): ein Lernender in diesem Browser ohne Speicher, mit erfundenen
 * Antworten — `none` (nichts), `partial` (die Grundlagen gewusst, einiges zu wiederholen, einiges vergessen oder
 * falsch, der Rest neu — nach der Ebene der Karte, also nach der Reihenfolge des Lernens) und `all` (alles gewusst).
 * Dieselbe Baza ergibt immer dasselbe Bild.
 *
 * <b>Proben der Generatoren</b> (`generatorReport`): je Pytanie mit `params` und je Szablon mit zufälligen Knoten ein
 * paar Fassungen, wie die Nauka sie zeigt (`lib.cards(seed)`), mit der erwarteten Antwort, den gezogenen Werten, wie
 * oft neu gezogen werden musste, und was gar nicht gelang.
 */

import type { AnswerSpec, Card } from './cardBasics';
import { rngOf } from './cardBasics';
import { applyImport, planImport } from './json';
import { Learner, type AnswerRecord } from './learn';
import { drawParams, PARAM_TRIES, readParamsSpec } from './generator';
import { cardLevel } from './prerequisites';
import type { MediaRef } from './schema';
import { CogitaLibrary } from './store';
import { newId } from '../core/ids';
import { cleanData, LibraryStore, type Entry, type SaveInput } from '../library/libraryStore';
import { WorkspaceError } from '../core/session';
import { t, texts } from '../core/i18n';

/* -- Der Speicher ------------------------------------------------------------------------------------------------- */

/** Was der Speicher der App intern tut — hier ohne Versiegeln und Senden aufgerufen. */
interface StoreInside {
  put(entry: Entry): void;
  drop(id: string): void;
  changed(): void;
}

/**
 * EIN SPEICHER OHNE DIENST: schreibt in den Speicher dieses Tabs, versiegelt nichts, sendet nichts. Alles Lesen
 * (Schlüssel, Suche, Rückverweise) ist das der App.
 */
export class MemoryStore extends LibraryStore {
  private tick = 0;

  constructor(libraryId: string, areaId: string) {
    super(null, { libraryId, areaId });
    this.loaded = true;
  }

  private get inside(): StoreInside { return this as unknown as StoreInside; }

  /** Eine feste Zeit je Speichern — dieselbe Baza ergibt dieselben Einträge. */
  private make(input: SaveInput): Entry {
    const id = input.id ?? newId();
    const before = this.own(id);
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, this.tick++)).toISOString();
    return {
      libraryId: this.libraryId, id, kind: input.kind, ...(input.key === undefined ? {} : { key: input.key }), data: cleanData(input.data),
      version: (before?.version ?? 0) + 1, epoch: 1, createdAt: before?.createdAt ?? at, updatedAt: at, publishedAt: null, publishedAs: null
    };
  }

  override sync(): Promise<void> { return Promise.resolve(); }

  override async save(input: SaveInput): Promise<Entry> {
    const entry = this.make(input);
    this.inside.put(entry);
    this.inside.changed();
    return entry;
  }

  override async saveMany(inputs: readonly SaveInput[], progress?: (done: number, total: number) => void): Promise<{ saved: Entry[]; failed: { id: string; error: string }[] }> {
    const saved: Entry[] = [];
    for (const input of inputs) {
      const entry = this.make(input);
      this.inside.put(entry);
      saved.push(entry);
      progress?.(saved.length, inputs.length);
    }
    if (saved.length > 0) this.inside.changed();
    return { saved, failed: [] };
  }

  /**
   * 2026-11-03 — ALLE ODER KEINER, wie der Dienst (`/entries/save`): steht `failWith`, scheitert der ganze Zapis und hier
   * ändert sich nichts (für Prüfungen: ein Zapis, den der Dienst ablehnt).
   */
  failWith: string | null = null;

  /** Zuletzt gelöscht (für Prüfungen: was ein Zapis löschte). */
  lastRemoved: readonly string[] = [];

  override async saveAll(inputs: readonly SaveInput[], _progress?: (done: number, total: number) => void, remove: readonly string[] = []): Promise<Entry[]> {
    if (this.failWith !== null) throw new WorkspaceError(this.failWith, 'conflict');
    /* 2026-11-03 — wie der Dienst: nur eigene, nie zugleich gespeichert und gelöscht — sonst nichts. */
    for (const id of remove) {
      if (this.own(id) === undefined) throw new WorkspaceError(t('cogitaData.memory.notOwn', { id }), 'conflict');
      if (inputs.some((x) => x.id === id)) throw new WorkspaceError(t('cogitaData.memory.saveAndRemove', { id }), 'conflict');
    }
    const made = inputs.map((input) => this.make(input));
    for (const entry of made) this.inside.put(entry);
    for (const id of remove) this.inside.drop(id);
    this.lastRemoved = [...remove];
    if (made.length > 0 || remove.length > 0) this.inside.changed();
    return made;
  }

  override async remove(id: string): Promise<void> {
    this.inside.drop(id);
    this.inside.changed();
  }

  override async removeMany(ids: readonly string[]): Promise<number> {
    const own = ids.filter((id) => this.own(id) !== undefined);
    for (const id of own) this.inside.drop(id);
    if (own.length > 0) this.inside.changed();
    return own.length;
  }

  override upload(): Promise<MediaRef> { return Promise.reject(new Error(t('cogitaData.memory.noFiles'))); }

  override openFile(): Promise<string | null> { return Promise.resolve(null); }
}

/* -- Die Baza ----------------------------------------------------------------------------------------------------- */

export interface MemoryBase {
  /** Zum Lesen (wie ein Lernender: ohne Werkzeuge der Autoren). */
  readonly lib: CogitaLibrary;
  /** Dieselbe Baza zum Schreiben (die Vorschau legt dort einen Widok in einer anderen Gestalt ab). */
  readonly writer: CogitaLibrary;
  readonly name: string;
  /** Was der Import sagt: was er anlegt, ändert — und seine Warnungen. */
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Ein Dokument als Wert — auch als Text gekommen (mit BOM). */
export function readKnowledgeDoc(doc: unknown): { value: Record<string, unknown> } | { error: string } {
  let value = doc;
  if (typeof doc === 'string') {
    try { value = JSON.parse(doc.replace(/^﻿/, '')) as unknown; } catch (e) { return { error: `To nie jest poprawny JSON: ${e instanceof Error ? e.message : String(e)}` }; }
  }
  return isObject(value) ? { value } : { error: 'Oczekiwany jest dokument bazy wiedzy — obiekt {"format": "recreatio.cogita.course", …}.' };
}

/**
 * DIE BAZA AUS DEM DOKUMENT — über den Import der App in einen Speicher ohne Dienst. Ein Fehler des Plans (falsches
 * Format) ist ein Fehler in Worten, alles andere steht in `warnings`.
 */
export async function memoryBase(doc: unknown, { libraryId = 'podglad-bazy-wiedzy', areaId = 'podglad-obszaru' }: { libraryId?: string; areaId?: string } = {}): Promise<MemoryBase | { error: string }> {
  const read = readKnowledgeDoc(doc);
  if ('error' in read) return read;
  const store = new MemoryStore(libraryId, areaId);
  const writer = new CogitaLibrary(store, true);
  const plan = planImport(writer, read.value);
  if ('error' in plan) return plan;
  /* 2026-11-03 — was der Import der App ablehnen würde (ein Verweis ins Leere), lehnt auch die Vorschau ab — mit demselben Grund. */
  let applied: Awaited<ReturnType<typeof applyImport>>;
  try {
    applied = await applyImport(writer, plan, () => undefined);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  const name = typeof read.value.name === 'string' && read.value.name.trim() !== '' ? read.value.name.trim() : 'Baza wiedzy';
  return { lib: new CogitaLibrary(store, false), writer, name, lines: applied.lines, warnings: applied.warnings };
}

/* -- Ein Fortschritt zum Ansehen ---------------------------------------------------------------------------------- */

export const PREVIEW_PROGRESS = ['none', 'partial', 'all'] as const;
export type PreviewProgress = (typeof PREVIEW_PROGRESS)[number];

export const PREVIEW_PROGRESS_LABEL: Readonly<Record<PreviewProgress, string>> = texts({
  none: 'cogitaData.memory.previewNone',
  partial: 'cogitaData.memory.previewPartial',
  all: 'cogitaData.memory.previewAll'
});

/** Wie es einer Karte geht: gewusst, zu wiederholen, vergessen, zuletzt falsch, nie gefragt. */
export type CardMood = 'known' | 'due' | 'forgotten' | 'wrong' | 'new';
export const CARD_MOODS: readonly CardMood[] = ['known', 'due', 'forgotten', 'wrong', 'new'];

const HOUR = 3_600_000;

/**
 * DIE ANTWORTEN, die eine Karte in diesen Zustand bringen (Gedächtnis aus `knowness.ts`): gewusst — zweimal richtig, das
 * zweite Mal nach einem Tag (nächste Wiederholung in drei Tagen); zu wiederholen — einmal richtig vor einer Stunde
 * (fällig nach 15 Minuten, Kenntnis um 0,5); vergessen — einmal richtig vor drei Tagen (unter 10 %); falsch — richtig,
 * dann falsch.
 */
function answersFor(card: Card, mood: CardMood, now: number): AnswerRecord[] {
  const one = (n: number, at: number, correctness: number): AnswerRecord => ({
    id: `podglad-${card.key}-${n}`, key: card.key, question: card.question, direction: card.direction, fingerprint: card.fingerprint,
    at, correctness, via: 'podglad'
  });
  switch (mood) {
    case 'known': return [one(1, now - 26 * HOUR, 1), one(2, now - HOUR, 1)];
    case 'due': return [one(1, now - HOUR, 1)];
    case 'forgotten': return [one(1, now - 72 * HOUR, 1)];
    case 'wrong': return [one(1, now - 2 * HOUR, 1), one(2, now - HOUR, 0)];
    case 'new': return [];
  }
}

/**
 * Welcher Zustand einer Karte — nach ihrer Ebene in der Reihenfolge des Lernens (`cardLevel`) und ihrem Platz unter den
 * Karten dieser Ebene (nach dem Schlüssel): fest, für dieselbe Baza dasselbe. `partial` ist jemand auf halbem Weg: das
 * untere knappe Drittel der Ebenen gewusst (jede fünfte Karte zu wiederholen), die nächsten Ebenen gemischt (gewusst, zu
 * wiederholen, zuletzt falsch, neu), auf der Ebene danach einiges vergessen, darüber alles neu.
 */
function moodOf(progress: PreviewProgress, level: number, rank: number, levels: number, size: number): CardMood {
  if (progress === 'none') return 'new';
  if (progress === 'all') return 'known';
  /* Ohne Reihenfolge des Lernens (eine Ebene): dieselben Anteile über die Karten statt über die Ebenen. */
  if (levels <= 1) {
    const at = rank / Math.max(1, size);
    if (at < 0.3) return rank % 5 === 4 ? 'due' : 'known';
    if (at < 0.5) return (['known', 'due', 'wrong', 'new'] as const)[rank % 4]!;
    if (at < 0.55) return 'forgotten';
    return 'new';
  }
  const known = Math.max(1, Math.round(levels * 0.3));
  const mixed = known + Math.max(1, Math.round(levels * 0.15));
  if (level < known) return rank % 5 === 4 ? 'due' : 'known';
  if (level < mixed) return (['known', 'due', 'wrong', 'new'] as const)[rank % 4]!;
  if (level === mixed) return rank % 6 === 0 ? 'forgotten' : 'new';
  return 'new';
}

export interface PreviewLearner {
  readonly learner: Learner;
  /** Wie viele Karten in welchem Zustand. */
  readonly counts: Readonly<Record<CardMood, number>>;
  /** Je Karte (Schlüssel) ihr Zustand. */
  readonly moods: ReadonlyMap<string, CardMood>;
  /** Wie viele Ebenen die Reihenfolge des Lernens hat (0: keine Voraussetzungen erklärt). */
  readonly levels: number;
}

/** Eine Kennung (UUID) — im Speicher bei jedem Import neu gezogen, in jedem Tab eine andere. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * DER SCHLÜSSEL EINER KARTE OHNE DEN ZUFALL DES IMPORTS: jede Kennung darin durch den bleibenden Namen aus dem Dokument
 * (`ref`), sonst durch den Namen des Eintrags ersetzt — dieselbe Baza bekommt so in jedem Tab (Desktop, Telefon) und in
 * jedem Lauf dieselben Zustände.
 */
export function stableKeyOf(lib: CogitaLibrary): (key: string) => string {
  const names = new Map<string, string>();
  const nameOf = (id: string): string => {
    const known = names.get(id);
    if (known !== undefined) return known;
    const entry = lib.entry(id);
    const entity = lib.entity(id);
    const ref = entry?.data._ref;
    const name = typeof ref === 'string' && ref !== '' ? `@${ref}` : entity !== undefined ? lib.label(entity) : typeof entry?.data.name === 'string' ? entry.data.name : id;
    names.set(id, name);
    return name;
  };
  return (key) => key.replace(UUID, nameOf);
}

/**
 * EIN LERNENDER MIT ERFUNDENEM FORTSCHRITT — nichts wird gespeichert (ein Halter dieses Browsers, nie geladen, nie
 * gesendet). Welche Karte welchen Zustand bekommt, hängt nur am Dokument (`stableKeyOf`), die Zeiten an `now`.
 */
export async function previewLearner(lib: CogitaLibrary, progress: PreviewProgress, now = Date.now()): Promise<PreviewLearner> {
  const learner = new Learner(lib.libraryId, { kind: 'local', id: `podglad-${progress}` }, null);
  const counts: Record<CardMood, number> = { known: 0, due: 0, forgotten: 0, wrong: 0, new: 0 };
  const moods = new Map<string, CardMood>();
  const graph = lib.prerequisites();
  const levels = graph.level.size === 0 ? 0 : Math.max(...graph.level.values()) + 1;
  const { cards } = await lib.cards('podglad');
  const seen = new Set<string>();
  const unique = cards.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
  const byLevel = new Map<number, Card[]>();
  for (const card of unique) {
    const level = cardLevel(card, graph);
    const list = byLevel.get(level);
    if (list === undefined) byLevel.set(level, [card]); else list.push(card);
  }
  const answers: AnswerRecord[] = [];
  const stable = stableKeyOf(lib);
  const order = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
  for (const [level, list] of byLevel) {
    list.sort((a, b) => order(stable(a.key), stable(b.key)) || order(a.key, b.key));
    list.forEach((card, rank) => {
      const mood = moodOf(progress, level, rank, levels, list.length);
      counts[mood] += 1;
      moods.set(card.key, mood);
      answers.push(...answersFor(card, mood, now));
    });
  }
  learner.remember(answers);
  return { learner, counts, moods, levels };
}

/* -- Proben der Generatoren --------------------------------------------------------------------------------------- */

export interface GeneratorSample {
  /** Was die Karte fragt (eine Zeile). */
  readonly prompt: string;
  /** Was als richtig gilt (eine Zeile). */
  readonly answer: string;
  /** Bei einer Wahl: alle Möglichkeiten (die Dystraktoren eingeschlossen). */
  readonly options?: readonly string[];
  /** Die gezogenen Werte, wie die Antwort sie mitnimmt (`params`) — Einträge mit ihrem bleibenden Namen statt der Kennung. */
  readonly values?: Readonly<Record<string, unknown>>;
  /** Podpowiedzi und Wyjaśnienie dieser Fassung (je eine Zeile) — sieht man, ob die Werte darin stehen. */
  readonly hints?: readonly string[];
  readonly explanation?: string;
  /** Bei einer Vorlage: für welchen Eintrag. */
  readonly entry?: string;
}

export interface GeneratorReport {
  readonly kind: 'question' | 'template';
  /** Die Kennung (Pytanie oder Szablon) und, wenn aus einem Import, der bleibende Name. */
  readonly id: string;
  readonly ref: string | null;
  readonly name: string;
  readonly samples: readonly GeneratorSample[];
  /** Von wie vielen Versuchen wie viele eine Fassung gaben. */
  readonly made: number;
  readonly tried: number;
  /** Wie oft im Mittel gezogen wurde, bis die Bedingungen galten (1: nie neu) — `null`: unbekannt. */
  readonly draws: number | null;
  readonly problems: readonly string[];
}

/** Die Kennung einer Vorlage, deren Graph zufällige Knoten hat (dieselbe Liste wie `CHANCE` in cards.ts, dazu die Generatoren). */
const CHANCE_NODES: ReadonlySet<string> = new Set(['random', 'generate']);

const oneLine = (text: string, n = 220): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

/** Was als richtig gilt — eine Zeile (wie `answerText` der Karte, ohne die Oberfläche). */
export function expectedText(a: AnswerSpec): string {
  switch (a.form) {
    case 'text': return a.accepted.join(' | ');
    case 'gap': return a.gaps !== undefined ? a.gaps.map((g) => g.accepted[0] ?? '').join(' · ') : a.accepted[0] ?? '';
    case 'number': return `${a.values.map((v) => String(Number(v.toPrecision(6))).replace('.', ',')).join(' | ')}${a.unit === '' ? '' : ` ${a.unit}`}${a.tolerance > 0 ? ` (±${a.relative ? `${Math.round(a.tolerance * 1000) / 10} %` : String(a.tolerance).replace('.', ',')})` : ''}`;
    case 'date': return a.values.join(' | ');
    case 'one': return a.options[a.correct] ?? '';
    case 'many': return a.correct.map((i) => a.options[i]).join(', ');
    case 'truefalse': return a.value ? t('cogitaData.memory.true') : t('cogitaData.memory.false');
    case 'order': return a.items.join(' → ');
    case 'match': return a.pairs.map(([l, r]) => `${a.left[l]} — ${a.right[r]}`).join('; ');
    case 'flash': return a.back.join(' · ');
    case 'build': return a.items.join(a.join);
    case 'code': return t('cogitaData.memory.codePasses');
    case 'point': return t('cogitaData.memory.point');
    default: return t('cogitaData.memory.drawingGoal');
  }
}

const promptText = (card: Card): string =>
  oneLine(card.answer.form === 'gap' ? card.answer.shown : card.prompt.map((p) => p.text).join(' '));

/** Ein gezogener Wert zum Lesen: ein Eintrag (`@kennung` des Speichers) mit seinem bleibenden Namen aus dem Dokument. */
const readableValue = (stable: (key: string) => string) => (v: unknown): unknown =>
  typeof v === 'string' && /^@[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) ? stable(v.slice(1)) : Array.isArray(v) ? v.map(readableValue(stable)) : v;

const sampleOf = (card: Card, stable: (key: string) => string, entry?: string): GeneratorSample => ({
  prompt: promptText(card),
  answer: oneLine(expectedText(card.answer), 160),
  ...(card.answer.form === 'one' || card.answer.form === 'many' ? { options: card.answer.options.map((o) => oneLine(o, 80)) } : {}),
  ...(card.params === undefined ? {} : { values: Object.fromEntries(Object.entries(card.params).map(([k, v]) => [k, readableValue(stable)(v)])) }),
  ...(card.hints === undefined || card.hints.length === 0 ? {} : { hints: card.hints.map((h) => oneLine(h, 160)) }),
  ...(card.explanation === undefined || card.explanation.trim() === '' ? {} : { explanation: oneLine(card.explanation, 220) }),
  ...(entry === undefined ? {} : { entry })
});

/**
 * WIE OFT NEU GEZOGEN WIRD: die Züge eines Pytanie mit `params`, bis `require` galt — so, wie der Generator zählt
 * (`drawParams(...).tries`), aus der Welt dieser Baza (gezogene Einträge).
 */
function drawsOf(lib: CogitaLibrary, data: Readonly<Record<string, unknown>>, seeds: readonly string[]): number | null {
  try {
    const spec = readParamsSpec(data);
    if (spec === null || (spec.params.length === 0 && spec.require.length === 0)) return null;
    const world = lib.genWorld();
    let sum = 0;
    for (const seed of seeds) sum += Math.max(1, drawParams(spec, rngOf(`${seed}:losowania`), PARAM_TRIES, world).tries);
    return Math.round((sum / Math.max(1, seeds.length)) * 10) / 10;
  } catch {
    return null;
  }
}

/** Der Name einer Pytanie für Listen: ihr Anfang. */
const questionName = (data: Readonly<Record<string, unknown>>): string =>
  oneLine(typeof data.prompt === 'string' ? data.prompt : typeof data.task === 'string' ? data.task : 'Pytanie', 90);

/**
 * PROBEN ALLER GENERATOREN dieser Baza: je Versuch eine Runde Karten, wie die Nauka sie rechnet (`lib.cards`), daraus
 * die Fassungen jedes Pytanie mit `params`/`let` und jedes Szablon mit zufälligen Knoten.
 */
export async function generatorReport(lib: CogitaLibrary, count = 10): Promise<GeneratorReport[]> {
  const tries = Math.max(1, Math.min(30, Math.round(count)));
  const seeds = Array.from({ length: tries }, (_, i) => `podglad-${i + 1}`);
  const questions = lib.entities().filter((e) => e.kinds.includes('question') && (e.data.params !== undefined || e.data.let !== undefined));
  const templates = lib.templates().filter((t) => t.graph.nodes.some((n) => CHANCE_NODES.has(n.type)));
  if (questions.length === 0 && templates.length === 0) return [];
  const runs: { cards: Card[]; problems: Map<string, string[]> }[] = [];
  for (const seed of seeds) runs.push(await lib.cards(seed));
  const stable = stableKeyOf(lib);
  const refOf = (id: string): string | null => {
    const r = lib.entry(id)?.data._ref;
    return typeof r === 'string' && r !== '' ? `@${r}` : null;
  };
  const out: GeneratorReport[] = [];
  for (const q of questions) {
    const samples: GeneratorSample[] = [];
    let made = 0;
    for (const run of runs) {
      const card = run.cards.find((c) => c.question === q.id && c.direction === '' && c.key === q.id) ?? run.cards.find((c) => c.entity === q.id);
      if (card === undefined) continue;
      made += 1;
      samples.push(sampleOf(card, stable));
    }
    const problems = [...new Set(runs.flatMap((r) => r.problems.get(q.id) ?? []))];
    if (made < tries && problems.length === 0) problems.push(t('cogitaData.memory.noCardIn', { failed: tries - made, tries }));
    out.push({ kind: 'question', id: q.id, ref: refOf(q.id), name: questionName(q.data), samples, made, tried: tries, draws: drawsOf(lib, q.data, seeds), problems });
  }
  for (const tpl of templates) {
    const samples: GeneratorSample[] = [];
    let made = 0;
    runs.forEach((run, i) => {
      const of = run.cards.filter((c) => c.template === tpl.id);
      if (of.length === 0) return;
      made += 1;
      const card = of[i % of.length]!;
      const entity = card.entity === undefined ? undefined : lib.entity(card.entity);
      samples.push(sampleOf(card, stable, entity === undefined ? undefined : oneLine(lib.label(entity), 80)));
    });
    const problems = [...new Set(runs.flatMap((r) => r.problems.get(tpl.id) ?? []))];
    if (made === 0 && problems.length === 0) problems.push(t('cogitaData.memory.templateNoCard'));
    out.push({ kind: 'template', id: tpl.id, ref: refOf(tpl.id), name: oneLine(tpl.name, 90), samples, made, tried: tries, draws: null, problems });
  }
  return out;
}
