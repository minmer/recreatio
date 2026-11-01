/**
 * COGITA — KARTEN AUS VORLAGEN (COGITA.md §5).
 *
 * <b>Wie eine Frage entsteht, sagt der Mensch</b> [D1]. Eine Vorlage gehört zu
 * einer Art (oder mehreren) und ist ein Graph aus kleinen Bausteinen — das
 * Vorbild ist der Vorlageneditor von Cogita Graph (`legacy/pages/cg`):
 *
 * <code>
 *   Daten      pole · odwołanie (kilka kroków) · lista · ten wpis
 *   Tekst      wzór „Kto napisał {0}?" · maska (początek, koniec, losowo) · fragmenty cytatu
 *   Wybór      wybierz jeden (wybrany i reszta) · dystraktory · dla każdej wartości
 *   Liczby     losowa wartość · działanie · porównanie (prawda/fałsz) · warunek · Python
 *   Karta      pytanie (tekst, obraz, dźwięk) · odpowiedź w jednej z dwunastu form · wyjaśnienie · karta
 * </code>
 *
 * Für jeden Eintrag der Art läuft der Graph einmal — oder, mit „dla każdej
 * wartości", einmal je Wert (jede Übersetzung, jedes Isotop, jeder Teil eines
 * Zitats) [D11] — und gibt je Lauf eine Karte. Was auf den Leitungen fliesst,
 * sind immer Listen von Stücken (`Item`): ein Text, wofür er steht (ein
 * Eintrag, eine Zahl, ein Datum, eine Datei) und wie sicher er ist.
 *
 * <b>Die Kennung einer Karte ist die Frage UND die Richtung</b> (COGITA.md §7):
 * `vorlage:eintrag[:wert]` und die Richtung der Vorlage (`a→b`, `b→a`). Unter
 * ihr liegen Antworten und Kenntnis. Ändert sich, was als richtig gilt, beginnt
 * die Geschichte der Karte neu [D7] — dafür trägt sie einen Fingerabdruck der
 * erwarteten Antwort. Eine Vorlage mit Zufall (berechnete Fragen, ein zufällig
 * gewählter Wert) fragt jedes Mal anderes: ihr Fingerabdruck ist der der
 * Vorlage selbst, damit die Geschichte nicht bei jedem Würfeln endet.
 *
 * <b>Daneben gibt es von Hand geschriebene Fragen</b> (Systemart `question`)
 * und das Thema als Frage, dessen Wissen sich aufdecken lässt [C4].
 */

import { checkBuild, checkCode, checkDate, checkFlash, checkGaps, checkMany, checkMatch, checkNumber, checkOne, checkOrder, checkPoint, checkText, checkTrueFalse, GAP_RULE, readDateAnswer, readRule, TEXT_RULE, type AnswerForm, type FlashGrade, type Outcome, type PointGiven, type TextRule } from './check';
import { ancestors, evaluate, readGraph, type Graph, type RunOutput } from './graph';
import { dateKey, fieldsOf, plainOf, readNumber, valuesOf, type DatePrecision, type Entity, type Lookup } from './schema';
import { type AnswerSpec, type Card, type CardTest, type CodeTest, type Fragment, type GapSlot, type Item, type PromptPart, type TemplateContext, cardKey, hashOf, isObject, lines, num, readParams, rngOf, shuffle, shuffleAway, shuffledPairs, stable, str } from './cardBasics';
import { type Draft, TEMPLATE_PALETTE } from './cardPalette';
import { checkInteractive, interactiveExpected, interactiveSpec } from './interactive';
import { convert, findUnit, guessKind, kindById, measures, parseQuantity } from '../core/quantities';
import { hasTex, plainWithTex } from '../core/tex';
import { choicesOf, GAP, pairsOf, rawList, showOf } from './questionTypes';
import { drawParams, readParamsSpec, withParams } from './questionParams';

/** Was als richtig gilt, ohne die Reihenfolge, in der es gezeigt wird — gemischte Wahlmöglichkeiten ändern nichts. */
function expectedOf(answer: AnswerSpec): unknown {
  switch (answer.form) {
    case 'text': return { f: 'text', a: answer.accepted.map((a) => a.toLowerCase()).sort() };
    case 'gap': return { f: 'gap', a: answer.accepted.map((a) => a.toLowerCase()).sort(), s: answer.shown };
    case 'number': return { f: 'number', v: answer.values.slice().sort((a, b) => a - b), t: answer.tolerance, r: answer.relative };
    case 'date': return { f: 'date', v: answer.values.slice().sort(), p: answer.precision, t: answer.tolerance };
    case 'one': return { f: 'one', c: answer.options[answer.correct] };
    case 'many': return { f: 'many', c: answer.correct.map((i) => answer.options[i]).sort() };
    case 'truefalse': return { f: 'tf', v: answer.value };
    case 'order': return { f: 'order', i: answer.items };
    case 'match': return { f: 'match', p: answer.pairs.map(([l, r]) => `${answer.left[l]}→${answer.right[r]}`).sort() };
    case 'flash': return { f: 'flash', b: answer.back };
    case 'code': return { f: 'code', r: answer.reference, c: answer.createInput, n: answer.cases, ...(answer.tests === undefined ? {} : { t: answer.tests }) };
    case 'point': return { f: 'point', t: answer.target };
    case 'interactive': return interactiveExpected(answer);
    case 'build': return { f: 'build', i: answer.items, a: answer.alternatives, x: answer.extra.slice().sort() };
  }
}

/**
 * 2026-11-01 — EINE GETIPPTE ANTWORT BRAUCHT NIE LaTeX: steht in einer richtigen Antwort ein Wzór, gilt auch seine
 * Zeile ohne LaTeX (`$x^2$` → „x²") und das LaTeX ohne Dollar („x^2").
 */
export function typedVariants(accepted: readonly string[]): { readonly text: string; readonly original: string }[] {
  const out: { text: string; original: string }[] = [];
  const put = (text: string, original: string) => { if (text.trim() !== '' && !out.some((x) => x.text === text)) out.push({ text, original }); };
  for (const a of accepted) {
    put(a, a);
    if (!hasTex(a)) continue;
    put(plainWithTex(a), a);
    put(a.replace(/(?<!\\)\$+/g, '').replace(/\s+/g, ' ').trim(), a);
  }
  return out;
}

export const typedAccepted = (accepted: readonly string[]): string[] => typedVariants(accepted).map((v) => v.text);

