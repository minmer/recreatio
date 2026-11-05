/**
 * 2026-11-01 — DIE KARTE DES FORTSCHRITTS („kafelki", Lemma: ein Quilt aus Ideen) — rein gerechnet, ohne Oberfläche
 * (gezeichnet von `QuiltView.tsx`, geprüft in `app-lemma-quilt-check`).
 *
 * <code>
 *   Kachel     ein Eintrag des Widoku; seine Stufe aus der Kenntnis des EINTRAGS (`knowing.ts`, gewogen aus seinen Karten
 *              und dem, was auf ihm aufbaut):
 *                nowe         noch keine Antwort (und nichts, was auf ihm aufbaut, sitzt)
 *                uczę się     beantwortet, aber unter 0,1 (`FORGOTTEN`): zuletzt falsch oder vergessen
 *                do powtórki  0,1 bis 1 — gekonnt, jetzt zu wiederholen
 *                umiem        ab 1 (`KNOWN`)
 *   Gruppen    die Gruppierung des Widoku (`selection.ts` `groupsOf`): eine Achse mit Überschriften gibt Lektionen unter
 *              Kapiteln; ohne Gruppierung eine Gruppe ohne Namen
 *   Klasse     je Eintrag: wie viele Uczący się ihn können (Anteil, Zahl) — vier Stufen derselben Rampe, „—" ohne Antwort
 *   Pytania    je Frage über alle: Erfolg, gleich beim ersten Mal, Versuche je Person, Podpowiedzi, die häufigste falsche
 *              Antwort — die Lehrerin sieht, wo die Klasse scheitert
 *   Ćwicz to   eine Powtórka auf Zeit: der Eintrag und die Fragen über ihn („O czym"), nach dem, was man kann
 * </code>
 */

import type { Card } from './cardBasics';
import type { Graph } from './graph';
import { itemKnowness, type Gauge } from './knowing';
import { FORGOTTEN, KNOWN } from './knowness';
import type { AnswerRecord } from './learn';
import { cardsAbout } from './prerequisites';
import type { Group } from './selection';

/* -- Stufen ---------------------------------------------------------------------------------------------------- */

export type QuiltBand = 'new' | 'learning' | 'due' | 'known';

export const QUILT_BANDS: readonly QuiltBand[] = ['new', 'learning', 'due', 'known'];

export const QUILT_LABEL: Readonly<Record<QuiltBand, string>> = { new: 'nowe', learning: 'uczę się', due: 'do powtórki', known: 'umiem' };

export const QUILT_SAYS: Readonly<Record<QuiltBand, string>> = {
  new: 'jeszcze bez odpowiedzi',
  learning: 'ostatnio źle albo zapomniane — wraca do nauki',
  due: 'umiesz, a teraz trzeba powtórzyć',
  known: 'umiesz — przed terminem powtórki'
};

/** Das Zeichen jeder Stufe — ein Kreis, der sich füllt: nie nur die Farbe. */
export const QUILT_MARK: Readonly<Record<QuiltBand, string>> = { new: '○', learning: '◔', due: '◑', known: '●' };

/** Wie viele Karten einen Eintrag prüfen — und wie viele davon beantwortet sind. */
function testedBy(g: Gauge, id: string): { cards: number; answered: number } {
  const tests = g.testing.get(id) ?? [];
  return { cards: tests.length, answered: tests.filter((t) => g.states.has(t.key)).length };
}

/**
 * DIE STUFE EINES EINTRAGS. Ohne beantwortete Karte ist er neu — es sei denn, was auf ihm aufbaut, sitzt schon (A.3):
 * dann zählt diese Kenntnis wie eine eigene.
 */
export function quiltBand(g: Gauge, id: string): QuiltBand {
  const k = itemKnowness(g, id);
  const { answered } = testedBy(g, id);
  if (answered === 0 && !(k > 0)) return 'new';
  if (k >= KNOWN) return 'known';
  if (k >= FORGOTTEN) return 'due';
  return answered > 0 ? 'learning' : 'new';
}

