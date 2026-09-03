/**
 * Rocznik firmowy od strony parafii — zakładanie i otwieranie zgłoszeń.
 *
 * Wszystko po jednym wywołaniu. Obszar, grupa, rola urzędu i klucz przyjmowania
 * powstają na serwerze w JEDNEJ transakcji — sklejanie tego z czterech wywołań
 * z przeglądarki zostawiało śmieci, gdy któreś padło w środku.
 */

import { rcFetch } from '../lib/rcApi';
import type { RcApi } from '../lib/rcApi';

export type RcConfirmationSetUp = RcApi<'RcConfirmationSetUpResponse'>;

/** Co jest już założone dla tej parafii — albo same `null`. */
export const rcReadConfirmation = (parishId: string) =>
  rcFetch<RcConfirmationSetUp>(`/parishes/${parishId}/confirmation`, { withUnlock: true });

/**
 * Założyć rocznik. Kto zakłada, ten najpierw prowadzi.
 *
 * Powtórzenie nie jest błędem — to życzenie już spełnione, więc wraca to, co
 * jest.
 */
export const rcConfirmationSetUp = (parishId: string, personRoleId: string, name?: string) =>
  rcFetch<RcConfirmationSetUp>(`/parishes/${parishId}/confirmation`, {
    body: { personRoleId, name: name ?? null },
    withUnlock: true
  });

/**
 * Otworzyć albo zamknąć przyjmowanie zgłoszeń.
 *
 * `personRoleId` jest potrzebne tylko przy PIERWSZYM otwarciu, jeśli klucz
 * jeszcze nie istnieje — wtedy powstaje pod tą rolą. Przy zakładaniu przez
 * `rcConfirmationSetUp` klucz już jest, więc zwykle nie ma to znaczenia.
 */
export const rcOpenApplications = (groupId: string, open: boolean, personRoleId: string | null) =>
  rcFetch<RcApi<'RcApplicationsOpenResponse'>>(`/confirmation-groups/${groupId}/applications`, {
    body: { open, leaderRoleId: personRoleId },
    withUnlock: true
  });

// -- Lista kandydatów --------------------------------------------------------

export type RcAdminCandidate = RcApi<'ConfirmationCandidateView'>;

/**
 * Kandydaci rocznika.
 *
 * Zgłoszenia z zewnątrz otwiera klucz roli prowadzącego; wpisy od środka —
 * klucz epoki. Serwer robi jedno i drugie w tym samym przebiegu. Kto nie
 * trzyma roli, dostaje kandydatów z `unreadable` — widzi, że są.
 */
export const rcCandidatesOf = (groupId: string) =>
  rcFetch<RcApi<'RcCandidatesResponse'>>(
    `/confirmation-groups/${groupId}/candidates`, { withUnlock: true });

/**
 * Linki do portali — tylko dla trzymającego rolę.
 *
 * Pusta lista znaczy: to konto roli nie trzyma. Nie mówi, ilu jest kandydatów.
 */
export const rcCandidateLinks = (groupId: string) =>
  rcFetch<RcApi<'RcCandidateLinksResponse'>>(
    `/confirmation-groups/${groupId}/links`, { withUnlock: true });

/**
 * Odhaczyć, czego brakowało.
 *
 * Czego nie wyślesz, zostaje jak było — dwa haczyki w jednym formularzu, z
 * których jeden kasuje się przypadkiem, bo drugie pole było puste, to błąd,
 * którego nikt nie zauważa.
 */
export const rcSetProgress = (
  candidateId: string,
  what: { paperReceived?: boolean; quizPassed?: boolean }
) =>
  rcFetch<RcApi<'RcCandidateProgressResponse'>>(`/candidates/${candidateId}/progress`, {
    body: {
      paperReceived: what.paperReceived ?? null,
      quizPassed: what.quizPassed ?? null
    },
    withUnlock: true
  });