/** Verglichen wurde mit einer Zeile ohne LaTeX: gezeigt wird die Antwort, wie sie geschrieben steht (`Outcome.shown`). */
function asWritten(outcome: Outcome, accepted: readonly string[]): Outcome {
  if (outcome.expected === undefined || accepted.includes(outcome.expected)) return outcome;
  const original = typedVariants(accepted).find((v) => v.text === outcome.expected)?.original;
  return original === undefined ? outcome : { ...outcome, shown: original };
}

/**
 * DIE PRÜFUNG EINER KARTE — die gegebene Antwort in der Form ihrer Karte:
 *
 * <code>
 *   text, gap, number, date   der eingegebene Text
 *   one / many                die Stelle / die Stellen in `options`
 *   truefalse                 true oder false
 *   order                     die Stücke in der gewählten Reihenfolge
 *   match                     Paare [links, rechts] als Stellen in `left` und `right`
 *   flash                     'knew' · 'partly' · 'not'
 *   code                      { passed, total } aus Pyodide
 *   point                     { x, y } auf dem Bild oder { lat, lon }
 * </code>
 *
 * `rule` ist, was eine Wiederholung an der Strenge der Vorlage ändert [D5].
 */
export function checkCard(card: Card, given: unknown, rule?: Partial<TextRule>): Outcome {
  const a = card.answer;
  switch (a.form) {
    case 'text': return asWritten(checkText(typedAccepted(a.accepted), typeof given === 'string' ? given : '', { ...a.rule, ...rule }), a.accepted);
    /* 2026-11-01 — mehrere Lücken: eine Antwort je Lücke, jede für sich. */
    case 'gap': return a.gaps !== undefined
      ? checkGaps(a.gaps.map((g) => (g.choices !== undefined ? g : { accepted: typedAccepted(g.accepted) })), Array.isArray(given) ? given.map((x) => (typeof x === 'string' ? x : '')) : [], { ...a.rule, ...rule })
      : asWritten(checkText(typedAccepted(a.accepted), typeof given === 'string' ? given : '', { ...a.rule, ...rule }), a.accepted);
    case 'number': return checkNumber(a, given);
    case 'date': return checkDate(a, typeof given === 'string' ? given : '');
    case 'one': return checkOne(a.correct, typeof given === 'number' ? given : null);
    case 'many': return checkMany(a.correct, Array.isArray(given) ? given.filter((g): g is number => typeof g === 'number') : [], a.options.length);
    case 'truefalse': return checkTrueFalse(a.value, typeof given === 'boolean' ? given : null);
    case 'order': return checkOrder(a.items, Array.isArray(given) ? given.map(String) : []);
    case 'match': return checkMatch(a.pairs, Array.isArray(given) ? given.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number')) : []);
    case 'flash': return checkFlash(given === 'knew' || given === 'partly' || given === 'not' ? (given as FlashGrade) : null);
    case 'code': return checkCode(isObject(given) && typeof given.passed === 'number' && typeof given.total === 'number' ? { passed: given.passed, total: given.total } : null);
    case 'point': return checkPoint(a.target, isObject(given) ? (given as unknown as PointGiven) : null);
    case 'interactive': return checkInteractive(a, given);
    case 'build': return checkBuild([a.items, ...a.alternatives], Array.isArray(given) ? given.map(String) : []);
  }
}

/** Bausteine, deren Ergebnis bei jedem Lauf anders ausfallen darf. */
const CHANCE = new Set(['random']);

/** Was eine Vorlage TUT — ohne die Plätze im Bild: wer einen Knoten verschiebt, ändert keine Frage. */
const definitionOf = (graph: Graph) => ({
  nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })),
  edges: graph.edges
});

/* -- Die Vorlage ------------------------------------------------------------------- */

export interface Template {
  readonly id: string;
  readonly name: string;
  /** Für welche Arten sie Karten macht [D8]. */
  readonly kinds: readonly string[];
  /** Die Richtung ihrer Karten, etwa „a→b" — Teil der Kennung (COGITA.md §7). */
  readonly direction: string;
  readonly graph: Graph;
  /**
   * 2026-10-30 — CO SPRAWDZA TA KARTA, und wie stark: `of` ist `this` (der Eintrag der Karte) oder der Schlüssel eines
   * Verweisfeldes (die Einträge, auf die es zeigt — der Okres eines Fakts, sein Ort); `weight` 0–10, eine genaue Frage
   * zählt mehr als eine allgemeine. Leer: der Eintrag der Karte mit 1.
   */
  readonly tests: readonly TemplateTest[];
  /**
   * 2026-11-01 — WELCHEN FAKT IHRE KARTEN FRAGEN (`asks`): `of` wie bei `tests` (`this` oder ein Verweisfeld), `facet` ein
   * Name für das, was gefragt wird („data", „tłumaczenie"). Zwei Vorlagen mit demselben Fakt über denselben Eintrag
   * (zwei Richtungen, eine Frage und ihre Umkehrung) teilen jede Antwort. Leer: die Karte fragt nur sich selbst.
   */
  readonly asks: readonly TemplateAsk[];
}

export interface TemplateTest {
  readonly of: string;
  readonly weight: number;
}

export interface TemplateAsk {
  readonly of: string;
  readonly facet: string;
}

/** `asks`: [{"of": "this", "facet": "data"}] — oder kurz ["data"] (über den Eintrag der Karte). */
export function readAsks(raw: unknown): TemplateAsk[] {
  const out: TemplateAsk[] = [];
  for (const one of Array.isArray(raw) ? raw : []) {
    const of = isObject(one) ? str(one.of).trim() || 'this' : 'this';
    const facet = (isObject(one) ? str(one.facet) : str(one)).trim().slice(0, 80);
    if (facet === '' || out.some((a) => a.of === of && a.facet === facet)) continue;
    out.push({ of, facet });
    if (out.length >= 12) break;
  }
  return out;
}

/** Die Fakten einer Karte dieser Vorlage für diesen Eintrag (`<eintrag>#<facette>`; in einer Schleife je Wert eigen). */
export function factsOf(asks: readonly TemplateAsk[], entity: Entity, look: Lookup, variant?: string): string[] {
  const out = new Set<string>();
  const tail = variant === undefined ? '' : `:${variant}`;
  for (const a of asks) {
    if (a.of === 'this') { out.add(`${entity.id}#${a.facet}${tail}`); continue; }
    const field = fieldsOf(entity, look).find((f) => f.key === a.of && f.type === 'ref');
    if (field === undefined) continue;
    for (const v of valuesOf(entity, field)) if (typeof v.value === 'string' && v.value !== '') out.add(`${v.value}#${a.facet}${tail}`);
  }
  return [...out];
}

/** Das Gewicht einer Prüfung: 0–10, ohne Angabe 1. */
const weightOf = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 1;
};

