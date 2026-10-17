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

import { checkCode, checkDate, checkFlash, checkMany, checkMatch, checkNumber, checkOne, checkOrder, checkPoint, checkText, checkTrueFalse, GAP_RULE, readDateAnswer, readRule, TEXT_RULE, type AnswerForm, type FlashGrade, type Outcome, type PointGiven, type TextRule } from './check';
import { ancestors, evaluate, readGraph, type Graph, type RunOutput } from './graph';
import { dateKey, fieldsOf, labelOf, plainOf, readNumber, valuesOf, type DatePrecision, type Entity, type Lookup } from './schema';
import { type AnswerSpec, type Card, type Fragment, type Item, type PromptPart, type TemplateContext, cardKey, hashOf, isObject, lines, num, rngOf, shuffle, stable, str } from './cardBasics';
import { type Draft, TEMPLATE_PALETTE } from './cardPalette';
import { checkInteractive, interactiveExpected, interactiveSpec } from './interactive';

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
    case 'code': return { f: 'code', r: answer.reference, c: answer.createInput, n: answer.cases };
    case 'point': return { f: 'point', t: answer.target };
    case 'interactive': return interactiveExpected(answer);
  }
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
    case 'text': return checkText(a.accepted, typeof given === 'string' ? given : '', { ...a.rule, ...rule });
    case 'gap': return checkText(a.accepted, typeof given === 'string' ? given : '', { ...a.rule, ...rule });
    case 'number': return checkNumber(a, given);
    case 'date': return checkDate(a, typeof given === 'string' ? given : '');
    case 'one': return checkOne(a.correct, typeof given === 'number' ? given : null);
    case 'many': return checkMany(a.correct, Array.isArray(given) ? given.filter((g): g is number => typeof g === 'number') : []);
    case 'truefalse': return checkTrueFalse(a.value, typeof given === 'boolean' ? given : null);
    case 'order': return checkOrder(a.items, Array.isArray(given) ? given.map(String) : []);
    case 'match': return checkMatch(a.pairs, Array.isArray(given) ? given.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number')) : []);
    case 'flash': return checkFlash(given === 'knew' || given === 'partly' || given === 'not' ? (given as FlashGrade) : null);
    case 'code': return checkCode(isObject(given) && typeof given.passed === 'number' && typeof given.total === 'number' ? { passed: given.passed, total: given.total } : null);
    case 'point': return checkPoint(a.target, isObject(given) ? (given as unknown as PointGiven) : null);
    case 'interactive': return checkInteractive(a, given);
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
}

export function readTemplate(id: string, raw: unknown): Template {
  const doc = isObject(raw) ? raw : {};
  return {
    id,
    name: str(doc.name).trim().slice(0, 120) || 'Szablon',
    kinds: lines(doc.kinds),
    direction: str(doc.direction).trim().slice(0, 40),
    graph: readGraph(doc.graph)
  };
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
      requires: (run.requires ?? []).map((part) => cardKey(`${prefix}:${part}`, direction))
    });
  }
  return { cards, problems };
}

/** Die Vorlagen, die für einen Eintrag gelten — über alle seine Arten. */
export const templatesFor = (entity: Entity, templates: readonly Template[]): Template[] =>
  templates.filter((t) => t.kinds.some((k) => entity.kinds.includes(k)));

/* -- Von Hand geschriebene Fragen und das Thema als Frage ---------------------------- */

const FORMS: readonly AnswerForm[] = ['text', 'number', 'date', 'one', 'many', 'truefalse', 'order', 'match', 'gap', 'flash', 'code', 'point', 'interactive'];

/**
 * EINE VON HAND GESCHRIEBENE FRAGE (Systemart `question`, [C4, D1]). Ihre
 * Felder:
 *
 * <code>
 *   prompt      die Frage (Auszeichnung)          form        eine der zwölf Formen
 *   answers     die richtigen Antworten (Text, Zahl, Datum, Lücke; die erste ist die Vorlage)
 *   options     zur Wahl (one, many)              correct     die richtigen Stellen in options
 *   items       in richtiger Reihenfolge (order)  left/right  Paare (match), gleiche Stelle = Paar
 *   value       wahr oder falsch                  back        die Rückseite (flash)
 *   tolerance, relative, unit, precision, rule    wie streng
 *   explain     Wissen und Einträge zur Erklärung
 * </code>
 */
