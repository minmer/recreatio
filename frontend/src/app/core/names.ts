/**
 * NAMEN LIEGEN NIE OFFEN (0097).
 *
 * Der Name eines Formulars, einer Gruppe von Formularen und eines Menschen
 * steht in der Datenbank nur versiegelt. Versiegelt und geöffnet wird hier, im
 * Browser:
 *
 * <code>
 *   Formular, Gruppe   unter dem Schlüssel ihres Bereichs — lesen kann ihn, wer
 *                      die Fragen lesen kann (ein öffentliches Formular hat einen
 *                      offenen Bereich: sein Name ist so öffentlich wie es selbst)
 *   Mensch am Platz    unter dem Schlüssel seines Bereichs (Kanzlei, Mitglieder;
 *                      NIE ein offener) und unter dem Platzschlüssel (er selbst)
 *   Termin             für die Kanzlei (Bereichsschlüssel oder Annahme), für den
 *                      Gastgeber (ECIES auf seinen P-256-Schlüssel)
 * </code>
 *
 * <b>Woher der Schlüssel kommt</b> (`nameKey`): aus dem Platz in diesem Tab,
 * aus einem Link im Browser, aus dem Schlüsselbund des Kontos, zuletzt aus dem
 * offenen Schlüssel eines jawny Bereichs — wie `areaReader`, nur über die
 * Ansichten hinweg behalten, damit eine Liste mit zwanzig Bereichen nicht
 * zwanzigmal fragt.
 *
 * <b>Was nicht aufgeht, ist kein Fehler.</b> Wer den Bereich nicht liest, sieht
 * „Formularz" oder „Osoba" — das ist die Auskunft, dass es da etwas gibt.
 */

import { loadPublicKey, myEpochKeys } from '../areas/area';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url, unwrapKey, wrapKey, wrapKeyP256, unwrapKeyP256, type Aad } from './crypto';
import type { Ring } from './keys';
import { heldAreaKey } from '../links/linkAccess';
import { keysFor } from './ringOf';
import { seatAreaKey } from '../roles/roleBundle';
import { whoIsThere, WorkspaceError } from './session';

/* -- Die Etiketten -------------------------------------------------------------------------- */

export const moduleNameAad = (moduleId: string): Aad => aad('module', 'name', moduleId, Field.ModuleName, 1);
export const groupNameAad = (groupId: string): Aad => aad('form_group', 'name', groupId, Field.FormGroupName, 1);
export const seatNameAad = (seatId: string): Aad => aad('seat', 'name', seatId, Field.SeatName, 1);
export const seatOwnNameAad = (seatId: string): Aad => aad('seat', 'own_name', seatId, Field.SeatOwnName, 1);
export const claimHolderAad = (claimId: string): Aad => aad('claim', 'holder_name', claimId, Field.ClaimHolderName, 1);
export const claimAskAad = (claimId: string): Aad => aad('claim', 'ask_name', claimId, Field.ClaimAskName, 1);
export const hostWrapAad = (claimId: string): Aad => aad('claim', 'host_wrap', claimId, Field.ClaimHostWrap, 1);

/* -- Was über die Leitung kommt ------------------------------------------------------------------ */

/** Ein versiegelter Name mit seiner Epoche — und, bei einem alten, der Klartext, bis er versiegelt ist. */
export interface SealedName {
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;
}

/** Ein versiegelter Name, bereit für den Dienst. */
export interface NameOut {
  readonly nameSealed: string;
  readonly nameEpoch: number;
}

/* -- Die Schlüssel, über die Ansichten hinweg ------------------------------------------------------ */

interface Cache {
  readonly at: number;
  ring: { readonly at: number; readonly found: Promise<Ring | null> } | null;
  readonly held: Map<string, { readonly at: number; readonly keys: Promise<Map<number, Uint8Array>> }>;
  readonly shown: Map<string, Promise<{ epoch: number; key: Uint8Array } | null>>;
}

const fresh = (): Cache => ({ at: Date.now(), ring: null, held: new Map(), shown: new Map() });

let cache = fresh();

/** Bei der Abmeldung (und bei der Anmeldung): die Schlüssel des einen gehören nicht in die Listen des nächsten. */
export function forgetNameKeys(): void {
  cache = fresh();
}

function current(): Cache {
  if (Date.now() - cache.at > 15 * 60_000) cache = fresh();
  return cache;
}

/** Der Schlüsselbund des Kontos in diesem Tab — oder `null`. Ein „keiner" gilt nur kurz: gleich kann jemand sich anmelden. */
async function ringNow(c: Cache): Promise<Ring | null> {
  if (c.ring === null || (Date.now() - c.ring.at > 3_000 && (await c.ring.found) === null)) {
    c.ring = {
      at: Date.now(),
      found: (async () => {
        const who = await whoIsThere();
        if (who === null) return null;
        return (await keysFor(who).catch(() => null))?.ring ?? null;
      })()
    };
  }
  return c.ring.found;
}

