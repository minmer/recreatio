/**
 * Der Browser-Teil von Kapitel 9 — Rollen, Bereiche, Nachrichten.
 *
 * Jede Form hier ist **verwiesen**, nicht abgeschrieben: `RcApi<'…'>` zeigt auf
 * den erzeugten Typ, und eine Umbenennung im Server wird zum Übersetzungsfehler
 * statt zu einem `undefined` in einem Browser (15.6).
 *
 * Was der Erzeuger NICHT weiß und deshalb hier steht: dass `body` fehlen kann,
 * weil der Schlüssel fehlt; dass `hasKey` und `readableEpochs` den Rand der
 * eigenen Sicht beschreiben; dass eine Nachricht ohne Urheber ein
 * zurückgenommener Beitrag ist und kein Fehler.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcRole = RcApi<'RolesRoleView'>;
export type RcArea = RcApi<'AreasAreaView'>;
export type RcMessage = RcApi<'MessagesMessageView'>;
export type RcMember = RcApi<'AreasMemberView'>;

export type RcRolesResponse = RcApi<'RcRolesResponse'>;
export type RcAreasResponse = RcApi<'RcAreasResponse'>;
export type RcFeed = RcApi<'RcFeedResponse'>;

// -- Rollen -------------------------------------------------------------------

export const rcRoles = () => rcFetch<RcRolesResponse>('/roles', { withUnlock: true });

export const RC_ROLE_KINDS = ['person', 'group', 'office', 'service'] as const;
export type RcRoleKind = (typeof RC_ROLE_KINDS)[number];

/**
 * 21.6 — Eine neue Rolle. `holderRoleId` ist die Rolle, die sie trägt: von dort
 * kommt der Schlüssel, unter dem der neue verschlossen wird.
 *
 * **Warum das der Weg ist, andere hineinzubitten.** Eine Einladung teilt eine
 * ROLLE, nicht einen Bereich. Wer seine persönliche Rolle verschickt, verschickt
 * damit alles, was daran hängt — jeden Bereich, jede Epoche, die ganze
 * Vergangenheit. Deshalb legt man eine Gruppenrolle an, nimmt DIESE in den
 * Bereich auf und lädt zu ihr ein. Dann bekommt der Neue genau das, was die
 * Gruppe hat, und nichts darüber hinaus.
 *
 * Zwei RSA-4096-Paare dauern Sekunden (21.6) — der Aufruf ist kein Versehen
 * wert und die Oberfläche sollte sagen, dass er dauert.
 */
export const rcCreateRole = (holderRoleId: string, kind: RcRoleKind, displayName: string) =>
  rcFetch<RcApi<'RcRoleCreatedResponse'>>('/roles', {
    body: { holderRoleId, kind, displayName },
    withUnlock: true
  });

// -- Bereiche -----------------------------------------------------------------

export const rcAreas = () => rcFetch<RcAreasResponse>('/areas', { withUnlock: true });

export const rcCreateArea = (ownerRoleId: string, title: string) =>
  rcFetch<RcApi<'RcAreaCreatedResponse'>>('/areas', {
    body: { ownerRoleId, title },
    withUnlock: true
  });

export const rcMembers = (areaId: string) =>
  rcFetch<RcApi<'RcMembersResponse'>>(`/areas/${areaId}/members`, { withUnlock: true });

// -- Nachrichten --------------------------------------------------------------

/**
 * Der Verlauf wird UNTER EINEM NAMEN geholt, wenn einer da ist.
 *
 * Stellungnahmen hängen an der Rolle, nicht am Konto. Ohne `roleId` liefert
 * der Server zwar die Auszählung, aber kein `yourReaction` — die eigene
 * Haltung wäre nach jedem Neuladen verschwunden, und der Knopf, der sie
 * festhält, wäre damit sinnlos.
 */
export const rcFeed = (areaId: string, limit = 50, roleId?: string) =>
  rcFetch<RcFeed>(
    `/areas/${areaId}/messages?limit=${limit}` + (roleId === undefined ? '' : `&roleId=${roleId}`),
    { withUnlock: true }
  );

/**
 * 7.8 — `chainBound` ist eine Entscheidung JE BEITRAG und steht deshalb im
 * Aufruf, nicht in einer Einstellung. Eine Kette, in der jedes „bis gleich"
 * steht, beweist am Ende nichts.
 */
export const rcPost = (areaId: string, authorRoleId: string, body: string, chainBound = false) =>
  rcFetch<RcApi<'RcMessagePostedResponse'>>(`/areas/${areaId}/messages`, {
    body: { authorRoleId, body, chainBound },
    withUnlock: true
  });