export function questionCard(entity: Entity, seed = ''): Card | null {
  const d = entity.data;
  const form = FORMS.find((f) => f === d.form) ?? 'text';
  const rng = rngOf(`${seed}:${entity.id}`);
  const answers = lines(d.answers);
  let answer: AnswerSpec | null = null;
  switch (form) {
    case 'text': answer = answers.length === 0 ? null : { form, accepted: answers, rule: readRule(d.rule, TEXT_RULE) }; break;
    case 'gap': answer = answers.length === 0 ? null : { form, shown: plainOf(str(d.prompt)), accepted: answers, rule: readRule(d.rule, GAP_RULE) }; break;
    case 'number': {
      const values = answers.map(readNumber).filter((n): n is number => n !== null);
      answer = values.length === 0 ? null : { form, values, tolerance: Math.max(0, num(d.tolerance, 0)), relative: d.relative === true, unit: str(d.unit) };
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
      const options = lines(d.options);
      const correct = (Array.isArray(d.correct) ? d.correct : [d.correct]).filter((i): i is number => typeof i === 'number' && i >= 0 && i < options.length);
      if (options.length < 2 || correct.length === 0) break;
      const order = shuffle(options.map((_o, i) => i), rng);
      const shown = order.map((i) => options[i]);
      answer = form === 'one'
        ? { form, options: shown, correct: order.indexOf(correct[0]) }
        : { form, options: shown, correct: correct.map((c) => order.indexOf(c)).sort((a, b) => a - b) };
      break;
    }
    case 'truefalse': answer = typeof d.value === 'boolean' ? { form, value: d.value } : null; break;
    case 'order': {
      const items = lines(d.items);
      answer = items.length < 2 ? null : { form, items, shown: shuffle(items, rng) };
      break;
    }
    case 'match': {
      const left = lines(d.left);
      const right = lines(d.right);
      const n = Math.min(left.length, right.length);
      if (n < 2) break;
      const order = shuffle(Array.from({ length: n }, (_, i) => i), rng);
      answer = { form, left: left.slice(0, n), right: order.map((i) => right[i]), pairs: Array.from({ length: n }, (_, i): [number, number] => [i, order.indexOf(i)]) };
      break;
    }
    case 'flash': {
      const back = lines(d.back).length > 0 ? lines(d.back) : answers;
      answer = back.length === 0 ? null : { form, back };
      break;
    }
    case 'code': answer = { form, task: str(d.task), starter: str(d.starter), createInput: str(d.createInput), reference: str(d.reference), cases: Math.max(1, Math.round(num(d.cases, 5))) }; break;
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
  const prompt = plainOf(str(d.prompt));
  return {
    question: entity.id,
    direction: '',
    key: cardKey(entity.id, ''),
    entity: entity.id,
    prompt: form === 'gap' || prompt === '' ? [] : [{ text: prompt }],
    answer,
    explain: lines(d.explain),
    fingerprint: hashOf(stable(expectedOf(answer))),
    /* Ein Bild mit Zufall (ein Ziel jedes Mal woanders) fragt jedes Mal anderes. */
    varies: answer.form === 'interactive' && Object.keys(answer.fixed).length > 0,
    requires: []
  };
}

/**
 * DAS THEMA ALS FRAGE [C4]: sein Text vorn, das Wissen, das es beantwortet,
 * auf der Rückseite — selbst bewertet.
 */
export function topicCard(topic: Entity, look: Lookup): Card | null {
  const field = fieldsOf(topic, look).find((f) => f.key === 'answers');
  const back = field === undefined ? [] : valuesOf(topic, field)
    .map((v) => (typeof v.value === 'string' ? look.entity(v.value) : undefined))
    .filter((e): e is Entity => e !== undefined)
    .map((e) => labelOf(e, look));
  if (back.length === 0) return null;
  const text = labelOf(topic, look);
  const answer: AnswerSpec = { form: 'flash', back };
  return {
    question: topic.id,
    direction: 'topic',
    key: cardKey(topic.id, 'topic'),
    entity: topic.id,
    prompt: [{ text }],
    answer,
    explain: [],
    fingerprint: hashOf(stable(expectedOf(answer))),
    varies: false,
    requires: []
  };
}