export function readTests(raw: unknown): TemplateTest[] {
  const out: TemplateTest[] = [];
  for (const one of Array.isArray(raw) ? raw : []) {
    if (!isObject(one)) continue;
    const of = str(one.of).trim() || 'this';
    if (out.some((t) => t.of === of)) continue;
    out.push({ of, weight: weightOf(one.weight) });
    if (out.length >= 12) break;
  }
  return out;
}

export function readTemplate(id: string, raw: unknown): Template {
  const doc = isObject(raw) ? raw : {};
  return {
    id,
    name: str(doc.name).trim().slice(0, 120) || 'Szablon',
    kinds: lines(doc.kinds),
    direction: str(doc.direction).trim().slice(0, 40),
    graph: readGraph(doc.graph),
    tests: readTests(doc.tests),
    asks: readAsks(doc.asks)
  };
}

/**
 * Was eine Karte dieser Vorlage für diesen Eintrag prüft — `null`: nichts erklärt (der Eintrag mit 1). Ein Feld zählt
 * mit jedem Eintrag, auf den es zeigt; kommt einer zweimal vor, gilt das grössere Gewicht.
 */
export function testsOf(tests: readonly TemplateTest[], entity: Entity, look: Lookup): CardTest[] | null {
  if (tests.length === 0) return null;
  const out = new Map<string, number>();
  const put = (id: string, weight: number) => out.set(id, Math.max(out.get(id) ?? 0, weight));
  for (const t of tests) {
    if (t.of === 'this') { put(entity.id, t.weight); continue; }
    const field = fieldsOf(entity, look).find((f) => f.key === t.of && f.type === 'ref');
    if (field === undefined) continue;
    for (const v of valuesOf(entity, field)) if (typeof v.value === 'string' && v.value !== '') put(v.value, t.weight);
  }
  return [...out].map(([id, weight]) => ({ id, weight }));
}

/** Was eine Vorlage braucht, um Karten zu machen: genau eine Karte, höchstens eine Schleife. */
export function templateProblems(template: Template): string[] {
  const cards = template.graph.nodes.filter((n) => n.type === 'card').length;
  const loops = template.graph.nodes.filter((n) => n.type === 'each').length;
  const out: string[] = [];
  if (cards === 0) out.push('Szablon nie ma kroku „Karta".');
  if (cards > 1) out.push('Szablon ma więcej niż jeden krok „Karta".');
  if (loops > 1) out.push('Szablon może mieć najwyżej jedną pętlę „Dla każdej wartości".');
  return out;
}

export interface Made {
  readonly cards: Card[];
  /** Warum für diesen Eintrag (teilweise) keine Karte entstand. */
  readonly problems: string[];
}

/**
 * DIE KARTEN EINES EINTRAGS AUS EINER VORLAGE. Ohne Schleife eine, mit
 * Schleife eine je Wert; keine, wo ein Warunek nicht erfüllt ist oder der
 * Antwort etwas fehlt (ein leeres Feld macht keine Frage).
 */
export async function cardsOf(template: Template, ctx: TemplateContext): Promise<Made> {
  const problems = templateProblems(template);
  if (problems.length > 0) return { cards: [], problems };
  const graph = template.graph;
  const cardNode = graph.nodes.find((n) => n.type === 'card')!;
  const loop = graph.nodes.find((n) => n.type === 'each');
  const varies = [...ancestors(graph, cardNode.id)].some((id) => {
    const node = graph.nodes.find((n) => n.id === id);
    return node !== undefined && (CHANCE.has(node.type) || (node.type === 'pick' && node.config.position !== 'first' && node.config.position !== 'last') || (node.type === 'mask' && node.config.mode === 'random')
      /* „Wpisy rodzaju" mit „losowo najwyżej": jedes Mal andere Paare, andere Dystraktoren. */
      || (node.type === 'entries' && num(node.config.count, 0) > 0));
  });

  type Run = { readonly variant?: string; readonly item?: Item; readonly requires?: readonly string[] };
  let runs: Run[] = [{}];
  if (loop !== undefined) {
    const before = ancestors(graph, loop.id);
    before.delete(loop.id);
    const probe = await evaluate(graph, TEMPLATE_PALETTE, ctx, { only: before });
    const items = graph.edges
      .filter((e) => e.to === loop.id && e.in === 'items')
      .flatMap((e) => {
        const produced = probe.outputs.get(e.from);
        const value = produced === undefined ? undefined : produced[e.out];
        return Array.isArray(value) ? (value as Item[]) : [];
      });
    const seen = new Map<string, number>();
    runs = items.map((item) => {
      const fragment = isObject(item.value) && isObject(item.value.fragment) ? (item.value.fragment as unknown as Fragment) : null;
      let variant = fragment ? fragment.id : hashOf(item.text);
      const n = seen.get(variant) ?? 0;
      seen.set(variant, n + 1);
      if (n > 0) variant = `${variant}.${n}`;
      return { variant, item, requires: fragment ? fragment.parts : [] };
    });
  }

  const cards: Card[] = [];
  for (const run of runs) {
    const fixed = loop !== undefined && run.item !== undefined ? new Map<string, RunOutput>([[loop.id, { item: [run.item] }]]) : undefined;
    const result = await evaluate(graph, TEMPLATE_PALETTE, { ...ctx, variant: run.variant }, { fixed });
    if (graph.nodes.some((n) => n.type === 'when' && result.outputs.get(n.id)?.pass === false)) continue;
    const error = result.errors.get(cardNode.id);
    if (error !== undefined) {
      const first = [...result.errors.entries()].find(([, text]) => text !== 'Poprzedni krok się nie udał.');
      problems.push(first ? first[1] : error);
      continue;
    }
    const made = result.outputs.get(cardNode.id)?.card as { prompt: PromptPart[]; draft?: Draft; explain: string[] } | undefined;
    if (made === undefined || made.draft === undefined) continue;
    const question = run.variant === undefined ? `${template.id}:${ctx.entity.id}` : `${template.id}:${ctx.entity.id}:${run.variant}`;
    const direction = template.direction;
    const prefix = `${template.id}:${ctx.entity.id}`;
    const tests = testsOf(template.tests, ctx.entity, ctx.look);
    const facts = factsOf(template.asks, ctx.entity, ctx.look, run.variant);
    cards.push({
      question,
      direction,
      key: cardKey(question, direction),
      entity: ctx.entity.id,
      template: template.id,
      prompt: made.prompt,
      answer: made.draft.answer,
      explain: made.explain,
      fingerprint: hashOf(varies ? stable(definitionOf(graph)) : stable(expectedOf(made.draft.answer))),
      varies,
      requires: (run.requires ?? []).map((part) => cardKey(`${prefix}:${part}`, direction)),
      ...(tests === null ? {} : { tests }),
      ...(facts.length === 0 ? {} : { facts })
    });
  }
  return { cards, problems };
}

