/**
 * DIE ROZMOWA FÜR DEN MENSCHEN MIT DEM LINK (0053) — die Browserseite.
 *
 * Hat der Bereich eines Platzes eine Rozmowa, liest und schreibt dieser
 * Mensch darin mit — ohne Konto, mit seinem Link als Ausweis.
 *
 * <b>Er bekommt NUR den Chatschlüssel</b>, nie den des Bereichs: unter dem
 * liegen die Notizen der Kanzlei und die Schlüssel anderer Plätze. Der
 * Chatschlüssel ist aus dem Bereichsschlüssel abgeleitet (`chat.ts`), und
 * ein Mitglied verpackt ihn ihm.
 *
 * <b>Dafür braucht er einen öffentlichen Schlüssel</b> — und einen Platz hat
 * keine Rolle. Also erzeugt sein Browser beim ersten Öffnen eine kleine
 * Identität (P-256, `newSeatPairs`); die privaten Hälften liegen versiegelt
 * unter dem PLATZSCHLÜSSEL beim Dienst. Mit dem Link kommt man also auch von
 * einem anderen Gerät wieder an sie heran, ohne dass der Dienst sie je sieht.
 *
 * <code>
 *   Link ──► Platzschlüssel ──► Identität ──► Chatschlüssel ──► Nachrichten
 * </code>
 */

import { chatSeatAad, sealMessage, sealVersion, versionValue, type SendOptions, type MessageExtras, type SealedMessage, type SealedVersion } from './chat';
import {
  aad, Field, fromBase64Url, newSeatPairs, openText, sealText, signCanonicalP256, toBase64Url, unwrapKeyP256
} from './crypto';
import { call } from './session';

export interface SeatIdentitySealed {
  readonly wrapPublicKey: string;
  readonly signPublicKey: string;
  readonly privateSealed: string;
}

export interface SeatChatRow {
  readonly chatId: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly currentEpoch: number;
  readonly lastMessageAt: string | null;

  /** 0069 — `seat`: die Rozmowa nur mit der Kanzlei; `area`: die mit allen im Bereich. Und was ungelesen ist. */
  readonly kind?: 'area' | 'seat';
  readonly unread?: number;

  /** Der Chatschlüssel je Epoche, verpackt für diesen Platz — leer, solange ihn kein Mitglied weitergegeben hat. */
  readonly keys: readonly { epoch: number; keyWrapped: string }[];
}

export interface SeatIdentity {
  readonly wrapPrivateKey: Uint8Array;
  readonly signPrivateKey: Uint8Array;
}

const seatPath = (token: string) => `/seat/${encodeURIComponent(token)}`;

const identityAad = (seatId: string) => aad('seat', 'identity', seatId, Field.SeatIdentity, 1);

export const loadSeatChats = (token: string): Promise<{
  seatId: string; identity: SeatIdentitySealed | null; chats: readonly SeatChatRow[];
}> => call(`${seatPath(token)}/chats`);

/**
 * DIE EIGENE IDENTITÄT — die vorhandene aufmachen, sonst eine anlegen.
 *
 * Zwei Fenster desselben Links könnten gleichzeitig anlegen; der Dienst
 * behält die erste und schickt sie beiden zurück. Aufgemacht wird deshalb
 * immer, was ER zurückgibt, nicht was hier eben entstand.
 */
export async function seatIdentity(
  token: string, seatId: string, seatKey: Uint8Array, found: SeatIdentitySealed | null
): Promise<SeatIdentity> {
  let identity = found;

  if (identity === null) {
    const pairs = await newSeatPairs();
    const sealed = await sealText(seatKey, identityAad(seatId), JSON.stringify({
      wrap: toBase64Url(pairs.wrapPrivateKey),
      sign: toBase64Url(pairs.signPrivateKey)
    }));

    const done = await call<{ identity: SeatIdentitySealed }>(`${seatPath(token)}/identity`, {
      method: 'POST',
      body: JSON.stringify({
        wrapPublicKey: toBase64Url(pairs.wrapPublicKey),
        signPublicKey: toBase64Url(pairs.signPublicKey),
        privateSealed: toBase64Url(sealed)
      })
    });
    identity = done.identity;
  }

  const plain = JSON.parse(await openText(seatKey, identityAad(seatId), fromBase64Url(identity.privateSealed))) as {
    wrap: string; sign: string;
  };
  return { wrapPrivateKey: fromBase64Url(plain.wrap), signPrivateKey: fromBase64Url(plain.sign) };
}