export interface QuiltTile {
  readonly id: string;
  readonly band: QuiltBand;
  /** Die Kenntnis des Eintrags jetzt (0 … √10). */
  readonly knowness: number;
  /** Karten, die ihn prüfen, und davon beantwortete — ohne Karten lässt er sich nicht üben. */
  readonly cards: number;
  readonly answered: number;
}

export function tileOf(g: Gauge, id: string): QuiltTile {
  return { id, band: quiltBand(g, id), knowness: itemKnowness(g, id), ...testedBy(g, id) };
}

export interface QuiltGroup {
  readonly key: string;
  readonly label: string;
  /** Die Überschrift darüber (der Wert des Feldes `group` einer Achse: das Kapitel einer Lektion). */
  readonly head?: { readonly key: string; readonly label: string };
  readonly tiles: readonly QuiltTile[];
}

/**
 * DIE KACHELN IN IHREN GRUPPEN. `groups`: die Gruppen des Widoku (`viewGroups`) — `null`: eine Gruppe mit allen
 * Einträgen in ihrer Reihenfolge. Leere Gruppen fallen weg; ein Eintrag, der in mehreren Gruppen steht, steht in jeder.
 */
export function quiltGroups(ids: readonly string[], groups: readonly Group[] | null, g: Gauge): QuiltGroup[] {
  const tiles = new Map<string, QuiltTile>();
  const tile = (id: string): QuiltTile => {
    let t = tiles.get(id);
    if (t === undefined) { t = tileOf(g, id); tiles.set(id, t); }
    return t;
  };
  if (groups === null) return ids.length === 0 ? [] : [{ key: '', label: '', tiles: ids.map(tile) }];
  const inView = new Set(ids);
  const out: QuiltGroup[] = [];
  for (const group of groups) {
    const members = group.ids.filter((id) => inView.has(id));
    if (members.length === 0) continue;
    out.push({ key: group.key, label: group.label, ...(group.head === undefined ? {} : { head: group.head }), tiles: members.map(tile) });
  }
  return out;
}

/** Wie viele Kacheln in jeder Stufe stehen. */
export function bandCounts(tiles: readonly QuiltTile[]): Record<QuiltBand, number> {
  const out: Record<QuiltBand, number> = { new: 0, learning: 0, due: 0, known: 0 };
  for (const t of tiles) out[t.band] += 1;
  return out;
}

/** Jeder Eintrag einmal — eine Kachel in zwei Gruppen zählt in der Summe einmal. */
export function distinctTiles(groups: readonly QuiltGroup[]): QuiltTile[] {
  const seen = new Map<string, QuiltTile>();
  for (const group of groups) for (const t of group.tiles) if (!seen.has(t.id)) seen.set(t.id, t);
  return [...seen.values()];
}

/* -- Die Klasse ------------------------------------------------------------------------------------------------ */

export interface ClassTile {
  readonly id: string;
  /** Uczący się, die ihn können (Stufe „umiem"). */
  readonly known: number;
  /** Uczący się, die auf eine seiner Karten geantwortet haben. */
  readonly answered: number;
  readonly learners: number;
  /** Anteil derer, die ihn können, an allen (0–1). */
  readonly share: number;
  /** Je Stufe, wie viele Uczący się dort stehen. */
  readonly bands: Readonly<Record<QuiltBand, number>>;
}

/** WIE DIE KLASSE EINEN EINTRAG KANN: je Uczący się seine Stufe, gezählt. */
export function classTiles(ids: readonly string[], gauges: readonly Gauge[]): Map<string, ClassTile> {
  const out = new Map<string, ClassTile>();
  for (const id of new Set(ids)) {
    const bands: Record<QuiltBand, number> = { new: 0, learning: 0, due: 0, known: 0 };
    let answered = 0;
    for (const g of gauges) {
      bands[quiltBand(g, id)] += 1;
      if (testedBy(g, id).answered > 0) answered += 1;
    }
    out.set(id, { id, known: bands.known, answered, learners: gauges.length, share: gauges.length === 0 ? 0 : bands.known / gauges.length, bands });
  }
  return out;
}