/** Die Vorlagen, die für einen Eintrag gelten — über alle seine Arten. */
export const templatesFor = (entity: Entity, templates: readonly Template[]): Template[] =>
  templates.filter((t) => t.kinds.some((k) => entity.kinds.includes(k)));

/* -- Von Hand geschriebene Fragen und das Thema als Frage ---------------------------- */

const FORMS: readonly AnswerForm[] = ['text', 'number', 'date', 'one', 'many', 'truefalse', 'order', 'match', 'gap', 'flash', 'code', 'point', 'interactive', 'build'];

/* -- 2026-11-01: was nach Lemma dazukam -------------------------------------------------------------------- */

/** Ein JSON-Feld, auch als Text gekommen. */
function jsonOf(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const text = raw.trim();
  if (text === '') return undefined;
  try { return JSON.parse(text) as unknown; } catch { return undefined; }
}

/** `alternatives`: andere richtige Folgen von Kacheln — eine Liste von Listen (oder Zeilen „a | b | c"). */
export function readAlternatives(raw: unknown): string[][] {
  const v = jsonOf(raw);
  const list = Array.isArray(v) ? v : typeof raw === 'string' ? raw.split('\n') : [];
  const out: string[][] = [];
  for (const one of list.slice(0, 20)) {
    const tiles = Array.isArray(one) ? one.map((x) => str(x).trim()).filter((x) => x !== '') : typeof one === 'string' ? one.split('|').map((x) => x.trim()).filter((x) => x !== '') : [];
    if (tiles.length > 0) out.push(tiles);
  }
  return out;
}

/** `choices`: je Lücke (in ihrer Folge im Text) die falschen Möglichkeiten — leer: getippt. */
export function readChoices(raw: unknown): string[][] {
  const v = jsonOf(raw);
  return (Array.isArray(v) ? v : []).slice(0, 40).map((one) => (Array.isArray(one) ? one : typeof one === 'string' && one.trim() !== '' ? [one] : []).map((x) => str(x).trim()).filter((x) => x !== '').slice(0, 12));
}

/** `tests`: sichtbare Beispiele {input, output, note} einer Frage in Code — als Liste oder als JSON-Text. */
export function readCodeTests(raw: unknown): CodeTest[] {
  const v = jsonOf(raw);
  const out: CodeTest[] = [];
  for (const one of Array.isArray(v) ? v.slice(0, 40) : []) {
    if (!isObject(one) || !('input' in one) || !('output' in one)) continue;
    const note = str(one.note).trim();
    out.push({ input: one.input, output: one.output, ...(note === '' ? {} : { note: note.slice(0, 300) }) });
  }
  return out;
}

/** Ein Stück Text zwischen Lücken, als eine Zeile mit Wzory — ein Leerzeichen am Rand bleibt (sonst klebt das Wort an der Lücke). */
function pieceOf(raw: string): string {
  const inner = plainOf(raw, 'keep');
  if (inner === '') return /\s/.test(raw) ? ' ' : '';
  return `${/^\s/.test(raw) ? ' ' : ''}${inner}${/\s$/.test(raw) ? ' ' : ''}`;
}

/** Die Podpowiedzi einer Frage — höchstens fünf, in ihrer Folge. */
const hintsOf = (d: Readonly<Record<string, unknown>>): string[] => rawList(d.hints).map((x) => x.trim()).filter((x) => x !== '').slice(0, 5);

/**
 * EINE VON HAND GESCHRIEBENE FRAGE (Systemart `question`, [C4, D1]). Ihre
 * Felder:
 *
 * <code>
 *   prompt      die Frage (Auszeichnung)          form        eine der zwölf Formen
 *   answers     die richtigen Antworten (Text, Zahl, Datum, Lücke; die erste ist die Vorlage)
 *   options     zur Wahl (one, many)              correct     die richtigen Stellen in options
 *   items       in richtiger Reihenfolge (order)  left/right  Paare (match), gleiche Stelle = Paar
 *   leftLabel, rightLabel  (2026-10-27) über den Spalten   show  wie viele Paare je Karte (lange Listen)
 *   value       wahr oder falsch                  back        die Rückseite (flash)
 *   tolerance, relative, unit, precision, rule    wie streng
 *   quantity    (Schritt 13) welche Grösse eine Zahl ist — dann zählt die Einheit der Antwort
 *   explain     Wissen und Einträge zur Erklärung
 *   about       (2026-10-27) was die Frage prüft — die Karte trägt es als `about`
 *   needs       (2026-10-27) was vorher sitzen muss — ein Feld der Voraussetzungen (`prerequisites.ts`)
 * </code>
 * Welche Felder zu welcher Art gehören, sagt `questionTypes.ts`.
 */
/** 2026-10-23 (Schritt 13) — eine richtige Antwort, auch mit Einheit geschrieben („0,012 kN·m"), in der Einheit der Frage. */
function numberAnswer(text: string, unitText: string, quantity: string | undefined): number | null {
  if (quantity === undefined) return readNumber(text);
  const read = parseQuantity(text);
  if (read === null) return readNumber(text);
  const own = findUnit(unitText);
  if (read.unit === undefined || own === undefined || !measures(read.unit, quantity)) return read.value;
  return convert(read.value, read.unit, own) ?? read.value;
}

const sameText = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('pl-PL') === b.trim().toLocaleLowerCase('pl-PL');

/** Die Kennungen in einem Verweisfeld — auch in einer Hülle ({ value }). */
const refIds = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
  .map((x) => (typeof x === 'string' ? x : isObject(x) && typeof x.value === 'string' ? x.value : '')).filter((x) => x !== '');

/** 2026-10-27 — was über den beiden Spalten steht; ohne beide Nagłówki nichts. */
const headsOf = (d: Readonly<Record<string, unknown>>): readonly [string, string] | undefined => {
  const l = str(d.leftLabel).trim();
  const r = str(d.rightLabel).trim();
  return l === '' && r === '' ? undefined : [l, r];
};

/** Paare als Antwort — 2026-10-31 beide Spalten gemischt: links nie in der gespeicherten (oft zeitlichen) Folge. */
function matchAnswer(pairs: readonly { left: string; right: string }[], heads: readonly [string, string] | undefined, rng: () => number, set?: string): AnswerSpec {
  return { form: 'match', ...shuffledPairs(pairs, rng), ...(heads === undefined ? {} : { heads }), ...(set === undefined ? {} : { set }) };
}