async function heldKeys(c: Cache, ring: Ring, areaId: string, epoch: number | null): Promise<Map<number, Uint8Array>> {
  let held = c.held.get(areaId);
  /* Eine Epoche, die der Bund noch nicht kannte (der Bereich wurde eben geschnitten): einmal neu holen. */
  if (held !== undefined && epoch !== null && !(await held.keys).has(epoch) && Date.now() - held.at > 20_000) held = undefined;
  if (held === undefined) {
    held = { at: Date.now(), keys: myEpochKeys(ring, areaId).catch(() => new Map<number, Uint8Array>()) };
    c.held.set(areaId, held);
  }
  return held.keys;
}

/** Der Schlüssel dieser Epoche — auf jedem Weg, den dieser Browser hat. `undefined`: er liest den Bereich nicht. */
export async function nameKey(areaId: string, epoch: number): Promise<Uint8Array | undefined> {
  const c = current();

  const seated = seatAreaKey(areaId, epoch);
  if (seated !== null) return seated;

  const linked = await heldAreaKey(areaId, epoch).catch(() => null);
  if (linked !== null) return linked;

  const ring = await ringNow(c);
  if (ring !== null) {
    const mine = (await heldKeys(c, ring, areaId, epoch)).get(epoch);
    if (mine !== undefined) return mine;
  }

  let shown = c.shown.get(areaId);
  if (shown === undefined) {
    shown = loadPublicKey(areaId).then((k) => ({ epoch: k.epoch, key: fromBase64Url(k.key) })).catch(() => null);
    c.shown.set(areaId, shown);
  }
  const open = await shown;
  return open !== null && open.epoch === epoch ? open.key : undefined;
}

/**
 * Der Schlüssel, unter dem ein NEUER Name versiegelt wird: die jüngste Epoche,
 * die mein Bund in diesem Bereich hält. `person`: der Name eines Menschen — nie
 * unter einem offenen Schlüssel (der Dienst lehnt das auch ab).
 */
export async function writeKey(areaId: string, options: { readonly person?: boolean; readonly ring?: Ring | null } = {}): Promise<{ epoch: number; key: Uint8Array }> {
  const c = current();
  const ring = options.ring ?? await ringNow(c);
  if (ring === null) throw new WorkspaceError('Do zapisania nazwy potrzebny jest klucz — zaloguj się ponownie.');

  const keys = await heldKeys(c, ring, areaId, null);
  const epochs = [...keys.keys()].sort((a, b) => b - a);
  const epoch = epochs[0];
  if (epoch === undefined) throw new WorkspaceError('Nie masz klucza tego obszaru — nazwy nie da się zapieczętować.');

  if (options.person === true) {
    const open = await loadPublicKey(areaId).catch(() => null);
    if (open !== null && open.epoch === epoch) throw new WorkspaceError('Ten obszar jest jawny — imienia i nazwiska nie da się w nim ukryć.');
  }

  return { epoch, key: keys.get(epoch)! };
}

/* -- Versiegeln, öffnen ------------------------------------------------------------------------- */

export const sealName = async (key: Uint8Array, a: Aad, text: string): Promise<string> =>
  toBase64Url(await sealText(key, a, text.trim()));

/** Unter dem Schlüssel eines Bereichs — und gleich wieder geöffnet: was hinausgeht, geht auch wieder auf. */
export async function sealUnderArea(areaId: string, a: Aad, text: string, options: { readonly person?: boolean; readonly ring?: Ring | null } = {}): Promise<NameOut> {
  const { epoch, key } = await writeKey(areaId, options);
  const sealed = await sealName(key, a, text);
  if (await openWith(key, a, sealed) !== text.trim()) throw new WorkspaceError('Nazwa nie dała się zapieczętować — spróbuj jeszcze raz.');
  return { nameSealed: sealed, nameEpoch: epoch };
}

export async function openWith(key: Uint8Array, a: Aad, sealed: string): Promise<string | null> {
  try {
    return await openText(key, a, fromBase64Url(sealed));
  } catch {
    return null;
  }
}

/** Einen Namen unter dem Schlüssel seines Bereichs öffnen — oder `null`. */
export async function openName(
  areaId: string | null | undefined, sealed: SealedName, a: Aad
): Promise<string | null> {
  if (areaId == null || sealed.nameSealed == null || sealed.nameEpoch == null) return null;
  const key = await nameKey(areaId, sealed.nameEpoch).catch(() => undefined);
  return key === undefined ? null : openWith(key, a, sealed.nameSealed);
}

/* -- Für die Annahme (wer keinen Bereichsschlüssel hat) --------------------------------------------- */

