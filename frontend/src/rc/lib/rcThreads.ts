/**
 * Kapitel 9, zweiter Teil — Themen, Umfragen, Anhänge, Reaktionen.
 *
 * Getrennt von `rcChat.ts`, weil es etwas anderes ist: der Chat ist der Strom,
 * das hier ist die Ordnung, die nachträglich hineingelegt wird. Ein Thema
 * entsteht, wenn jemand merkt, dass drei Beiträge zusammengehören — nicht
 * vorher, beim Anlegen eines Ordners, den dann niemand benutzt.
 */

import { rcFetch, rcRaw, type RcApi } from './rcApi';

export type RcTopic = RcApi<'TopicsTopicView'>;
export type RcPoll = RcApi<'PollsPollView'>;
export type RcAttachment = RcApi<'AttachmentsAttachmentView'>;

// -- Themen -------------------------------------------------------------------

export const rcTopics = (areaId: string) =>
  rcFetch<RcApi<'RcTopicsResponse'>>(`/areas/${areaId}/topics`, { withUnlock: true });

/**
 * 9.3 — Ein Thema kann gleich mit den Beiträgen entstehen, die es zusammenhält.
 * Das ist der Normalfall: man markiert, was zusammengehört, und benennt es
 * dann. Ein leeres Thema anzulegen und später zu füllen geht auch, ist aber
 * die Ausnahme und nicht der Weg, den die Oberfläche anbietet.
 */
export const rcCreateTopic = (areaId: string, title: string, messageIds?: readonly string[]) =>
  rcFetch<RcApi<'RcTopicCreatedResponse'>>(`/areas/${areaId}/topics`, {
    body: { title, messageIds: messageIds === undefined ? null : [...messageIds] },
    withUnlock: true
  });

export const rcAssignToTopic = (topicId: string, messageIds: readonly string[]) =>
  rcFetch<RcApi<'RcTopicAssignedResponse'>>(`/topics/${topicId}/messages`, {
    body: { messageIds: [...messageIds] },
    withUnlock: true
  });

/** `reopen` macht denselben Weg rückwärts — Schliessen ist keine Einbahnstrasse. */
export const rcCloseTopic = (topicId: string, reopen = false, duplicateOfId?: string) =>
  rcFetch<RcApi<'RcTopicClosedResponse'>>(`/topics/${topicId}/close`, {
    body: { reopen, duplicateOfId: duplicateOfId ?? null },
    withUnlock: true
  });

export const rcLabelTopic = (topicId: string, labels: readonly number[]) =>
  rcFetch<RcApi<'RcTopicLabelsResponse'>>(`/topics/${topicId}/labels`, {
    body: { labels: [...labels] },
    withUnlock: true
  });

// -- Umfragen -----------------------------------------------------------------

export const RC_POLL_MODES = ['single', 'multi', 'quiz'] as const;
export const RC_POLL_REVEALS = ['immediate', 'on_close'] as const;

export type RcPollMode = (typeof RC_POLL_MODES)[number];
export type RcPollReveal = (typeof RC_POLL_REVEALS)[number];

export const rcPolls = (areaId: string) =>
  rcFetch<RcApi<'RcPollsResponse'>>(`/areas/${areaId}/polls`, { withUnlock: true });

export const rcCreatePoll = (
  areaId: string,
  question: string,
  mode: RcPollMode = 'single',
  reveal: RcPollReveal = 'immediate'
) =>
  rcFetch<RcApi<'RcPollCreatedResponse'>>(`/areas/${areaId}/polls`, {
    body: { question, mode, reveal },
    withUnlock: true
  });

/**
 * Die Antwort ist freier Text, keine Auswahl aus einer Liste. Gleiche Antworten
 * werden zusammengezählt — wer „ja" und wer „Ja" schreibt, landet deshalb in
 * zwei Töpfen. Die Oberfläche schlägt darum vor, was schon geantwortet wurde.
 */
export const rcVote = (pollId: string, roleId: string, choice: string) =>
  rcFetch<RcApi<'RcPollVotedResponse'>>(`/polls/${pollId}/vote`, {
    body: { roleId, choice },
    withUnlock: true
  });

export const rcClosePoll = (pollId: string) =>
  rcFetch<RcApi<'RcPollClosedResponse'>>(`/polls/${pollId}/close`, {
    method: 'POST',
    withUnlock: true
  });

