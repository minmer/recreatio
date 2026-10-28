/**
 * ANMELDEN OHNE NETZ (2026-10-28) — das Konto auf DIESEM Gerät, wenn der Dienst nicht zu erreichen ist.
 *
 * <b>Wozu.</b> Die App öffnet sich auf dem Telefon auch ohne Netz (ihr Bündel liegt in der APK), aber die Frage
 * nach der Sitzung geht ins Leere. Bisher hiess das: das Anmeldeformular — und das gelingt ohne Netz nie; die
 * Powtórki für die Zeit ohne Netz (`cogita/offline.ts`) waren damit unerreichbar. Jetzt meldet man sich ohne Netz
 * AUF DEM GERÄT an, und wer schon angemeldet war, fliegt wegen eines Netzfehlers nicht hinaus (`sessionNow`).
 *
 * <b>Was das Gerät dafür behält</b> — nur in der App (im Browser öffnet sich die Seite ohne Netz gar nicht), nur im
 * Betrieb „kept" (`kept.ts`) und nur, solange es Powtórki für die Zeit ohne Netz hält:
 *
 * <code>
 *   salt              das Salz des Kontos (offen auch beim Dienst: `/auth/salt`)
 *   masterKeySealed   die Hülle des Hauptschlüssels unter dem PasswordKey — der Beweis des Passworts
 * </code>
 *
 * versiegelt unter dem Geräteschlüssel (in der App im Android Keystore). Kein Passwort, kein PasswordKey, kein
 * privater Schlüssel liegt hier.
 *
 * <b>Anmelden ohne Netz</b> ist dieselbe Rechnung wie beim Anmelden: Argon2id(Passwort, Salz) ergibt den
 * PasswordKey; öffnet er die Hülle, stimmt das Passwort. Aus dem Hauptschlüssel folgt der Schlüssel der
 * Abschriften (HKDF) — ohne Passwort öffnet sie niemand, auch nicht, wer das Telefon in der Hand hat. Kommt das
 * Netz zurück, meldet derselbe PasswordKey beim Dienst an (`resumeAway`): niemand fragt ein zweites Mal.
 *
 * <b>Der Preis, offen gesagt:</b> wer das Gerät samt seinem Schlüsselspeicher hat, kann Passwörter ausprobieren,
 * ohne den Dienst zu fragen — jeder Versuch so teuer wie Argon2id (64 MiB). Deshalb nur dort, wo es gebraucht wird,
 * und es geht mit den Abschriften: Abmelden, „Tylko w pamięci", die letzte Abschrift löschen.
 */

import { aad, derive, Field, fromBase64Url, KEY_SIZE, openText, sealText, toBase64Url } from './crypto';
import { idbDelete, idbGet, idbKeys, idbPut } from './idb';
import { device, knownDevice } from './kept';
import { openMasterKey } from './keys';
import { native } from './platform';
import { heldKeyOf, keepsKey, passwordKeyFor, passwordSalt, signInWithKey, unlockAway, WorkspaceError, type Who } from './session';

/**
 * Wo sich die Seite ohne Netz öffnet: in der App. Im Browser gibt es dafür keinen Grund, etwas abzulegen — und im
 * Entwicklungsserver nur, damit es sich prüfen lässt.
 */
export const AWAY_HERE: boolean = native || import.meta.env.DEV === true;

/** Was das Gerät für ein Konto behält (versiegelt). */
export interface AwayAccount {
  readonly accountId: string;
  /** Wie der Dienst den Namen schreibt (kleingeschrieben). */
  readonly loginId: string;
  /** Base64URL. */
  readonly salt: string;
  readonly masterKeySealed: string;
  readonly savedAt: number;
}

/** Wer ohne Netz angemeldet ist — nur im Speicher dieses Tabs. */
export interface AwaySession {
  readonly accountId: string;
  readonly loginId: string;
  /** Der Schlüssel der Abschriften (aus dem Hauptschlüssel) — geht mit dem Tab. */
  readonly key: Uint8Array;
}

/*
 * Die Ablage: dieselbe wie die der Abschriften (`offline`), je Konto. `copySlot` gehört den Abschriften
 * (`cogita/offline.ts`), steht aber hier: was ein Konto auf dem Gerät hält, geht an EINER Stelle fort.
 */