export const rcEdit = (messageId: string, body: string) =>
  rcFetch<RcApi<'RcMessageEditedResponse'>>(`/messages/${messageId}/edit`, {
    body: { body },
    withUnlock: true
  });

/** 9.17 — `byAuthor: true` nimmt Text UND Urheber. Das ist endgültig. */
export const rcHide = (messageId: string, byAuthor: boolean) =>
  rcFetch<RcApi<'RcMessageHiddenResponse'>>(`/messages/${messageId}/hide`, {
    body: { byAuthor },
    withUnlock: true
  });

// -- Lesestand ----------------------------------------------------------------

export const rcMarkRead = (areaId: string, roleId: string) =>
  rcFetch<RcApi<'RcReadMarkedResponse'>>(`/areas/${areaId}/read-state`, {
    body: { roleId },
    withUnlock: true
  });

// -- Entwürfe -----------------------------------------------------------------

export const rcSaveDraft = (areaId: string, roleId: string, body: string) =>
  rcFetch<RcApi<'RcDraftSavedResponse'>>(`/areas/${areaId}/draft`, {
    body: { roleId, body },
    withUnlock: true
  });

export const rcDraft = (areaId: string, roleId: string) =>
  rcFetch<RcApi<'RcDraftResponse'>>(`/areas/${areaId}/draft?roleId=${roleId}`, { withUnlock: true });

/**
 * 9.x — Die Epochengrenze sichtbar machen.
 *
 * Der Server liefert die Nachrichten in ihrer Reihenfolge und daneben, welche
 * Epochen der Leser öffnen kann. Wo sich die Epoche zwischen zwei Nachrichten
 * ändert, gehört ein Strich hin — sonst wirkt der Sprung von „unlesbar" zu
 * „lesbar" wie eine Störung statt wie das, was er ist: die Stelle, an der man
 * dazugekommen ist.
 */
export function rcEpochBreaks(messages: readonly RcMessage[]): ReadonlySet<string> {
  const breaks = new Set<string>();
  let previous: number | null = null;

  for (const message of messages) {
    if (previous !== null && message.epoch !== previous) breaks.add(message.messageId);
    previous = message.epoch;
  }
  return breaks;
}

/**
 * 15.9 — Was ist mit dieser Nachricht los?
 *
 * Die Entscheidung steht hier und nicht im JSX, weil sie die heikelste im
 * ganzen Chat ist: es gibt fuenf Zustaende, und vier davon zeigen KEINEN Text.
 * Wer sie im Markup trifft, kann sie nicht pruefen — und ein uebersehener
 * Zweig faellt dann als leerer Absatz durch, also als gar nichts. Genau das
 * verbietet 15.9: ein Loch ist schlimmer als ein unlesbarer Eintrag, weil der
 * Leser das Gespraech falsch versteht, ohne es zu merken.
 *
 * Die Reihenfolge ist Teil der Aussage. Ausblenden schlaegt Unlesbarkeit: eine
 * zurueckgenommene Nachricht hat gar keinen Geheimtext mehr, ueber den sich
 * etwas sagen liesse.
 */
export type RcMessageState =
  | { readonly kind: 'text' }
  /** 9.17 — Vom Urheber zurueckgenommen. Ein Grabstein, kein Fehler. */
  | { readonly kind: 'withdrawn' }
  /** Von der Moderation ausgeblendet. Der Text ist da, nur nicht fuer alle. */
  | { readonly kind: 'moderated' }
  /** Aus der Zeit vor dem eigenen Beitritt. Richtig so — niemand kann helfen. */
  | { readonly kind: 'sealed' }
  /** Der Schluessel war da und es ging trotzdem schief. Das ist ein Vorfall. */
  | { readonly kind: 'broken'; readonly reason: string };

export function rcMessageState(message: RcMessage): RcMessageState {
  if (message.hiddenKind === 'author') return { kind: 'withdrawn' };
  if (message.hiddenKind === 'moderation') return { kind: 'moderated' };

  if (message.unreadable === 'crypto.missing_epoch') return { kind: 'sealed' };

  // Jeder ANDERE Grund ist ein Vorfall und muss anders aussehen.
  if (message.unreadable !== null && message.unreadable !== undefined) {
    return { kind: 'broken', reason: message.unreadable };
  }

  // Kein Grund genannt und trotzdem kein Text: das darf der Server nicht
  // liefern. Es stumm als leeren Absatz zu zeigen waere das Loch aus 15.9 —
  // also wird daraus ein sichtbarer Vorfall.
  if (message.body === null || message.body === undefined) {
    return { kind: 'broken', reason: 'crypto.failed' };
  }

  return { kind: 'text' };
}