/**
 * DIE FRAGE ALS EINE KARTE — so fragen ein Przebieg und das Modul „Pytanie" auf einer Seite. Eine
 * lange Liste von Paaren („Ile par naraz") zeigt dann je Versuch andere Paare; zum Lernen gibt
 * `questionCards` jedem Paar seine eigene Karte.
 */
export function questionCard(entity: Entity, seed = ''): Card | null {
  const rng = rngOf(`${seed}:${entity.id}`);
  /*
   * 2026-11-01 — EINE FRAGE MIT PARAMETERN (`questionParams.ts`): je Versuch neue Werte, eingesetzt in jeden Text der
   * Frage; die Karte trägt sie (`params`), und die Antwort nimmt sie mit. Der Fingerabdruck ist der der Frage, wie sie
   * geschrieben ist — die Geschichte endet nicht bei jedem Würfeln.
   */
  const spec = readParamsSpec(entity.data);
  const drawn = spec === null ? null : drawParams(spec, rng).values;
  const d: Readonly<Record<string, unknown>> = drawn === null ? entity.data : withParams(entity.data, drawn);
  const form = FORMS.find((f) => f === d.form) ?? 'text';
  const answers = lines(d.answers);
  let answer: AnswerSpec | null = null;
  /* Ein Fingerabdruck, der nicht vom Würfeln abhängt (eine lange Liste: alle Paare). */
  let print: unknown;
  /* 2026-11-01 — ein Satz je Möglichkeit, in der gezeigten Folge. */
  let feedback: string[] | undefined;
  /* Fragt jedes Mal anderes (eine lange Liste von Paaren, gezogene Parameter). */
  let varied = false;
  switch (form) {
    case 'text': answer = answers.length === 0 ? null : { form, accepted: answers, rule: readRule(d.rule, TEXT_RULE) }; break;
    case 'gap': {
      /* 2026-10-27 — die Lücke im Text selbst: [[słowo]] wird „…", und ohne eigene Antworten gilt das Wort (mehrere: nacheinander). */
      const raw = str(d.prompt);
      const gaps = [...raw.matchAll(GAP)].map((m) => m[1].trim()).filter((x) => x !== '');
      const accepted = answers.length > 0 ? answers : gaps.length > 0 ? [gaps.join(' ')] : [];
      const rule = readRule(d.rule, GAP_RULE);
      /* Der Fingerabdruck wie bisher (Text ohne LaTeX) — eine Lücke mit Wzór im Text behält ihre Geschichte. */
      const plain = plainOf(raw.replace(GAP, '…'));
      const shown = plainOf(raw.replace(GAP, '…'), 'keep');
      if (shown !== plain) print = { f: 'gap', a: accepted.map((a) => a.toLowerCase()).sort(), s: plain };
      /*
       * 2026-11-01 — MEHRERE LÜCKEN (oder Lücken zum Wählen, `choices`): jede Lücke an ihrer Stelle im Text, jede für
       * sich geprüft — getippt oder gewählt. Mit eigenen „answers" bleibt es eine Antwort für alles (wie bisher).
       */
      const choices = readChoices(d.choices);
      const words = raw.split(GAP);
      if (answers.length === 0 && gaps.length > 0 && (gaps.length >= 2 || choices.some((c) => c.length > 0)) && words.length === gaps.length * 2 + 1) {
        const slots: GapSlot[] = gaps.map((word, i) => (choices[i] !== undefined && choices[i]!.length > 0 ? { accepted: [word], choices: choices[i]! } : { accepted: [word] }));
        const pieces = words.filter((_w, i) => i % 2 === 0).map(pieceOf);
        answer = { form, shown, accepted, rule, pieces, gaps: slots };
        /* Ohne Wahl bleibt der Fingerabdruck der alte (dieselben Wörter, derselbe Text) — mit Wahl gehören die Möglichkeiten dazu. */
        if (choices.some((c) => c.length > 0)) print = { f: 'gap', a: accepted.map((a) => a.toLowerCase()).sort(), s: plain, g: slots.map((g) => g.choices ?? []) };
        break;
      }
      answer = accepted.length === 0 ? null : { form, shown, accepted, rule };
      break;
    }
    case 'number': {
      /* 2026-10-23 (Schritt 13) — die Grösse: genannt, sonst die der Einheit, wenn diese eindeutig ist. */
      const quantity = kindById(str(d.quantity))?.id ?? guessKind(str(d.unit));
      const values = answers.map((one) => numberAnswer(one, str(d.unit), quantity)).filter((n): n is number => n !== null);
      answer = values.length === 0 ? null : { form, values, tolerance: Math.max(0, num(d.tolerance, 0)), relative: d.relative === true, unit: str(d.unit), ...(quantity === undefined ? {} : { quantity }) };
      break;
    }
    case 'date': {
      const values = answers.map(readDateAnswer).filter((x): x is NonNullable<typeof x> => x !== null).map(dateKey);
      const precision: DatePrecision = d.precision === 'day' || d.precision === 'month' ? d.precision : 'year';
      answer = values.length === 0 ? null : { form, values, precision, tolerance: Math.max(0, Math.round(num(d.tolerance, 0))) };
      break;
    }
    case 'one':
    case 'many': {
      /* 2026-10-27 — leere Möglichkeiten fallen weg, die Nummern der richtigen rücken mit (`choicesOf`) — 2026-11-01 ihre Sätze auch. */
      const { options, correct, feedback: said } = choicesOf(d);
      if (options.length < 2 || correct.length === 0) break;
      const order = shuffle(options.map((_o, i) => i), rng);
      const shown = order.map((i) => options[i]);
      answer = form === 'one'
        ? { form, options: shown, correct: order.indexOf(correct[0]) }
        : { form, options: shown, correct: correct.map((c) => order.indexOf(c)).sort((a, b) => a - b), set: sentenceSet(d, entity.id) };
      if (said.some((x) => x !== '')) feedback = order.map((i) => said[i] ?? '');
      break;
    }
    case 'truefalse': answer = typeof d.value === 'boolean' ? { form, value: d.value } : null; break;
    case 'order': {
      const items = lines(d.items);
      /* 2026-10-31 — nie so, wie gespeichert: sonst wäre Ordnen Abschreiben. 2026-11-01 — mit `preview` das Gelegte als Wzór. */
      const preview = d.preview === 'math' || d.preview === 'text' ? { preview: d.preview as 'math' | 'text', join: typeof d.join === 'string' ? d.join : ' ' } : {};
      answer = items.length < 2 ? null : { form, items, shown: shuffleAway(items, rng, sameText), ...preview };
      break;
    }
    case 'match': {
      const pairs = pairsOf(d);
      if (pairs.length < 2) break;
      const show = showOf(d, pairs.length);
      /* 2026-10-27 — eine lange Liste: je Versuch `show` Paare, gewürfelt; die Geschichte gilt der ganzen Liste. */
      if (show !== null) { print = { f: 'match-all', p: pairs.map((p) => `${p.left}→${p.right}`).sort(), n: show }; varied = true; }
      answer = matchAnswer(show === null ? pairs : shuffle(pairs, rng).slice(0, show), headsOf(d), rng, sentenceSet(d, entity.id));
      break;
    }
    case 'flash': {
      const back = lines(d.back).length > 0 ? lines(d.back) : answers;
      answer = back.length === 0 ? null : { form, back };
      break;
    }
    case 'code': {
      /* 2026-11-01 — sichtbare Beispiele (`tests`): mit ihnen allein ist eine Frage in Code auch ohne verdeckte Fälle vollständig. */
      const tests = readCodeTests(d.tests);
      answer = { form, task: str(d.task), starter: str(d.starter), createInput: str(d.createInput), reference: str(d.reference), cases: Math.max(1, Math.round(num(d.cases, 5))), ...(tests.length === 0 ? {} : { tests }) };
      break;
    }
    case 'build': {
      /* 2026-11-01 — aus Kacheln bauen: die richtigen in ihrer Folge, falsche dazu, andere richtige Folgen. */
      const items = lines(d.items);
      const extra = lines(d.extra);
      answer = items.length === 0 || items.length + extra.length < 2 ? null
        : { form, items, extra, alternatives: readAlternatives(d.alternatives), preview: d.preview === 'text' ? 'text' : 'math', join: typeof d.join === 'string' ? d.join : ' ' };
      break;
    }
    case 'point': {
      const geo = isObject(d.place) ? d.place : null;
      const lat = geo === null ? null : readNumber(geo.lat);
      const lon = geo === null ? null : readNumber(geo.lon);
      answer = lat === null || lon === null ? null : { form, on: 'map', target: { lat, lon, r: Math.max(1, num(d.radius, 1000)) } };
      break;
    }
    case 'interactive': answer = interactiveSpec(d, rng); break;
  }
  if (answer === null) return null;
  /* 2026-11-01 — eine Frage mit Wzór behält ihn (`$…$`, gesetzt von KaTeX); ohne Wzór eine Zeile wie bisher. */
  const rawPrompt = str(d.prompt);
  const prompt = hasTex(rawPrompt) ? plainOf(rawPrompt, 'keep') : plainOf(rawPrompt);
  /* 2026-10-27 — was die Frage prüft („O czym"): ihre Kenntnis zählt dort mit, und sie wartet auf das, was dort zuerst zu können ist. */
  const about = refIds(d.about).filter((id) => id !== entity.id);
  /* 2026-11-01 — jedes Paar einer Liste ist ein Fakt: die Karte der ganzen Liste fragt sie alle. */
  /* 2026-11-01 — DIE TEILE DER FRAGE als Fakten (`partFacts`): Paare, Sätze, Lücken, ein benannter Fakt. */
  const facts = partFacts(entity.id, d, answer, prompt);
  const hints = hintsOf(d);
  const explanation = str(d.explanation).trim();
  const params = drawn === null ? undefined : readParams(drawn);
  /* Mit Parametern: der Fingerabdruck der Frage, wie sie geschrieben ist (nicht der gezogenen Zahlen). */
  if (drawn !== null) {
    const raw = entity.data;
    print = { f: 'params', d: Object.fromEntries(['form', 'answers', 'options', 'correct', 'items', 'extra', 'alternatives', 'left', 'right', 'value', 'back', 'choices', 'params', 'let', 'require', 'tolerance', 'relative', 'unit', 'precision'].filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]])) };
    varied = true;
  }
  return {
    question: entity.id,
    direction: '',
    key: cardKey(entity.id, ''),
    entity: entity.id,
    prompt: form === 'gap' || prompt === '' ? [] : [{ text: prompt }],
    answer,
    explain: lines(d.explain),
    fingerprint: hashOf(stable(print ?? expectedOf(answer))),
    /* Ein Bild mit Zufall (ein Ziel jedes Mal woanders) fragt jedes Mal anderes; eine lange Liste von Paaren auch; eine Frage mit Parametern auch. */
    varies: (answer.form === 'interactive' && Object.keys(answer.fixed).length > 0) || varied,
    requires: [],
    ...(about.length > 0 ? { about } : {}),
    ...(facts.length > 0 ? { facts } : {}),
    ...(hints.length > 0 ? { hints } : {}),
    ...(explanation === '' ? {} : { explanation }),
    ...(feedback === undefined ? {} : { feedback }),
    ...(params === undefined ? {} : { params })
  };
}

