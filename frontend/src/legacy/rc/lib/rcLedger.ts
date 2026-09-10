/**
 * Kapitel 7 im Browser — das Protokoll, und wie man es nachrechnet.
 *
 * Der wichtigste Teil ist `rcRecompute`. Der Dienst hat einen eigenen
 * Prüfweg (`/ledgers/{id}/verify`), und der ist ausdrücklich NICHT das, worauf
 * man sich verlassen soll: er ist die Aussage desselben, der die Daten hält.
 * „Ich habe nachgesehen, es stimmt alles" ist keine Prüfung, sondern eine
 * Behauptung — und der Betreiber ist genau derjenige, gegen den ein Protokoll
 * schützen soll.
 *
 * Deshalb rechnet der Browser die Kette selbst nach, aus den Einträgen, aus
 * den Feldern, die er sieht. Stimmen beide überein, ist das eine Auskunft.
 * Weichen sie ab, ist die interessante Antwort die des Browsers.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcLedgerEntry = RcApi<'LedgerEndpointsEntryView'>;
export type RcLedgerVerdict = RcApi<'LedgerEndpointsVerifyResponse'>;
export type RcLedgerHead = RcApi<'RcLedgerHeadResponse'>;

export const rcLedgerEntries = (ledgerId: string, from = 0, limit = 100) =>
  rcFetch<RcApi<'RcLedgerEntriesResponse'>>(
    `/ledgers/${ledgerId}/entries?from=${from}&limit=${limit}`, { withUnlock: true });

export const rcLedgerHead = (ledgerId: string) =>
  rcFetch<RcLedgerHead>(`/ledgers/${ledgerId}/head`, { withUnlock: true });

/** Was der Dienst über seine eigene Kette sagt. Eine Auskunft, kein Beweis. */
export const rcLedgerVerdict = (ledgerId: string) =>
  rcFetch<RcLedgerVerdict>(`/ledgers/${ledgerId}/verify`, { withUnlock: true });

// -- Selbst nachrechnen -------------------------------------------------------

export interface RcChainCheck {
  /** Hält die Kette der eigenen Nachrechnung stand? */
  readonly intact: boolean;
  /** Die erste Stelle, an der es klemmt. */
  readonly firstBrokenSequence: number | null;
  readonly reason: string | null;
  readonly checked: number;
}

/**
 * Die Verkettung nachrechnen: jeder Eintrag nennt den Hash des vorigen, und
 * die Nummern müssen lückenlos aufsteigen.
 *
 * Was das findet: eine herausgeschnittene Zeile (die Nummern springen), eine
 * umsortierte (der Vorgänger-Hash passt nicht mehr), eine nachträglich
 * eingefügte (dieselbe Stelle bricht). Was es NICHT findet: ob der Inhalt
 * eines einzelnen Eintrags zu seinem eigenen Hash passt — dazu müsste der
 * Browser die kanonische Form byteweise nachbauen, und die kommt hier bereits
 * fertig vom Dienst. Diese Grenze wird in der Oberfläche benannt und nicht
 * verschwiegen; eine Prüfung, die mehr zu können vorgibt, als sie kann, ist
 * schlimmer als keine.
 */
export function rcRecompute(entries: readonly RcLedgerEntry[]): RcChainCheck {
  if (entries.length === 0) {
    return { intact: true, firstBrokenSequence: null, reason: null, checked: 0 };
  }

  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];

    if (current.sequence !== previous.sequence + 1) {
      return {
        intact: false,
        firstBrokenSequence: current.sequence,
        reason: 'chain.gap',
        checked: i + 1
      };
    }

    if (current.previousHash !== previous.entryHash) {
      return {
        intact: false,
        firstBrokenSequence: current.sequence,
        reason: 'chain.broken_link',
        checked: i + 1
      };
    }
  }

  return { intact: true, firstBrokenSequence: null, reason: null, checked: ordered.length };
}

/**
 * Stimmen die beiden Antworten überein?
 *
 * Ein `false` hier ist der eigentliche Fund und nicht ein Nebenergebnis: es
 * heisst, dass der Dienst etwas anderes über seine Kette behauptet, als aus
 * den Einträgen folgt, die er selbst herausgegeben hat.
 */
export function rcAgrees(mine: RcChainCheck, theirs: RcLedgerVerdict): boolean {
  return mine.intact === theirs.intact
    && (mine.firstBrokenSequence ?? null) === (theirs.firstBrokenSequence ?? null);
}

// -- Kapitel 11: Entscheidungen ----------------------------------------------

export type RcDecision = RcApi<'DecisionsDecisionView'>;
export type RcTransition = RcApi<'DecisionsTransitionView'>;

export const rcDecisions = (areaId: string) =>
  rcFetch<RcApi<'RcDecisionsResponse'>>(`/areas/${areaId}/decisions`, { withUnlock: true });

/**
 * Auch ein Beschluss wird unter einem NAMEN gefasst (3.3), nicht vom Konto.
 *
 * Die Rolle fehlte hier zuerst, und der Dienst hätte jeden Aufruf mit 400
 * abgewiesen. Aufgefallen ist es nicht beim Übersetzen — die Form war ja
 * gültig — sondern erst, als eine Prüfung denselben Aufruf machte.
 */
export const rcCreateDecision = (areaId: string, roleId: string, body: string, topicId?: string) =>
  rcFetch<RcApi<'RcDecisionCreatedResponse'>>(`/areas/${areaId}/decisions`, {
    body: { roleId, body, topicId: topicId ?? null },
    withUnlock: true
  });

/**
 * Ein Übergang braucht IMMER einen Grund. Der Dienst besteht darauf, und die
 * Oberfläche verlangt ihn deshalb vorne — nicht als Pflichtfeld, das man mit
 * einem Punkt füllt, sondern als die eigentliche Sache: eine Entscheidung ohne
 * Begründung ist in einem Jahr nicht mehr nachvollziehbar, und dann steht da
 * ein Beschluss, den niemand mehr erklären kann.
 */
export const rcTransition = (decisionId: string, roleId: string, toState: string, reason: string) =>
  rcFetch<RcApi<'RcDecisionTransitionedResponse'>>(`/decisions/${decisionId}/transition`, {
    body: { roleId, toState, reason },
    withUnlock: true
  });
