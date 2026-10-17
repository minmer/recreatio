/**
 * DIE GLOCKE ÖFFNET IHRE NAMEN SELBST (0097) — wie eine Rozmowa ihre
 * Nachrichten: der Dienst schickt den Namen eines Formulars und den eines
 * Menschen versiegelt (unter dem Schlüssel ihres Bereichs), und das Gerät
 * öffnet sie mit seinem Schlüsselbund. Firebase und der Sperrbildschirm sehen
 * davon nichts; ohne Schlüssel steht „Formularz" oder „osoba z formularza".
 */

import { openFormName, openSeatName } from '../core/names';
import type { Digest, DigestWaiting } from './notify';

const openWaiting = async (waiting: DigestWaiting | undefined, forms: boolean): Promise<DigestWaiting | undefined> => waiting === undefined || !forms ? waiting : {
  ...waiting,
  list: await Promise.all(waiting.list.map(async (one) => one.moduleId === undefined ? one : { ...one, name: await openFormName({ ...one, moduleId: one.moduleId }) }))
};

export async function openDigest(digest: Digest): Promise<Digest> {
  const [forms, chats, steps] = await Promise.all([
    Promise.all(digest.registrations.list.map(async (form) => ({ ...form, name: await openFormName(form) }))),
    Promise.all(digest.chats.list.map(async (chat) => chat.seatId == null ? { ...chat, seatName: null } : {
      ...chat,
      seatName: await openSeatName({
        seatId: chat.seatId, areaId: chat.seatAreaId, nameSealed: chat.seatNameSealed, nameEpoch: chat.seatNameEpoch
      })
    })),
    openWaiting(digest.steps, true)
  ]);

  return {
    ...digest,
    registrations: { ...digest.registrations, list: forms },
    chats: { ...digest.chats, list: chats },
    ...(steps === undefined ? {} : { steps })
  };
}