/**
 * 2026-11-01 — EINE FRAGE MIT PARAMETERN NEU GEZOGEN: dieselbe Karte (Schlüssel, Fingerabdruck), andere Zahlen — für
 * jedes neue Zeigen in einem Lauf (kommt sie wieder, rechnet man neu, statt sich die Zahl von eben zu merken).
 */
export function redrawCard(card: Card, entity: Entity | undefined, seed: string): Card {
  if (card.params === undefined || entity === undefined || !entity.kinds.includes('question')) return card;
  return questionCards(entity, seed).find((c) => c.key === card.key) ?? card;
}

/** 2026-11-01 — der Fakt eines Paars einer Frage „Połącz w pary": die Frage und das Paar (nicht die Karte, auf der es steht). */
export const pairFact = (questionId: string, left: string, right: string): string => `${questionId}#pair:${hashOf(`${left}→${right}`)}`;

/**
 * 2026-11-01 — DER FAKT EINES SATZES einer Frage „Kilka z kilku": der Satz in seinem Satz von Sätzen — gewöhnlich die
 * Frage; mit `share` ein gemeinsamer Name, dann zählen Fragen (Fassungen) mit demselben Namen für dieselben Sätze.
 */
export const sentenceFact = (set: string, text: string): string => `${set}#opt:${hashOf(text.trim())}`;

/** Der Satz von Sätzen einer Frage: `share` (getrimmt), sonst die Frage selbst. */
export const sentenceSet = (d: Readonly<Record<string, unknown>>, questionId: string): string =>
  (typeof d.share === 'string' && d.share.trim() !== '' ? `share:${d.share.trim()}` : questionId);

/** Der Fakt eines Teils, der nur sich selbst hat: ein benannter (`fact`) — gemeinsam mit `share`, sonst in der ganzen Baza. */
export const namedFact = (d: Readonly<Record<string, unknown>>, name: string): string =>
  `${typeof d.share === 'string' && d.share.trim() !== '' ? `share:${d.share.trim()}` : 'fact'}#fact:${hashOf(name.trim())}`;

