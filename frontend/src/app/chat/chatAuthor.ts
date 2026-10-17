/**
 * WER IN EINER ROZMOWA SPRICHT (0095) — immer eine PERSON, mit Vor- und
 * Nachnamen; kommt sie über eine Rolle herein, die keine Person ist, steht die
 * Rolle in Klammern dahinter:
 *
 * <code>
 *   Anna Nowak                  schreibt als sie selbst (ihre Person ist im Bereich)
 *   Anna Nowak (Rada)           schreibt über die Rolle „Rada", die sie hält
 *   Jan Kowalski (Rodzice)      eine Person aus dem Link „Rodzice" (ohne Konto)
 * </code>
 *
 * <b>Wer sprechen kann</b> (`speakersOf`): jede Rolle, die hier schreibt und
 * für die dieser Browser unterschreiben kann — und zu jeder die eigenen
 * Personen, die sie halten (über `holds`). Gibt es mehr als eine Möglichkeit,
 * wählt man zuerst die Rolle, dann die Person.
 *
 * Rechnet nur; gezeichnet wird in `SpeakerPick.tsx`, gesendet in `chat.ts`.
 */

import type { Opened, SealedMessage } from './chat';

export interface GraphLike {
  readonly roles: readonly { readonly id: string; readonly kind: string }[];
  readonly edges: readonly {
    readonly fromRoleId: string;
    readonly toRoleId: string;
    readonly edgeKind: string;
    readonly expiresAt?: string | null;
  }[];
}

/** Eine Rolle, durch die eine Person spricht (bei einer Person: zweimal dieselbe). */
export interface Speaker {
  readonly roleId: string;
  readonly personId: string;
}

export const speakerKey = (one: Speaker): string => `${one.roleId}|${one.personId}`;

/** Spricht die Person durch eine ANDERE Rolle — dann steht die Rolle in Klammern. */
export const throughRole = (one: Speaker): boolean => one.roleId !== one.personId;

/** Was eine Rolle über `holds` hält, sie selbst eingeschlossen — nur lebende Kanten. */
function heldFrom(graph: GraphLike, start: string, now: number): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.fromRoleId !== at || edge.edgeKind !== 'holds' || seen.has(edge.toRoleId)) continue;
      if (edge.expiresAt != null && Date.parse(edge.expiresAt) <= now) continue;
      seen.add(edge.toRoleId);
      queue.push(edge.toRoleId);
    }
  }
  return seen;
}

/** Die eigenen Personen, die durch <code>roleId</code> sprechen können — bei einer Person: sie selbst. */
export function personsHolding(graph: GraphLike, roleId: string, now: number = Date.now()): string[] {
  const role = graph.roles.find((one) => one.id === roleId);
  if (role?.kind === 'person') return [roleId];
  return graph.roles
    .filter((one) => one.kind === 'person' && heldFrom(graph, one.id, now).has(roleId))
    .map((one) => one.id);
}

/**
 * ALLE MÖGLICHKEITEN ZU SPRECHEN — je Rolle, die hier schreibt und für die
 * unterschrieben werden kann, jede Person, die sie hält. Wer als er selbst
 * schreiben kann, steht vorn; sonst in der Reihenfolge der Rollen.
 */
export function speakersOf(writers: readonly string[], graph: GraphLike, maySign: (roleId: string) => boolean, now: number = Date.now()): Speaker[] {
  const out: Speaker[] = [];
  for (const roleId of writers) {
    if (!maySign(roleId)) continue;
    for (const personId of personsHolding(graph, roleId, now)) {
      if (!out.some((one) => one.roleId === roleId && one.personId === personId)) out.push({ roleId, personId });
    }
  }
  return out
    .map((one, at) => ({ one, at }))
    .sort((a, b) => Number(throughRole(a.one)) - Number(throughRole(b.one)) || a.at - b.at)
    .map(({ one }) => one);
}

/**
 * WER SPRICHT, wenn nichts weiter gesagt ist: die gemerkte Wahl (`rola|osoba`;
 * eine alte, nur die Rolle, nimmt ihre erste Person), sonst die oben auf der
 * Seite gewählte Person (am liebsten als sie selbst), sonst die erste.
 */
export function chooseSpeaker(list: readonly Speaker[], remembered: string | null | undefined, preferPerson?: string | null): Speaker | null {
  if (list.length === 0) return null;
  const said = remembered ?? '';
  return list.find((one) => speakerKey(one) === said)
    ?? (said !== '' && !said.includes('|') ? list.find((one) => one.roleId === said) : undefined)
    ?? (preferPerson != null ? list.find((one) => one.personId === preferPerson && !throughRole(one)) ?? list.find((one) => one.personId === preferPerson) : undefined)
    ?? list[0];
}

/** Ist die Nachricht meine — die Rolle UND die Person, die durch sie sprach. */
export const isMine = (message: SealedMessage, holds: (roleId: string) => boolean): boolean =>
  message.authorRoleId !== null && holds(message.authorRoleId)
  && (message.authorPersonId == null || holds(message.authorPersonId));

/* -- Wie ein Verfasser heisst ------------------------------------------------------------- */

export interface AuthorLook {
  /** Der Name, unter dem eine Rolle oder Person hier bekannt ist (Namen des Bereichs, eigene). */
  readonly name: (id: string) => string | null | undefined;
  /** Ein Platz (Mensch mit Link): sein Name und, bei einer Person aus einem Link, dessen Name. */
  readonly seat?: (seatId: string) => { readonly name: string | null; readonly via?: string | null } | undefined;
}

export interface Author {
  readonly name: string;
  /** Die Rolle in Klammern — oder `null`, wenn die Person als sie selbst spricht. */
  readonly via: string | null;
}

/**
 * DER VERFASSER EINER NACHRICHT. Eine Person: ihr Name (wie der Bereich sie
 * kennt, sonst wie sie sich in der Nachricht nennt). Durch eine Rolle: die
 * Person und die Rolle. Eine ältere Nachricht ohne Person: die Rolle, wie bisher.
 */
export function messageAuthor(message: SealedMessage, opened: Opened | null, look: AuthorLook): Author {
  if (message.authorSeatId !== null) {
    const seat = look.seat?.(message.authorSeatId);
    return { name: opened?.name ?? seat?.name ?? 'osoba z linkiem', via: opened?.via ?? seat?.via ?? null };
  }

  const role = message.authorRoleId ?? '';
  const person = message.authorPersonId ?? null;

  if (person !== null && person !== role) {
    return { name: look.name(person) ?? opened?.name ?? 'osoba', via: look.name(role) ?? opened?.via ?? 'rola' };
  }

  return { name: look.name(role) ?? opened?.name ?? 'ktoś', via: null };
}

export const authorText = (author: Author): string => (author.via === null ? author.name : `${author.name} (${author.via})`);

/** Wie ein Sprecher heisst — in der Wahl und im Feld („Wiadomość jako …"). */
export function speakerText(one: Speaker, name: (id: string) => string | null | undefined): string {
  const person = name(one.personId) ?? 'osoba';
  return throughRole(one) ? `${person} (${name(one.roleId) ?? 'rola'})` : person;
}
