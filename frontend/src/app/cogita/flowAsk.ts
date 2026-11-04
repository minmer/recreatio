/**
 * 2026-11-04 (Prompt 10) — WAS EINE ERZÄHLUNG FRAGT: die Regel des Spielers für jede Baza und jeden Ablauf, nicht
 * etwas, das die Daten je Frage setzen müssen.
 * <code>
 *   gefragt       nur, was der Lernende braucht: noch nicht gekonnt oder zu wiederholen (unter 100 %); was er kann
 *                 (Band „znane"), wird STILL übersprungen — über den Ausgang „dobrze", als wäre es richtig beantwortet;
 *                 nichts wird gespeichert, der Plan der Karte bleibt. Bilder („Pokaż") werden immer gezeigt.
 *   Kenntnis      einer Frage: ihre EIGENE Karte (die, die der Schritt fragt), aus der ganzen Geschichte des Lernenden
 *                 (alle Erzählungen, Powtórki, Üben — mit den Zusammenführungen); eines Themas: seine Karten. Was keine
 *                 Karte hat, kann nicht gefragt werden und hält nichts auf (gilt als gekonnt).
 *   Zähler        „Zostało N pytań": die verschiedenen Fragen, die vom Schritt aus noch kommen und gefragt würden
 *   Przerywnik    wäre die nächste Frage dieselbe wie eben (nach einer falschen Antwort), kommt zuerst eine gekonnte
 *                 dazwischen — vom selben Thema oder aus dieser Erzählung, sonst irgendeine gekonnte; sie zählt nicht
 *                 mit, und nur eine falsche Antwort auf sie wird gespeichert.
 * </code>
 * Rein; \`FlowPlayer\` benutzt es.
 */

import type { Card } from './cardBasics';
import { follow, type Flow } from './flow';
import type { GraphNode } from './graph';
import { average, knownessOf, levelOfKnowness, type Mark, type Spacing } from './knowness';
import { cardEntities } from './prerequisites';

/** Woher die Antworten kommen (die ganze Geschichte des Lernenden). */
export type MarksOf = ((card: Card) => readonly Mark[]) & {
  /** 2026-11-04 (Prompt 15) — die Abstände des Lernenden, dessen Antworten es sind; fehlt es: die Vorgabe. */
  readonly spacing?: Spacing;
};

/** Die Karte, die ein Frage-Schritt fragt. */
export const askedCardOf = (node: GraphNode, cardOf: (id: string) => Card | null): Card | null => {
  if (node.type !== 'question') return null;
  const c = node.config;
  const id = typeof c.of === 'string' && c.of !== '' ? c.of : typeof c.card === 'string' ? c.card : '';
  return id === '' ? null : cardOf(id);
};

/** Die Kenntnis einer Karte jetzt (0 ohne Antwort). */
export const cardKnow = (card: Card, marks: MarksOf, now = Date.now()): number => knownessOf([...marks(card)], now, marks.spacing);

/** Gekonnt (Band „znane", ab 100 %)? */
export const isKnown = (card: Card, marks: MarksOf, now = Date.now()): boolean => levelOfKnowness(cardKnow(card, marks, now)) === 'known';

/**
 * Die Kenntnis eines Eintrags für die Bedingungen eines Ablaufs: eine Frage — ihre eigene Karte (dieselbe, die der Schritt
 * fragt); ein Thema — der Mittelwert seiner Karten; ohne jede Karte 1 (es kann nicht gefragt werden und hält nichts auf).
 */
export function flowKnowness(_id: string, own: Card | null, about: readonly Card[], marks: MarksOf, now = Date.now()): number {
  if (own !== null) return cardKnow(own, marks, now);
  if (about.length === 0) return 1;
  return average(about.map((c) => cardKnow(c, marks, now)));
}

/** Soll dieser Schritt übersprungen werden? Nur Fragen, nur gekonnte. */
export function skipStep(node: GraphNode, cardOf: (id: string) => Card | null, marks: MarksOf | null, now = Date.now()): boolean {
  if (marks === null || node.type !== 'question') return false;
  const card = askedCardOf(node, cardOf);
  return card !== null && isKnown(card, marks, now);
}

/**
 * Wie viele verschiedene Fragen vom Schritt aus noch gefragt würden (gekonnte zählen nicht): alles, was vom Schritt aus
 * erreichbar ist — auch eine Schleife des Przegląd.
 */
export function questionsLeft(flow: Flow, from: string | null, cardOf: (id: string) => Card | null, marks: MarksOf | null, now = Date.now()): { readonly left: number; readonly keys: readonly string[] } {
  if (from === null) return { left: 0, keys: [] };
  const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
  const seen = new Set<string>();
  const keys = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = nodes.get(id);
    if (n === undefined) continue;
    const card = askedCardOf(n, cardOf);
    if (card !== null && (marks === null || !isKnown(card, marks, now))) keys.add(card.key);
    for (const e of flow.graph.edges) if (e.from === id) stack.push(e.to);
  }
  return { left: keys.size, keys: [...keys] };
}

/**
 * Ein Przerywnik: eine gekonnte Karte, nicht die eben gefragte — vom selben Thema, sonst aus den Fragen dieser Erzählung,
 * sonst irgendeine gekonnte. `null`: es gibt keine.
 */
export function pickSpacer(previous: Card, inFlow: readonly Card[], all: readonly Card[], marks: MarksOf, now = Date.now()): Card | null {
  const topics = new Set(cardEntities(previous).filter((e) => e !== (previous.entity ?? previous.question)));
  const ok = (c: Card) => c.key !== previous.key && isKnown(c, marks, now);
  return all.find((c) => ok(c) && cardEntities(c).some((e) => topics.has(e)))
    ?? inFlow.find(ok)
    ?? all.find(ok)
    ?? null;
}

/** Die Fragen eines Ablaufs (je Schritt seine Karte). */
export const cardsInFlow = (flow: Flow, cardOf: (id: string) => Card | null): Card[] => {
  const out = new Map<string, Card>();
  for (const n of flow.graph.nodes) { const c = askedCardOf(n, cardOf); if (c !== null) out.set(c.key, c); }
  return [...out.values()];
};

/** Wohin ein übersprungener Schritt führt: sein Ausgang „dobrze". */
export const skipTarget = (flow: Flow, node: GraphNode): string | null => follow(flow, node.id, 'right');