/**
 * 2026-11-01 — EIN FAKT EINES EINTRAGS: `"fact": "#data"` heisst „die Seite data des Eintrags aus about“ — derselbe Fakt
 * wie die Karte einer Vorlage mit `asks: [{of: "this", facet: "data"}]` über diesen Eintrag. So zählen eine geschriebene
 * Frage und die Karten der Vorlagen füreinander. Ohne about: kein Eintrag, `null`.
 */
export const entryFact = (d: Readonly<Record<string, unknown>>, name: string): string | null => {
  if (!name.startsWith('#') || name.length < 2) return null;
  const about = refIds(d.about);
  return about.length === 0 ? null : `${about[0]}${name}`;
};

/** Die Lücke als Teil: das Wort, das hineingehört (dasselbe Wort zweimal ist ein Teil). */
export const gapFact = (set: string, word: string): string => `${set}#gap:${hashOf(word.trim().toLowerCase())}`;

/**
 * 2026-11-01 — DIE TEILE EINER FRAGE, allgemein: jede Frage fragt einen oder mehrere Teile, jeder Teil ist ein Fakt
 * `<Satz von Teilen>#<Teil>`. Der Satz ist `share` (dann teilen Fragen mit demselben Namen ihre Teile), sonst die Frage.
 * - „Połącz w pary": jedes Paar (`pair:`), „Kilka z kilku": jeder Satz (`opt:`), eine Lücke im Text mit mehreren
 *   Lücken: jedes Wort (`gap:`) — die Antwort sagt über jeden Teil für sich etwas.
 * - „Prawda czy fałsz": EIN Satz (`opt:`, der Text aus `fact` oder die Frage) — derselbe Fakt wie dieser Satz in einer
 *   Frage „Kilka z kilku" mit demselben `share`.
 * - Jede andere Form: nur mit `fact` (einem Namen) ein Teil — Fragen mit demselben Namen (und `share`) teilen ihn.
 * Ohne Teile: keine Fakten — die Karte zählt nur für sich, wie bisher.
 */
export function partFacts(questionId: string, d: Readonly<Record<string, unknown>>, answer: AnswerSpec, prompt: string): string[] {
  const set = sentenceSet(d, questionId);
  const named = typeof d.fact === 'string' && d.fact.trim() !== '' ? d.fact.trim() : null;
  const shared = typeof d.share === 'string' && d.share.trim() !== '';
  switch (answer.form) {
    case 'match': return pairsOf(d).map((p) => pairFact(set, p.left, p.right));
    case 'many': return answer.options.map((o) => sentenceFact(set, o));
    case 'gap': return answer.gaps !== undefined && answer.gaps.length > 1 ? answer.gaps.map((g) => gapFact(set, g.accepted[0] ?? '')) : named === null ? [] : [namedFact(d, named)];
    case 'truefalse': return named === null && !shared ? [] : [(named === null ? null : entryFact(d, named)) ?? sentenceFact(shared ? set : 'fact', named ?? prompt)];
    default: return named === null ? [] : [entryFact(d, named) ?? namedFact(d, named)];
  }
}

/** Ein Fakt mit dem, was die Antwort über ihn sagte. */
export interface FactAnswer {
  readonly correctness: number;
  /** Was dazu gegeben wurde, in Worten (ein Paar: „Morialdo — Przysiółek …"). */
  readonly given: string;
}

/**
 * 2026-11-01 — WAS EINE ANTWORT ÜBER JEDEN FAKT SAGT. „Połącz w pary": jedes gezeigte Paar für sich (richtig verbunden
 * 1, sonst 0) — auch die Paare, die nur danebenstanden. Jede andere Form: alle Fakten der Karte mit ihrer Richtigkeit.
 */
export function answerFacts(card: Card, given: unknown, outcome: Pick<Outcome, 'correctness'> & Partial<Pick<Outcome, 'marks'>>): Map<string, FactAnswer> {
  const out = new Map<string, FactAnswer>();
  const a = card.answer;
  if (a.form === 'match' && card.entity !== undefined) {
    const mine = new Map<number, number>();
    for (const p of Array.isArray(given) ? given : []) if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') mine.set(p[0], p[1]);
    for (const [l, r] of a.pairs) {
      const chosen = mine.get(l);
      out.set(pairFact(a.set ?? card.entity, a.left[l] ?? '', a.right[r] ?? ''), { correctness: chosen === r ? 1 : 0, given: chosen === undefined ? '' : `${a.left[l]} — ${a.right[chosen]}` });
    }
    return out;
  }
  /* 2026-11-01 — „Kilka z kilku": jeder gezeigte Satz für sich — richtig angekreuzt oder richtig frei gelassen. */
  if (a.form === 'many' && card.entity !== undefined) {
    const got = new Set(Array.isArray(given) ? given.filter((g): g is number => typeof g === 'number') : []);
    if (got.size === 0) return out;
    a.options.forEach((text, i) => {
      const marked = got.has(i);
      out.set(sentenceFact(a.set ?? card.entity!, text), { correctness: marked === a.correct.includes(i) ? 1 : 0, given: `${marked ? '☑' : '☐'} ${text}` });
    });
    return out;
  }
  /* 2026-11-01 — mehrere Lücken: jede für sich (die Fakten stehen in der Folge der Lücken; dasselbe Wort zweimal: der Mittelwert). */
  if (a.form === 'gap' && a.gaps !== undefined && (card.facts ?? []).length === a.gaps.length && outcome.marks !== undefined) {
    const words = Array.isArray(given) ? given : [];
    const sums = new Map<string, { sum: number; n: number; given: string[] }>();
    card.facts!.forEach((fact, i) => {
      const was = sums.get(fact) ?? { sum: 0, n: 0, given: [] };
      sums.set(fact, { sum: was.sum + (outcome.marks![i] ? 1 : 0), n: was.n + 1, given: [...was.given, typeof words[i] === 'string' ? (words[i] as string) : ''] });
    });
    for (const [fact, x] of sums) out.set(fact, { correctness: x.sum / x.n, given: x.given.filter((g) => g !== '').join(', ') });
    return out;
  }
  const said = typeof given === 'string' ? given : '';
  for (const fact of card.facts ?? []) out.set(fact, { correctness: outcome.correctness, given: said });
  return out;
}