/** Die Stufe einer Kachel der Klasse: 0 — niemand hat geantwortet; sonst 1–4 nach Vierteln des Anteils. */
export function classStep(tile: Pick<ClassTile, 'answered' | 'share'>): 0 | 1 | 2 | 3 | 4 {
  if (tile.answered === 0) return 0;
  return (1 + Math.min(3, Math.floor(Math.max(0, Math.min(1, tile.share)) * 4))) as 1 | 2 | 3 | 4;
}

/** Die Grenzen der Stufen in Worten (für die Legende). */
export const CLASS_STEP_LABEL: Readonly<Record<1 | 2 | 3 | 4, string>> = { 1: 'umie mniej niż ¼', 2: '¼ – ½', 3: '½ – ¾', 4: 'ponad ¾' };

/* -- Pytania: wo die Klasse scheitert ----------------------------------------------------------------------------- */

export interface QuestionClassStat {
  readonly card: Card;
  /** Wie viele Uczący się geantwortet haben. */
  readonly learners: number;
  readonly answers: number;
  /** Ganz richtige Antworten (ohne Podpowiedź). */
  readonly right: number;
  /** Anteil ganz richtiger Antworten — `null`: keine Antwort. */
  readonly success: number | null;
  /** Anteil der Uczący się, deren erste Antwort ganz richtig war. */
  readonly firstRight: number | null;
  /** Antworten je Uczący się, der geantwortet hat. */
  readonly attempts: number | null;
  /** Aufgedeckte Podpowiedzi zusammen, und wie viele Antworten mit einer kamen. */
  readonly hints: number;
  readonly hinted: number;
  /** Die häufigste falsche Antwort, in Worten — mit wie vielen sie kam. */
  readonly wrong: { readonly text: string; readonly count: number } | null;
}

/** Ganz richtig: die Prüfung gab (fast) 1 — eine richtige Antwort mit Podpowiedź zählt hier nicht. */
const isRight = (a: AnswerRecord): boolean => a.correctness >= 0.999;

/**
 * Falsch: unter der Hälfte — ausser die Antwort war richtig und nur die Podpowiedzi haben sie gedrückt (drei
 * Podpowiedzi lassen von einer richtigen Antwort ¼).
 */
export function isWrongAnswer(a: AnswerRecord, cost = 0.25): boolean {
  if (a.correctness >= 0.5) return false;
  const hints = a.hints ?? 0;
  return !(hints > 0 && a.correctness >= 1 - cost * hints - 1e-9);
}

const fold = (s: string): string => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL');

/**
 * JE FRAGE ÜBER ALLE UCZĄCY SIĘ. `words(card, given)`: das Gegebene in Worten (gespeichert ist, was die Karte bekam —
 * bei einer Wahl die Nummer); leer oder „—" zählt nicht als falsche Antwort. Nur Fragen mit Antworten.
 */
