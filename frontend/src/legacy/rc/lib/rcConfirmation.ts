/**
 * Firmung im Browser — Jahrgang, Kandidaten, Treffen.
 *
 * **Der empfindlichste Teil der Plattform.** Kandidaten sind Minderjährige;
 * alles Personenbezogene kommt versiegelt und geht nur mit dem Schlüssel auf.
 *
 * Was im Klartext kommt, sind die **Ablaufmerker** — Einwilligung da, Papier
 * da, Quiz bestanden — und die **Zeiten und Plätze** der Treffen. Beides sagt
 * nichts über die Person, sondern über den Vorgang; ohne sie liesse sich nicht
 * einmal zählen, wer noch etwas abgeben muss, ohne jeden Datensatz zu
 * entschlüsseln.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcConfirmationGroup = RcApi<'ConfirmationGroupSummary'>;
export type RcCandidate = RcApi<'ConfirmationCandidateView'>;
export type RcCandidateNote = RcApi<'ConfirmationNoteView'>;
export type RcMeetingSlot = RcApi<'ConfirmationSlotView'>;

// -- Jahrgang -----------------------------------------------------------------

export const rcConfirmationGroups = () =>
  rcFetch<RcApi<'RcConfirmationGroupsResponse'>>('/confirmation-groups', { withUnlock: true });

/**
 * Ein Jahrgang bekommt einen EIGENEN Bereich, nicht den der Pfarrei.
 *
 * Wer den Messplan pflegt, hat damit nicht auch Zugriff auf die Akten der
 * Kinder. Der Dienst verlangt deshalb Verwaltungsrecht in BEIDEN — sonst wäre
 * der eigene Bereich für die Akten ein Vorschlag und keine Grenze.
 */
export const rcCreateConfirmationGroup = (
  parishId: string, areaId: string, name: string,
  options: { startsOn?: string; endsOn?: string } = {}
) =>
  rcFetch<RcApi<'RcConfirmationGroupCreatedResponse'>>('/confirmation-groups', {
    body: {
      parishId, areaId, name,
      startsOn: options.startsOn ?? null,
      endsOn: options.endsOn ?? null
    },
    withUnlock: true
  });

// -- Kandidaten ---------------------------------------------------------------

export const rcCandidates = (groupId: string) =>
  rcFetch<RcApi<'RcCandidatesResponse'>>(`/confirmation-groups/${groupId}/candidates`,
    { withUnlock: true });

export const rcAddCandidate = (
  groupId: string, name: string,
  options: { born?: string; contact?: string; school?: string; baptism?: string; consentTextId?: string } = {}
) =>
  rcFetch<RcApi<'RcCandidateCreatedResponse'>>(`/confirmation-groups/${groupId}/candidates`, {
    body: {
      name,
      born: options.born ?? null,
      contact: options.contact ?? null,
      school: options.school ?? null,
      baptism: options.baptism ?? null,
      consentTextId: options.consentTextId ?? null
    },
    withUnlock: true
  });

/**
 * Eine Notiz. `forFamily` heisst NICHT „unverschlüsselt" — beide liegen
 * versiegelt. Es heisst: auch für die Familie sichtbar.
 *
 * Anders als beim Messplan, wo öffentlich wirklich am Schaukasten hängt. Bei
 * einem Kind gibt es kein „öffentlich" in diesem Sinn, nur einen engeren und
 * einen weiteren Kreis.
 */
export const rcAddCandidateNote = (
  candidateId: string, authorRoleId: string, text: string, forFamily = false
) =>
  rcFetch<RcApi<'RcCandidateNoteAddedResponse'>>(`/candidates/${candidateId}/notes`, {
    body: { authorRoleId, text, forFamily },
    withUnlock: true
  });

/**
 * 12.3 — Austritt vernichtet die Felder und lässt die Zeile stehen.
 *
 * „Waren es nun vierzig oder einundvierzig" ist genau die Frage, die eine
 * Kandidatenliste beantworten soll. Die Zeile bleibt, damit sie beantwortbar
 * bleibt; was drinstand, ist weg.
 */
export const rcWithdrawCandidate = (candidateId: string) =>
  rcFetch<RcApi<'RcCandidateWithdrawnResponse'>>(`/candidates/${candidateId}/withdraw`,
    { method: 'POST', withUnlock: true });

// -- Treffen ------------------------------------------------------------------

export const rcMeetingSlots = (groupId: string) =>
  rcFetch<RcApi<'RcMeetingSlotsResponse'>>(`/confirmation-groups/${groupId}/slots`,
    { withUnlock: true });

export const rcAddMeetingSlot = (
  groupId: string, startsUtc: string,
  options: { durationMinutes?: number; capacity?: number; label?: string; stage?: string } = {}
) =>
  rcFetch<RcApi<'RcMeetingSlotCreatedResponse'>>(`/confirmation-groups/${groupId}/slots`, {
    body: {
      startsUtc,
      durationMinutes: options.durationMinutes ?? 60,
      capacity: options.capacity ?? 1,
      label: options.label ?? null,
      stage: options.stage ?? null
    },
    withUnlock: true
  });

export const rcBookSlot = (slotId: string, candidateId: string) =>
  rcFetch<RcApi<'RcMeetingBookedResponse'>>(`/meeting-slots/${slotId}/book`, {
    body: { candidateId },
    withUnlock: true
  });

// -- Was die Oberfläche wissen muss ------------------------------------------

/** Freie Plätze. Negativ kann es nicht werden — der Dienst lässt es nicht zu. */
export function rcFreeSeats(slot: RcMeetingSlot): number {
  return Math.max(0, slot.capacity - slot.booked);
}

export function rcSlotFull(slot: RcMeetingSlot): boolean {
  return rcFreeSeats(slot) === 0;
}

/**
 * Was diesem Kandidaten noch fehlt.
 *
 * Aus den Klartext-Merkern gerechnet, ohne irgendetwas zu entschlüsseln — das
 * ist der Grund, warum sie im Klartext liegen. Eine Liste „wer muss noch was
 * abgeben" ist die häufigste Frage eines Katecheten, und sie darf nicht
 * verlangen, dass er jeden Datensatz öffnet.
 */
export function rcMissingSteps(candidate: RcCandidate): readonly ('consent' | 'paper' | 'quiz')[] {
  const missing: ('consent' | 'paper' | 'quiz')[] = [];
  if (!candidate.consentGiven) missing.push('consent');
  if (!candidate.paperReceived) missing.push('paper');
  if (!candidate.quizPassed) missing.push('quiz');
  return missing;
}

/**
 * Wie ein Kandidat in der Liste heisst.
 *
 * 15.9 — Wer nicht zu öffnen ist, fällt NICHT aus der Liste. Dass jemand da
 * ist, den man nicht lesen kann, ist eine Auskunft; ein Loch ist keine, und
 * die Zahlen des Jahrgangs stimmten dann nicht mehr.
 */
export function rcCandidateLabel(candidate: RcCandidate, sealedText: string): string {
  if (candidate.unreadable !== null && candidate.unreadable !== undefined) return sealedText;
  if (candidate.name !== null && candidate.name !== undefined && candidate.name.length > 0) {
    return candidate.name;
  }
  return candidate.candidateId.slice(0, 8);
}

/** Wie viele im Jahrgang noch etwas offen haben. Ohne Entschlüsselung zählbar. */
export function rcOutstanding(candidates: readonly RcCandidate[]): number {
  return candidates
    .filter((c) => c.status === 'enrolled')
    .filter((c) => rcMissingSteps(c).length > 0)
    .length;
}