/** Mit einem Wegwerfschlüssel versiegelt, der für die öffentliche Hälfte der Annahme verpackt ist — wie eine Antwort. */
export async function sealForIntake(intakePublic: Uint8Array, a: Aad, text: string): Promise<{ sealed: string; wrapped: string }> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return {
    sealed: await sealName(key, a, text),
    wrapped: toBase64Url(await wrapKey(intakePublic, a, key))
  };
}

export async function openFromIntake(intakePrivate: Uint8Array, a: Aad, sealed: string, wrapped: string): Promise<string | null> {
  try {
    return await openWith(await unwrapKey(intakePrivate, a, fromBase64Url(wrapped)), a, sealed);
  } catch {
    return null;
  }
}

/* -- Für einen öffentlichen P-256-Schlüssel (der Gastgeber) ------------------------------------------- */

const utf8 = new TextEncoder();

export const sealForPublic = async (spki: Uint8Array, a: Aad, text: string): Promise<string> =>
  toBase64Url(await wrapKeyP256(spki, a, utf8.encode(text.trim())));

export async function openForPrivate(pkcs8: Uint8Array, a: Aad, sealed: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await unwrapKeyP256(pkcs8, a, fromBase64Url(sealed)));
  } catch {
    return null;
  }
}

/* -- Der Name eines Menschen --------------------------------------------------------------------- */

const clean = (text: string | null | undefined): string =>
  [...(text ?? '')].filter((c) => c >= ' ' && c !== '\u007f').join('').split(' ').filter((w) => w !== '').join(' ');

/**
 * Vor- und Nachname, beide da, ohne Steuerzeichen und doppelte Leerzeichen —
 * oder `null`. (0095 stand das im Dienst; seit 0097 sieht er keinen Namen mehr.)
 */
export function personName(given: string | null | undefined, surname: string | null | undefined): string | null {
  const first = clean(given);
  const last = clean(surname);
  if (first.length === 0 || first.length > 80 || last.length === 0 || last.length > 100) return null;
  return `${first} ${last}`;
}

/** Ein Name, wie er versiegelt wird: getrimmt, höchstens 200 Zeichen. */
export const nameText = (text: string): string => clean(text).slice(0, 200);

/* -- Ein Formular, wie es von irgendwoher kommt ------------------------------------------------- */

/** Was ein Dienst über ein Formular schickt: versiegelt (unter seinem Bereich), oder — ein altes — noch offen. */
export interface FormNameIn extends SealedName {
  readonly moduleId: string;
  readonly areaId?: string | null;
  readonly name?: string | null;
}

/** Der Name eines Formulars, geöffnet — oder der offene eines alten — oder der Ersatz. */
export async function openFormName(form: FormNameIn, fallback = 'Formularz'): Promise<string> {
  if (form.nameSealed != null) return (await openName(form.areaId, form, moduleNameAad(form.moduleId))) ?? fallback;
  return form.name?.trim() || fallback;
}

/** Dasselbe für eine Liste: \`name\` geöffnet, der Rest bleibt. */
export const openFormNames = <T extends FormNameIn>(forms: readonly T[], fallback?: string): Promise<(T & { readonly name: string })[]> =>
  Promise.all(forms.map(async (form) => ({ ...form, name: await openFormName(form, fallback) })));

/* -- Ein Mensch an einem Platz, wie er von irgendwoher kommt ------------------------------------------ */

/** Was ein Dienst über einen Platz schickt: der Name versiegelt unter dem Schlüssel seines Bereichs, oder — ein alter — noch offen. */
export interface SeatNameIn extends SealedName {
  readonly seatId: string;
  /** Der Bereich des Platzes — unter seinem Schlüssel liegt die Kopie für die Kanzlei. */
  readonly areaId?: string | null;
  readonly name?: string | null;
  readonly recipientName?: string | null;
}

/** Wie der Mensch an diesem Platz heisst — geöffnet, oder der offene Name eines alten, oder `null`. */
export async function openSeatName(seat: SeatNameIn): Promise<string | null> {
  if (seat.nameSealed != null) return openName(seat.areaId, seat, seatNameAad(seat.seatId));
  return (seat.name ?? seat.recipientName)?.trim() || null;
}

/** Der Schlüsselbund dieses Tabs — oder `null` (niemand angemeldet, oder der Bund ist zu). */
export const ringOrNull = (): Promise<Ring | null> => ringNow(current());

/** Den Schlüsselbund ausdrücklich nennen — für einen Prüflauf ohne Tab-Sitzung, oder eine Ansicht, die ihn schon hat. */
export function holdRing(ring: Ring | null): void {
  cache = fresh();
  if (ring !== null) cache.ring = { at: Date.now(), found: Promise.resolve(ring) };
}