const STORE = 'offline';
const accountSlot = (accountId: string) => `account:${accountId}`;
export const copyPrefix = (accountId: string) => `copy:${accountId}:`;
export const copySlot = (accountId: string, libraryId: string, revisionId: string) => `${copyPrefix(accountId)}${libraryId}:${revisionId}`;

const accountAad = (accountId: string) => aad('kernel', 'away', accountId, Field.AwayAccount, 1);

/** Der Name, wie der Dienst ihn schreibt (`Auth.Normalise`). */
export const loginName = (typed: string): string => typed.trim().toLowerCase();

/** Der Schlüssel der Abschriften eines Kontos — aus seinem Hauptschlüssel, nirgends gespeichert. */
export const awayKeyFrom = (masterKey: Uint8Array, accountId: string): Promise<Uint8Array> =>
  derive(masterKey, `recreatio:v1:away:${accountId}`, KEY_SIZE);

/** Versiegeln und öffnen — eigens, damit die Prüfung es ohne Ablage nachrechnet. */
export async function sealAway(deviceKey: Uint8Array, account: AwayAccount): Promise<string> {
  return toBase64Url(await sealText(deviceKey, accountAad(account.accountId), JSON.stringify(account)));
}

export async function openAway(deviceKey: Uint8Array, accountId: string, sealed: string): Promise<AwayAccount> {
  const raw: unknown = JSON.parse(await openText(deviceKey, accountAad(accountId), fromBase64Url(sealed)));
  const one = raw as Partial<AwayAccount>;
  if (typeof one.loginId !== 'string' || typeof one.salt !== 'string' || typeof one.masterKeySealed !== 'string' || one.accountId !== accountId) {
    throw new Error('Nieczytelne konto na tym urządzeniu.');
  }
  return { accountId, loginId: one.loginId, salt: one.salt, masterKeySealed: one.masterKeySealed, savedAt: typeof one.savedAt === 'number' ? one.savedAt : 0 };
}

/**
 * Prüft das Passwort ohne Dienst: Argon2id mit dem Salz des Geräts, dann die Hülle des Hauptschlüssels. Gibt
 * den Hauptschlüssel — oder wirft. Der PasswordKey bleibt in diesem Tab (`unlockAway`), für `resumeAway`.
 */
export const proveAway = (account: AwayAccount, password: string): Promise<Uint8Array> =>
  unlockAway(account.loginId, password, fromBase64Url(account.salt), (key) => openMasterKey(account.accountId, key, account.masterKeySealed));

/* -- Was das Gerät hält ------------------------------------------------------------------------- */

