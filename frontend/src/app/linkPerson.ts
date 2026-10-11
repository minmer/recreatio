/**
 * DIE PERSON EINES LINKS (0095) — wer mit einem Link mit Zugang ohne Konto da
 * ist, stellt sich vor (Imię, Nazwisko) und spricht dann als er selbst.
 *
 * <b>Aus dem Link wird ein Platz</b> (wie ein Mensch aus einem Formular): ein
 * eigenes Geheimnis in diesem Browser (`seatKeep`), ein eigener Schlüssel, eine
 * eigene Unterschrift in der Rozmowa — und der Platz hält die Linkrolle, also
 * gehört er zu den Menschen der Bereiche, die der Link öffnet. In der Rozmowa
 * steht er als „Jan Kowalski (Rodzice)": die Person, und der Link in Klammern.
 *
 * <code>
 *   Platzschlüssel ──► unter dem Link des Platzes      (dieser Browser)
 *                  ──► unter dem Schlüssel des Bereichs (die Kanzlei)
 *   Linkrolle      ──► unter dem Platzschlüssel         (der Platz liest, was der Link liest)
 * </code>
 *
 * <b>Hat dieser Browser schon eine Person, die dorthin kommt</b> — aus dem
 * Formular, zu dem der Link führt, oder eben vorgestellt —, wird sie genommen
 * und keine zweite angelegt (`personFor`).
 */

import { KEY_SIZE, seal, sha256, toBase64Url } from './crypto';
import { newId } from './ids';
import { heldLinkKeys, heldProofs, linkSecrets } from './linkAccess';
import { heldLinks } from './linkKeep';
import { seatRoleAad } from './memberRole';
import { openSeatName, personName, sealName, seatNameAad, seatOwnNameAad } from './names';
import { newLink, seatAad } from './seat';
import { loadSeatChats } from './seatChat';
import { sealLink } from './seatCheck';
import { announceSeats, heldSeats, keyTextOf, remember } from './seatKeep';
import { call, WorkspaceError } from './session';
import type { ChatSeat, SealedMessage, SealedName } from './chat';

/** Eine Rozmowa, die ein Link dieses Browsers öffnet — und über welchen. */
export interface LinkChat {
  readonly chatId: string;
  readonly kind: 'area' | 'channel' | 'group';
  readonly areaId: string;
  readonly areaName: string;
  readonly currentEpoch: number;
  readonly invitationId: string;
  readonly linkRoleId: string;
  /** Wie der Link heisst — in der Rozmowa steht er in Klammern hinter der Person. */
  readonly label: string;
  /** Vorgestellt (eine Person des Links) schreibt man hier mit; sonst liest man nur (Kanał, Gruppe). */
  readonly joinable: boolean;
}

/** Die Rozmowy der Links in diesem Browser — ohne Konto, mit ihren Beweisen. */
export async function linkChats(): Promise<readonly LinkChat[]> {
  if (heldLinks().length === 0) return [];
  const proofs = await heldProofs();
  if (proofs.length === 0) return [];
  const { chats } = await call<{ chats: readonly LinkChat[] }>('/links/chats', {
    method: 'POST', credentials: 'omit', body: JSON.stringify({ proofs })
  });
  return chats;
}

/* -- Lesen ohne Person ------------------------------------------------------------------------- */

/** Eine Rozmowa zum Lesen über einen Link — mit den versiegelten Namen und den Menschen mit Link. */
export interface LinkChatDetail extends LinkChat {
  readonly names: readonly SealedName[];
  readonly seats: readonly ChatSeat[];
}

/**
 * LESEN BRAUCHT KEINE PERSON: wer über einen Link den Bereich liest, liest
 * seine Rozmowa — `null`, wenn kein Link dieses Browsers sie öffnet.
 */
export async function loadLinkChat(chatId: string): Promise<LinkChatDetail | null> {
  if (heldLinks().length === 0) return null;
  const proofs = await heldProofs();
  if (proofs.length === 0) return null;
  try {
    const chat = await call<LinkChatDetail>(`/links/chat/${encodeURIComponent(chatId)}`, {
      method: 'POST', credentials: 'omit', body: JSON.stringify({ proofs })
    });
    /* 0097 — die Namen der Menschen liegen unter dem Schlüssel ihres Bereichs; der Link öffnet ihn. */
    return { ...chat, seats: await Promise.all(chat.seats.map(async (seat) => ({ ...seat, name: await openSeatName(seat) }))) };
  } catch {
    return null;
  }
}