/**
 * 2026-11-01 — KARTEN ARBEITEN ZUSAMMEN: was eine Antwort über einen Fakt sagt, gilt für JEDE Karte, die ihn fragt.
 * Zurück kommen die gefragte Karte (gezählt mit dem, was über IHREN Fakt gesagt wurde — eine Karte eines Paars mit ihrem
 * Paar) und jede andere Karte, deren Fakten alle beantwortet wurden (ihre Richtigkeit: der Durchschnitt). So zählt
 * eine Karte „Połącz w pary" für jedes gezeigte Paar, und zwei Vorlagen, die mit `asks` dasselbe fragen, teilen jede
 * Antwort. Vorher kamen die eben richtig verbundenen Paare auf der nächsten Karte derselben Liste gleich wieder.
 */
export function answerEvidence(card: Card, given: unknown, outcome: Pick<Outcome, 'correctness'> & Partial<Pick<Outcome, 'marks'>>, all: readonly Card[]): { readonly card: Card; readonly correctness: number; readonly given: string }[] {
  const facts = answerFacts(card, given, outcome);
  const own = (card.facts ?? []).length === 1 ? facts.get(card.facts![0]) : undefined;
  const out: { card: Card; correctness: number; given: string }[] = [{ card, correctness: own?.correctness ?? outcome.correctness, given: own?.given ?? '' }];
  if (facts.size === 0) return out;
  const seen = new Set<string>([card.key]);
  for (const other of all) {
    const asks = other.facts ?? [];
    if (asks.length === 0 || seen.has(other.key) || !asks.every((f) => facts.has(f))) continue;
    seen.add(other.key);
    const said = asks.map((f) => facts.get(f)!);
    out.push({ card: other, correctness: said.reduce((sum, x) => sum + x.correctness, 0) / said.length, given: said.map((x) => x.given).filter((x) => x !== '').join('; ') });
  }
  return out;
}

/**
 * 2026-10-27 — DIE KARTEN EINER FRAGE ZUM LERNEN. Gewöhnlich eine. „Połącz w pary" mit „Ile par
 * naraz" kleiner als die Liste: JEDES PAAR SEINE KARTE (`frage:p<hash der linken Seite>`) — mit
 * `show − 1` anderen Paaren, je Versuch anders gewürfelt. So holt die Wiederholung gerade die Paare
 * zurück, die noch nicht sitzen, und eine Liste von 40 Jahren zeigt nie alle 40 auf einmal. Der
 * Fingerabdruck ist der des eigenen Paars: ändert sich ein anderes, bleibt die Geschichte.
 */
export function questionCards(entity: Entity, seed = ''): Card[] {
  const whole = questionCard(entity, seed);
  if (whole === null) return [];
  const d = entity.data;
  if (whole.answer.form === 'many') return sentenceCards(entity, whole, seed);
  const pairs = whole.answer.form === 'match' ? pairsOf(d) : [];
  const show = pairs.length < 2 ? null : showOf(d, pairs.length);
  if (show === null) return [whole];
  const heads = headsOf(d);
  const seen = new Map<string, number>();
  return pairs.map((pair, i) => {
    let variant = `p${hashOf(pair.left)}`;
    const n = seen.get(variant) ?? 0;
    seen.set(variant, n + 1);
    if (n > 0) variant = `${variant}.${n}`;
    const rng = rngOf(`${seed}:${entity.id}:${variant}`);
    /* Daneben andere Paare — keines mit derselben linken oder rechten Seite (sonst wäre es nicht zu unterscheiden). */
    const others: { left: string; right: string }[] = [];
    for (const other of shuffle(pairs.filter((_, j) => j !== i), rng)) {
      if (others.length >= show - 1) break;
      if ([pair, ...others].some((p) => p.left === other.left || p.right === other.right)) continue;
      others.push(other);
    }
    const question = `${entity.id}:${variant}`;
    return {
      ...whole,
      question,
      key: cardKey(question, ''),
      answer: matchAnswer(shuffle([pair, ...others], rng), heads, rng, sentenceSet(d, entity.id)),
      fingerprint: hashOf(stable({ f: 'pair', l: pair.left, r: pair.right, n: show })),
      varies: true,
      label: `${pair.left} — ${pair.right}`,
      facts: [pairFact(sentenceSet(d, entity.id), pair.left, pair.right)]
    };
  });
}

/**
 * 2026-11-01 — „KILKA Z KILKU" MIT „Ile zdań naraz" (`show`) kleiner als die Sätze: JEDER SATZ SEINE KARTE
 * (`frage:s<hash des Satzes>`) — er und `show − 1` andere, je Versuch anders gewürfelt, mindestens einer davon richtig
 * (sonst gäbe es nichts anzukreuzen). Jede Antwort zählt für jeden gezeigten Satz (`answerEvidence`), so kommen nur
 * die Sätze wieder, die noch nicht sitzen. Ohne `show`: die eine Karte mit allen Sätzen (gezählt Satz für Satz).
 */
function sentenceCards(entity: Entity, whole: Card, seed: string): Card[] {
  const d = entity.data;
  const { options, correct, feedback: said } = choicesOf(d);
  const show = showOf(d, options.length);
  if (show === null || options.length < 3) return [whole];
  const set = sentenceSet(d, entity.id);
  const good = new Set(correct);
  const seen = new Map<string, number>();
  return options.map((text, i) => {
    let variant = `s${hashOf(text.trim())}`;
    const n = seen.get(variant) ?? 0;
    seen.set(variant, n + 1);
    if (n > 0) variant = `${variant}.${n}`;
    const rng = rngOf(`${seed}:${entity.id}:${variant}`);
    const rest = shuffle(options.map((_o, j) => j).filter((j) => j !== i && options[j]!.trim() !== text.trim()), rng);
    const picked: number[] = [i];
    /* Ist der Satz selbst falsch, steht ein richtiger daneben. */
    if (!good.has(i)) { const one = rest.find((j) => good.has(j)); if (one !== undefined) picked.push(one); }
    for (const j of rest) { if (picked.length >= show) break; if (!picked.includes(j)) picked.push(j); }
    const order = shuffle(picked, rng);
    const question = `${entity.id}:${variant}`;
    const feedback = said.some((x) => x !== '') ? order.map((j) => said[j] ?? '') : undefined;
    const { feedback: _whole, ...rest0 } = whole;
    return {
      ...rest0,
      question,
      key: cardKey(question, ''),
      answer: { form: 'many', options: order.map((j) => options[j]!), correct: order.flatMap((j, k) => (good.has(j) ? [k] : [])), set },
      fingerprint: hashOf(stable({ f: 'sentence', t: text.trim(), c: good.has(i), n: show })),
      varies: true,
      label: text,
      facts: [sentenceFact(set, text)],
      ...(feedback === undefined ? {} : { feedback })
    };
  });
}