/** Die Konten, mit denen man sich auf diesem Gerät ohne Netz anmelden kann — die jüngsten zuerst. */
export async function awayAccounts(): Promise<AwayAccount[]> {
  if (!AWAY_HERE) return [];
  const on = await knownDevice();
  if (on === null) return [];
  const out: AwayAccount[] = [];
  for (const slot of await idbKeys(STORE, 'account:')) {
    const row = await idbGet<{ sealed: string; accountId: string }>(STORE, slot);
    if (row === null) continue;
    try { out.push(await openAway(on.key, row.accountId, row.sealed)); } catch { /* nicht von diesem Gerät */ }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * BEREITLEGEN — wenn das Gerät eine Abschrift für die Zeit ohne Netz behält (`cogita/offline.ts`), und nach jeder
 * Anmeldung neu, falls sich der Beweis geändert hat. Nur in der App, nur „kept". Fehlschläge sind still: dann gibt
 * es eben kein Anmelden ohne Netz, und die Abschrift bleibt trotzdem (online offen).
 */
export async function keepAway(who: Who): Promise<void> {
  if (!AWAY_HERE || !keepsKey(who)) return;
  const on = await device();
  if (on === null) return;
  const row = await idbGet<{ sealed: string }>(STORE, accountSlot(who.accountId));
  if (row !== null) {
    const had = await openAway(on.key, who.accountId, row.sealed).catch(() => null);
    if (had !== null && had.masterKeySealed === who.masterKeySealed && had.loginId === who.loginId) return;
  }
  const account: AwayAccount = {
    accountId: who.accountId, loginId: who.loginId, salt: toBase64Url(await passwordSalt(who.loginId)),
    masterKeySealed: who.masterKeySealed, savedAt: Date.now()
  };
  await idbPut(STORE, accountSlot(who.accountId), { sealed: await sealAway(on.key, account), accountId: who.accountId, savedAt: account.savedAt });
}

/** Nach jeder Anmeldung: ein bereitgelegtes Konto folgt dem Dienst — ein neues Passwort, oder „Tylko w pamięci". */
export async function refreshAway(who: Who): Promise<void> {
  if (await idbGet(STORE, accountSlot(who.accountId)) === null) return;
  if (!keepsKey(who)) await forgetAway(who.accountId);
  else await keepAway(who).catch(() => undefined);
}

/** Hält das Gerät noch etwas von diesem Konto? Sonst geht auch das Anmelden ohne Netz. */
export async function dropAwayIfEmpty(accountId: string): Promise<void> {
  if ((await idbKeys(STORE, copyPrefix(accountId))).length === 0) await idbDelete(STORE, accountSlot(accountId));
}

/** Fort damit — das Konto und alle seine Abschriften (Abmelden, „Tylko w pamięci"). Die Ablage der Antworten bleibt: sie ist versiegelt und muss noch hinaus. */
export async function forgetAway(accountId: string): Promise<void> {
  await idbDelete(STORE, accountSlot(accountId));
  for (const slot of await idbKeys(STORE, copyPrefix(accountId))) await idbDelete(STORE, slot);
  if (current !== null && current.accountId === accountId) endAway();
}

/* -- Wer ohne Netz angemeldet ist --------------------------------------------------------------- */

let current: AwaySession | null = null;
const listeners = new Set<() => void>();
const changed = () => { for (const one of listeners) one(); };

export const awayNow = (): AwaySession | null => current;

export function onAway(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function endAway(): void {
  if (current === null) return;
  current.key.fill(0);
  current = null;
  changed();
}

/** Ohne Netz anmelden. Wirft mit einer Meldung, die man zeigen kann. */
export async function signInAway(typed: string, password: string): Promise<AwaySession> {
  const name = loginName(typed);
  const account = (await awayAccounts()).find((a) => a.loginId === name);
  if (account === undefined) throw new WorkspaceError('Tego konta nie ma na tym urządzeniu bez internetu.');
  let master: Uint8Array;
  try {
    master = await proveAway(account, password);
  } catch {
    throw new WorkspaceError('Hasło się nie zgadza.');
  }
  const key = await awayKeyFrom(master, account.accountId);
  master.fill(0);
  if (current !== null) current.key.fill(0);
  current = { accountId: account.accountId, loginId: account.loginId, key };
  changed();
  return current;
}

/**
 * Der Schlüssel der Abschriften für ein angemeldetes Konto: aus der Anmeldung ohne Netz, sonst aus dem
 * PasswordKey, den dieser Tab hält. `null`: er hält keinen (die Karte fragt nach dem Passwort).
 */
export async function awayKeyOf(who: Who): Promise<Uint8Array | null> {
  if (current !== null && current.accountId === who.accountId) return current.key;
  const key = await passwordKeyFor(who).catch(() => null);
  if (key === null) return null;
  try {
    const master = await openMasterKey(who.accountId, key, who.masterKeySealed);
    const out = await awayKeyFrom(master, who.accountId);
    master.fill(0);
    return out;
  } catch {
    return null;
  }
}

/**
 * Das Netz ist zurück, und der Dienst kennt keine Sitzung (abgelaufen, die App frisch gestartet): mit dem
 * PasswordKey der Anmeldung ohne Netz anmelden. `null`: niemand ist ohne Netz angemeldet, oder es gelang nicht.
 */
export async function resumeAway(): Promise<Who | null> {
  if (current === null) return null;
  const key = heldKeyOf(current.loginId);
  if (key === null) return null;
  try {
    const who = await signInWithKey(current.loginId, key);
    return who.accountId === current.accountId ? who : null;
  } catch {
    return null;
  }
}