/**
 * Warum die Auszählung fehlt — und ob das in Ordnung ist.
 *
 * Bei `on_close` liefert der Server vor dem Schliessen KEINE Zahlen, auch nicht
 * an den, der die Umfrage angelegt hat. Das ist der Sinn der Einstellung: wer
 * als Zehnter abstimmt, soll nicht neun Stimmen sehen und sich anschliessen.
 *
 * Die Oberfläche muss das als Zusage darstellen, nicht als Lücke. „Noch keine
 * Stimmen" wäre gelogen — es sind welche da, sie werden nur niemandem gezeigt.
 */
export function rcTallyHidden(poll: RcPoll): boolean {
  return poll.reveal === 'on_close' && !poll.closed;
}

/** Die Antworten, absteigend nach Häufigkeit. Leer, solange nichts gezeigt wird. */
export function rcTallyRows(poll: RcPoll): readonly (readonly [string, number])[] {
  if (poll.tally === null || poll.tally === undefined) return [];
  return Object.entries(poll.tally).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// -- Anhänge ------------------------------------------------------------------

export const rcAttachments = (messageId: string) =>
  rcFetch<RcApi<'RcAttachmentsResponse'>>(`/messages/${messageId}/attachments`, { withUnlock: true });

/**
 * 9.10 — Hochgeladen wird als `multipart/form-data`; verschlüsselt wird auf dem
 * Server, mit dem Epochenschlüssel des Bereichs. Auf der Platte liegt nur
 * Geheimtext, und der Dateiname liegt dort ebenfalls versiegelt.
 */
export function rcUpload(messageId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return rcFetch<RcApi<'RcAttachmentUploadedResponse'>>(`/messages/${messageId}/attachments`, {
    body: form,
    withUnlock: true
  });
}

export const rcDeleteAttachment = (attachmentId: string) =>
  rcFetch<RcApi<'RcAttachmentDeletedResponse'>>(`/attachments/${attachmentId}/delete`, {
    method: 'POST',
    withUnlock: true
  });

/**
 * Der Inhalt kommt entschlüsselt, aber als Bytes — nicht als JSON. Er wird
 * deshalb über `rcRaw` geholt und zu einer Blob-Adresse gemacht, die der
 * Browser wie eine Datei behandelt.
 *
 * Der Aufrufer MUSS `URL.revokeObjectURL` rufen, wenn er fertig ist. Sonst
 * bleibt der entschlüsselte Inhalt im Speicher des Tabs liegen — bei einer
 * Plattform, deren ganzer Zweck es ist, Klartext knapp zu halten, ist das
 * kein Schönheitsfehler.
 */
export async function rcAttachmentUrl(attachmentId: string): Promise<string> {
  const response = await rcRaw(`/attachments/${attachmentId}/content`, { withUnlock: true });
  return URL.createObjectURL(await response.blob());
}

// -- Reaktionen ---------------------------------------------------------------

/**
 * 9.8 — Eine Reaktion je Person und Beitrag. `kind: null` nimmt sie zurück.
 *
 * Es sind DREI, und sie haben Bedeutungen: Zustimmung, Kenntnisnahme,
 * Widerspruch. Das ist kein Bildchen-Regal, sondern eine Stellungnahme — wer
 * zwölf Zeichen unter einen Beitrag hängen kann, sagt am Ende nichts; wer
 * genau eine Haltung wählen muss, sagt etwas.
 *
 * „Ich habe es gelesen" und „ich stimme zu" sind nicht dasselbe, und in einer
 * Sitzung ist genau dieser Unterschied der ganze Punkt. Die Oberfläche muss
 * die drei deshalb benennen und darf sie nicht als Symbole ohne Beschriftung
 * zeigen: ein Häkchen kann beides heissen.
 */
export const RC_REACTION_AGREE = 1;
export const RC_REACTION_NOTED = 2;
export const RC_REACTION_OBJECT = 3;

export const RC_REACTIONS = [RC_REACTION_AGREE, RC_REACTION_NOTED, RC_REACTION_OBJECT] as const;
export type RcReaction = (typeof RC_REACTIONS)[number];

export const rcReact = (messageId: string, roleId: string, kind: RcReaction | null) =>
  rcFetch<RcApi<'RcReactionResponse'>>(`/messages/${messageId}/reaction`, {
    body: { roleId, kind },
    withUnlock: true
  });