export function questionClassStats(
  cards: readonly Card[],
  learners: readonly { readonly answers: (card: Card) => readonly AnswerRecord[] }[],
  words: (card: Card, given: string | undefined) => string
): QuestionClassStat[] {
  const out: QuestionClassStat[] = [];
  for (const card of cards) {
    let people = 0;
    let answers = 0;
    let right = 0;
    let firstRight = 0;
    let hints = 0;
    let hinted = 0;
    const wrongs = new Map<string, { text: string; count: number; at: number }>();
    for (const l of learners) {
      const list = [...l.answers(card)].sort((a, b) => a.at - b.at);
      if (list.length === 0) continue;
      people += 1;
      answers += list.length;
      if (isRight(list[0]!)) firstRight += 1;
      for (const a of list) {
        if (isRight(a)) right += 1;
        if ((a.hints ?? 0) > 0) { hints += a.hints ?? 0; hinted += 1; }
        if (!isWrongAnswer(a)) continue;
        const text = words(card, a.given).trim();
        if (text === '' || text === '—') continue;
        const key = fold(text);
        const had = wrongs.get(key);
        if (had === undefined) wrongs.set(key, { text, count: 1, at: a.at });
        else wrongs.set(key, { text: had.text, count: had.count + 1, at: Math.max(had.at, a.at) });
      }
    }
    if (answers === 0) continue;
    const top = [...wrongs.values()].sort((a, b) => b.count - a.count || b.at - a.at)[0];
    out.push({
      card, learners: people, answers, right,
      success: right / answers,
      firstRight: firstRight / people,
      attempts: answers / people,
      hints, hinted,
      wrong: top === undefined ? null : { text: top.text, count: top.count }
    });
  }
  return out;
}

export type QuestionSort = 'success' | 'first' | 'attempts' | 'hints' | 'learners' | 'answers';

/**
 * Geordnet: nach Erfolg (das Schwächste zuerst — dort scheitert die Klasse), nach Versuchen, nach Podpowiedzi (das
 * Meiste zuerst) …; `dir` 1 die natürliche Richtung, -1 umgekehrt. Ohne Wert zuletzt.
 */
export function sortQuestions(stats: readonly QuestionClassStat[], by: QuestionSort, dir: 1 | -1 = 1): QuestionClassStat[] {
  const value = (s: QuestionClassStat): number | null => {
    switch (by) {
      case 'success': return s.success;
      case 'first': return s.firstRight;
      /* Mehr Versuche, mehr Podpowiedzi, mehr Leute: das Meiste zuerst. */
      case 'attempts': return s.attempts === null ? null : -s.attempts;
      case 'hints': return -s.hints;
      case 'learners': return -s.learners;
      case 'answers': return -s.answers;
    }
  };
  return [...stats].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return (x - y) * dir || (a.success ?? 2) - (b.success ?? 2);
  });
}

/* -- Ćwicz to ------------------------------------------------------------------------------------------------ */

/**
 * WAS EINE KACHEL ZUM ÜBEN GIBT: der Eintrag selbst (seine Karten aus Szablony) und jede Frage über ihn („O czym") —
 * dasselbe, was `source.list` [Eintrag] → `follow` „O czym" rückwärts mit `keep` wählte. Gelistet wird es hier, weil
 * die Schritte einer Powtórka von KARTEN ausgehen: eine Idee ohne eigene Karten liesse „Idź po odwołaniu" leer.
 */
export function practiseIds(cards: readonly Card[], entryId: string): string[] {
  return [...new Set([entryId, ...cardsAbout(cards, entryId).map((c) => c.entity ?? c.question)])];
}

/**
 * DIE POWTÓRKA EINER KACHEL: diese Einträge (`source.list`, aus `practiseIds`), nach dem, was man kann (`strategy`
 * temporal, das Allgemeine zuerst, streng die nächste). Sitzt alles schon, endet sie nicht von selbst (sonst gäbe es
 * nichts zu üben) — sonst, sobald alles gekonnt ist.
 */
export function practiseGraph(ids: readonly string[], endWhenDone = true, stackSize = 20): Graph {
  return {
    nodes: [
      { id: 'wpis', type: 'source.list', x: 40, y: 40, config: { ids: [...ids] } },
      { id: 'plan', type: 'strategy', x: 300, y: 40, config: { mode: 'temporal', stackSize, order: 'general', pick: 'next', ...(endWhenDone ? { endWhenDone: true } : {}) } }
    ],
    edges: [{ id: 'e1', from: 'wpis', out: 'cards', to: 'plan', in: 'cards' }]
  };
}