/** Die Chatschlüssel, die schon da sind — ausgepackt. Eine kaputte Hülle fehlt einfach. */
export async function seatChatKeys(
  identity: SeatIdentity, seatId: string, chat: SeatChatRow
): Promise<Map<number, Uint8Array>> {
  const out = new Map<number, Uint8Array>();
  for (const one of chat.keys) {
    try {
      out.set(one.epoch, await unwrapKeyP256(identity.wrapPrivateKey, chatSeatAad(chat.chatId, seatId, one.epoch),
        fromBase64Url(one.keyWrapped)));
    } catch {
      // Die übrigen Epochen bleiben lesbar.
    }
  }
  return out;
}

export const loadSeatMessages = (
  token: string, chatId: string, page: { before?: string; after?: string; changed?: string; beforeId?: string; afterId?: string } = {}
): Promise<{ messages: readonly SealedMessage[]; asOf?: string }> => {
  const q = new URLSearchParams();
  if (page.beforeId !== undefined) q.set('beforeId', page.beforeId);
  if (page.afterId !== undefined) q.set('afterId', page.afterId);
  if (page.before !== undefined) q.set('before', page.before);
  if (page.after !== undefined) q.set('after', page.after);
  if (page.changed !== undefined) q.set('changed', page.changed);
  const tail = q.toString();
  return call(`${seatPath(token)}/chat/${encodeURIComponent(chatId)}/messages${tail === '' ? '' : `?${tail}`}`);
};

/**
 * Schreiben — versiegelt wie jede Nachricht, unterschrieben mit dem
 * ECDSA-Schlüssel des Platzes. Im Feld des Verfassers steht der Platz.
 */
export async function sendSeatMessage(
  token: string, seatId: string, chatId: string, keys: ReadonlyMap<number, Uint8Array>,
  identity: SeatIdentity, text: string, name: string | null, options: SendOptions = {}
): Promise<{ messageId: string; createdAt: string; epoch: number }> {
  const { messageId, epoch, sealedBody, signedAt, bodyHash } = await sealMessage(keys, seatId, text, name, options);
  const signature = await signCanonicalP256(identity.signPrivateKey, versionValue({
    messageId, authorRoleId: seatId, bodyHash, createdAt: signedAt
  }));

  const done = await call<{ messageId: string; createdAt: string }>(
    `${seatPath(token)}/chat/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messageId, epoch, bodySealed: toBase64Url(sealedBody), signature: toBase64Url(signature), signedAt, sendAt: options.sendAt,
        topicId: options.topicId ?? null
      })
    });
  return { ...done, epoch };
}

export const deleteSeatMessage = (token: string, messageId: string): Promise<{ deleted: boolean }> =>
  call(`${seatPath(token)}/chat/message/${encodeURIComponent(messageId)}/delete`, { method: 'POST' });

/* -- 0058: bearbeiten, zurückholen, die Geschichte ------------------------------------------------ */

export const restoreSeatMessage = (token: string, messageId: string): Promise<{ restored: boolean }> =>
  call(`${seatPath(token)}/chat/message/${encodeURIComponent(messageId)}/restore`, { method: 'POST' });

export const loadSeatVersions = (token: string, messageId: string): Promise<{ versions: readonly SealedVersion[] }> =>
  call(`${seatPath(token)}/chat/message/${encodeURIComponent(messageId)}/versions`);

export async function editSeatMessage(
  token: string, seatId: string, messageId: string, keys: ReadonlyMap<number, Uint8Array>,
  identity: SeatIdentity, text: string, name: string | null, version: number, extras: MessageExtras = {}
): Promise<{ version: number; editedAt: string; epoch: number; bodySealed: string }> {
  const { epoch, sealedBody, signedAt, bodyHash } = await sealVersion(keys, messageId, seatId, text, name, extras);
  const signature = await signCanonicalP256(identity.signPrivateKey, versionValue({
    messageId, authorRoleId: seatId, bodyHash, createdAt: signedAt, version
  }));
  const done = await call<{ version: number; editedAt: string }>(
    `${seatPath(token)}/chat/message/${encodeURIComponent(messageId)}/edit`, {
      method: 'POST',
      body: JSON.stringify({ version, epoch, bodySealed: toBase64Url(sealedBody), signature: toBase64Url(signature), signedAt })
    });
  return { ...done, epoch, bodySealed: toBase64Url(sealedBody) };
}

/*
 * WIE ER SICH NENNT — in diesem Browser gemerkt, je Platz. Ein Komfort und
 * nichts, worauf etwas beruht: fehlt er, gilt der Name, den die Kanzlei am
 * Platz führt.
 */
const nameKey = (seatId: string) => `rc-chat-name:${seatId}`;

export function chatNameFor(seatId: string): string | null {
  try {
    const found = window.localStorage.getItem(nameKey(seatId));
    return found === null || found.trim() === '' ? null : found;
  } catch {
    return null;
  }
}

export function keepChatName(seatId: string, name: string): void {
  try {
    window.localStorage.setItem(nameKey(seatId), name.trim());
  } catch {
    // Dann fragt die Seite beim nächsten Mal wieder.
  }
}