/** Die Nachrichten zum Lesen — Seiten wie im Arbeitsplatz (davor, danach, geändert). */
export async function loadLinkMessages(
  chatId: string, page: { before?: string; beforeId?: string; after?: string; afterId?: string; changed?: string } = {}
): Promise<{ messages: readonly SealedMessage[]; asOf?: string }> {
  const proofs = await heldProofs();
  return call(`/links/chat/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST', credentials: 'omit', body: JSON.stringify({ proofs, ...page })
  });
}

/** Ein Platz dieses Browsers, der in eine Rozmowa kommt — sein Token und der Schlüssel seines Links. */
export interface HeldPerson {
  readonly token: string;
  readonly keyText: string;
}

/**
 * WER AUS DIESEM BROWSER SCHON IN DIESE ROZMOWA KOMMT — ein Platz aus einem
 * Formular oder eine vorgestellte Person. `null`: noch niemand; dann stellt
 * man sich vor.
 */
export async function personFor(chatId: string): Promise<HeldPerson | null> {
  for (const token of heldSeats()) {
    const keyText = keyTextOf(token);
    if (keyText === null) continue;
    try {
      const { chats } = await loadSeatChats(token);
      if (chats.some((one) => one.chatId === chatId)) return { token, keyText };
    } catch {
      // Ein Platz, der nicht mehr gilt, kommt nirgends hin.
    }
  }
  return null;
}

/**
 * SICH VORSTELLEN — aus dem Link, über den diese Rozmowa offen ist, eine Person
 * machen: Vor- und Nachname, ein Platz an diesem Link. Danach hält dieser
 * Browser den Platz (`seatKeep`), und die Seite findet ihn.
 */
export async function createLinkPerson(
  chat: Pick<LinkChat, 'areaId' | 'invitationId' | 'linkRoleId'>, givenName: string, surname: string, under: string | null
): Promise<HeldPerson & { readonly seatId: string; readonly name: string; readonly via: string }> {
  const name = personName(givenName, surname);
  if (name === null) throw new WorkspaceError('Podaj imię i nazwisko.');

  const keys = await heldLinkKeys();
  const link = keys.links.find((one) => one.info?.invitationId === chat.invitationId);
  if (link === undefined) throw new WorkspaceError('Ten link już nie działa w tej przeglądarce.');

  const epochs = keys.areaKeys.get(chat.areaId);
  if (epochs === undefined || epochs.size === 0) throw new WorkspaceError('Ten link nie otwiera kluczy tego obszaru.');
  const epoch = Math.max(...epochs.keys());
  const areaKey = epochs.get(epoch)!;

  /* Die Linkrolle selbst (nicht eine, die sie hält): der Platz hält sie und liest damit, was der Link liest. */
  const role = keys.roles.find((one) => one.roleId === chat.linkRoleId && one.via === undefined && one.token === link.token);

  const { proof } = await linkSecrets(link.token);
  const { link: own, key: linkKey } = newLink();
  const seatId = newId();
  const seatKey = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
  const label = seatAad(seatId);

  const done = await call<{ seatId: string; areaId: string; via: string }>('/links/person', {
    method: 'POST',
    credentials: 'omit',
    body: JSON.stringify({
      proof: toBase64Url(proof),
      areaId: chat.areaId,
      epoch,
      seatId,
      tokenSha256: toBase64Url(await sha256(own.token)),
      seatKeySealed: toBase64Url(await seal(linkKey, label, seatKey)),
      seatKeyForArea: toBase64Url(await seal(areaKey, label, seatKey)),
      linkSealed: await sealLink(seatId, seatKey, own),
      roleKeySealed: role === undefined ? null : toBase64Url(await seal(seatKey, seatRoleAad(seatId, role.roleId), role.roleKey)),
      /* 0097 — der Name, versiegelt: für die anderen (Bereichsschlüssel) und für ihn selbst (Platzschlüssel). */
      nameSealed: await sealName(areaKey, seatNameAad(seatId), name),
      nameEpoch: epoch,
      ownNameSealed: await sealName(seatKey, seatOwnNameAad(seatId), name),
      underPath: under
    })
  });

  remember(own.token, linkKey, under);
  announceSeats();
  return { token: own.token, keyText: own.key, seatId: done.seatId, name, via: done.via };
}

/** Die eigene Ansicht eines Platzes — dort stehen seine Rozmowy. */
export const portalOf = (person: HeldPerson): string =>
  `#/seat/${encodeURIComponent(person.token)}/${encodeURIComponent(person.keyText)}`;
