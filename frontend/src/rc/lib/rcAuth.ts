/**
 * 3.9 und 21.8 — Die Browserseite der Anmeldung.
 *
 * <b>Das Passwort verlässt dieses Gerät nie.</b> Was den Server erreicht, ist
 * der PasswordKey: das Ergebnis eines Argon2id-Laufs mit 64 MiB. Der Server
 * rechnet daraus mit einem zweiten Salz den Anmeldenachweis und öffnet mit
 * demselben PasswordKey die Hülle des Wurzelschlüssels.
 *
 * <b>Warum nur ein Lauf hier.</b> 21.8 wörtlich gelesen verlangt zwei
 * Argon2id-Läufe im Browser — einen für den Schlüssel, einen für den Nachweis.
 * Auf einem Telefon sind das zwei Sekunden bei jedem Neustart, für nichts: der
 * Nachweis schützt den Zugang, nicht den Schlüssel, und muss deshalb nicht hier
 * laufen. Er läuft auf dem Server, auf dem PasswordKey aufbauend. Ein Angreifer
 * mit der Datenbank zahlt dadurch zwei Läufe je Rateversuch statt einem
 * (BEFUND 35).
 *
 * Muss mit `backend/Rc.Kernel/RcPassword.cs` übereinstimmen.
 */

import { argon2id } from 'hash-wasm';
import { rcFetch, rcSetUnlockPiece, rcUnlockPiece } from './rcApi';
import { rcFromBase64Url, rcToBase64Url } from './rcBase64';

/** 21.1 — Die Parameter kommen vom Server mit, damit sie sich einmal ändern lassen. */
export interface RcArgon2Params {
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
  readonly outputBytes: number;
}

export const RC_ARGON2_DEFAULT: RcArgon2Params = {
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
  outputBytes: 32
};

export interface RcSaltResponse {
  readonly passwordSalt: string;
  readonly argon2: RcArgon2Params;
}

export interface RcSessionStarted {
  readonly accountId: string;
  readonly sessionId: string;
  readonly expiresUtc: string;
  /** 3.9 — 0 = bequem (Öffnungsstück je Sitzung), 1 = sicher (je Handlung). */
  readonly cacheMode: number;
  readonly idleMinutes: number;
}

export interface RcMe {
  readonly signedIn: boolean;
  readonly accountId?: string;
  readonly sessionId?: string;
  readonly keysHeld?: boolean;
}

/**
 * Der teure Lauf. Läuft in WebAssembly; bei 64 MiB ist er auf einem Telefon
 * spürbar, und das ist beabsichtigt — genau diese Kosten hat auch, wer rät.
 *
 * Der Aufrufer sollte vorher etwas anzeigen. Eine Oberfläche, die eine Sekunde
 * lang nicht reagiert, sieht kaputt aus, egal wie gut der Grund ist.
 */
export async function rcDerivePasswordKey(
  password: string,
  passwordSalt: Uint8Array,
  params: RcArgon2Params = RC_ARGON2_DEFAULT
): Promise<Uint8Array> {
  const hex = await argon2id({
    password,
    salt: passwordSalt,
    memorySize: params.memoryKiB,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: params.outputBytes,
    outputType: 'hex'
  });

  const out = new Uint8Array(params.outputBytes);
  for (let i = 0; i < params.outputBytes; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Holt das Salz. Der Server antwortet IMMER mit einem — für unbekannte Namen
 * mit einem abgeleiteten Scheinsalz. Dieser Aufruf verrät deshalb nicht, ob
 * ein Konto existiert, und darf ohne Sorge vor der Anmeldung laufen.
 */
export const rcSalt = (username: string) =>
  rcFetch<RcSaltResponse>('/auth/salt', { body: { username } });

export async function rcRegister(username: string, password: string): Promise<RcSessionStarted> {
  // Beim Anlegen bestimmt der Browser das Salz. Es ist nicht geheim — es soll
  // nur für jedes Konto ein anderes sein, damit eine vorberechnete Tabelle
  // nicht gegen alle gleichzeitig hilft.
  const passwordSalt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await rcDerivePasswordKey(password, passwordSalt);
  const encoded = rcToBase64Url(passwordKey);

  const session = await rcFetch<RcSessionStarted>('/auth/register', {
    body: { username, passwordKey: encoded, passwordSalt: rcToBase64Url(passwordSalt) }
  });

  rcSetUnlockPiece(encoded);
  return session;
}

export async function rcUnlock(
  username: string,
  password: string,
  deviceNote?: string
): Promise<RcSessionStarted> {
  const { passwordSalt, argon2 } = await rcSalt(username);
  const passwordKey = await rcDerivePasswordKey(password, rcFromBase64Url(passwordSalt), argon2);
  const encoded = rcToBase64Url(passwordKey);

  const session = await rcFetch<RcSessionStarted>('/auth/unlock', {
    body: { username, passwordKey: encoded, deviceNote }
  });

  // Erst NACH der Antwort ablegen. Ein Öffnungsstück im Speicher, zu dem es
  // keine entsperrte Sitzung gibt, führt bei jeder weiteren Anfrage zu einem
  // Fehler, den niemand mehr auf die fehlgeschlagene Anmeldung zurückführt.
  rcSetUnlockPiece(encoded);
  return session;
}

/**
 * 3.9 — Sperren ist nicht Abmelden. Der Schlüsselbund verschwindet aus dem
 * Serverspeicher und das Öffnungsstück aus diesem Tab; die Sitzung bleibt.
 */
export async function rcLock(): Promise<void> {
  try {
    await rcFetch<{ locked: boolean }>('/auth/lock', { method: 'POST', body: {} });
  } finally {
    // Auch wenn der Server nicht erreichbar war: das Öffnungsstück gehört
    // dann erst recht nicht mehr in diesen Tab.
    rcSetUnlockPiece(null);
  }
}

export async function rcLogout(): Promise<void> {
  try {
    await rcFetch<{ loggedOut: boolean }>('/auth/logout', { method: 'POST', body: {} });
  } finally {
    rcSetUnlockPiece(null);
  }
}

export const rcMe = () => rcFetch<RcMe>('/auth/me');

/** Ob dieser Tab ein Öffnungsstück hat. Sagt nichts darüber, ob es noch passt. */
export const rcHasUnlockPiece = () => rcUnlockPiece() !== null;
