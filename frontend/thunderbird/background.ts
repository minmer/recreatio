/**
 * DIE HINTERGRUNDSEITE DES DODATEK — hängt `filelink.ts` an Thunderbird.
 *
 * <code>
 *   onFileUpload       Datei versiegeln und hinauf; der Link (und bis wann er gilt) in die Nachricht
 *   onFileUploadAbort  abbrechen; war sie schon oben, gleich wieder fort
 *   onFileDeleted      der Anhang ging aus der Nachricht — der Link wird zurückgezogen
 *   onFileRename       der Name steht in der Hülle: neu hinauf unter dem neuen Namen, der alte Link geht
 *   onAccountDeleted   das Konto in Thunderbird ist fort — das Połączenie trennt sich selbst
 * </code>
 *
 * Thunderbird merkt sich nicht, welches Konto eingerichtet ist (`configured`
 * beginnt nach jedem Start falsch): das sagt ihm diese Seite bei jedem Start neu.
 * Sie bleibt geladen (Manifest 2, kein `persistent: false`): ein Hinauf von 25 MB
 * über ein langsames Netz soll nicht mitten drin einschlafen.
 */

import { SHARE_MAX } from '../src/app/phone/shareSeal';
import {
  connectionFrom, daysOf, dropFile, isAbort, leave, putFile, readConnection, ServiceError, templateOf, usage, type Connection
} from './filelink';
import { thunderbird, type CloudFileAccount, type RenameResult, type UploadResult } from './messenger';
import type { SettingsAsk, SettingsState } from './protocol';

const tb = thunderbird();

const slot = (accountId: string) => `connection:${accountId}`;

async function connectionOf(accountId: string): Promise<Connection | null> {
  const stored = await tb.storage.local.get(slot(accountId));
  return readConnection(stored[slot(accountId)]);
}

const keep = (accountId: string, conn: Connection) => tb.storage.local.set({ [slot(accountId)]: conn });

/**
 * Das Połączenie trennen — es sei denn, ein anderes Konto in diesem Thunderbird hält
 * denselben Kod (jemand hat ihn zweimal eingefügt): dann ginge es dort mit kaputt.
 */
async function leaveUnlessShared(accountId: string, conn: Connection): Promise<void> {
  const all = await tb.storage.local.get(null);
  const shared = Object.entries(all).some(([name, value]) => name !== slot(accountId) && readConnection(value)?.id === conn.id);
  if (!shared) await leave(conn).catch(() => undefined);
}

/** Thunderbird bietet ein Konto erst an, wenn es eingerichtet ist — und vergisst das bei jedem Start. */
async function mark(accountId: string, configured: boolean): Promise<void> {
  await tb.cloudFile.updateAccount(accountId, { configured, uploadSizeLimit: SHARE_MAX });
}

/* -- Hinauf und zurück --------------------------------------------------------------------------- */

/** Was hochging: der Link auf dem Dienst und die Datei, falls er umbenannt wird. Schlüssel: Konto und Kennung des Anhangs. */
const uploaded = new Map<string, { readonly shareId: string; readonly file: File }>();
const running = new Map<string, AbortController>();
const keyOf = (account: CloudFileAccount, fileId: number) => `${account.id}:${fileId}`;

const NOT_CONNECTED = 'Ten Thunderbird nie jest jeszcze połączony z recreatio.pl. Ustawienia → Redagowanie → Załączniki → recreatio.pl: wklej kod połączenia.';
const failed = (e: unknown, otherwise: string): string => (e instanceof ServiceError ? e.message : otherwise);

tb.cloudFile.onFileUpload.addListener(async (account, { id, name, data }): Promise<UploadResult> => {
  const conn = await connectionOf(account.id);
  if (conn === null) return { error: NOT_CONNECTED };

  const key = keyOf(account, id);
  const control = new AbortController();
  running.set(key, control);
  try {
    /* Erst fragen, ob das Połączenie noch gilt: ein Nein nach 25 MB hiesse, sie umsonst geschickt zu haben. */
    await usage(conn);
    const shared = await putFile(conn, data, name, control.signal);
    if (control.signal.aborted) {
      await dropFile(conn, shared.id).catch(() => false);
      return { aborted: true };
    }
    uploaded.set(key, { shareId: shared.id, file: data });
    return { url: shared.url, templateInfo: templateOf(shared.expiresAt) };
  } catch (e) {
    if (control.signal.aborted || isAbort(e)) return { aborted: true };
    console.warn('recreatio.pl: upload failed', e);
    return { error: failed(e, 'Nie udało się wysłać pliku do recreatio.pl.') };
  } finally {
    running.delete(key);
  }
});

tb.cloudFile.onFileUploadAbort.addListener((account, fileId) => {
  running.get(keyOf(account, fileId))?.abort();
});

tb.cloudFile.onFileDeleted.addListener(async (account, fileId) => {
  const key = keyOf(account, fileId);
  const done = uploaded.get(key);
  uploaded.delete(key);
  const conn = done === undefined ? null : await connectionOf(account.id);
  if (done === undefined || conn === null) return;
  /* Bleibt der Link liegen, verschwindet er mit seinem Ablauf — kein Grund, Thunderbird aufzuhalten. */
  await dropFile(conn, done.shareId).catch((e: unknown) => { console.warn('recreatio.pl: delete failed', e); return false; });
});

tb.cloudFile.onFileRename.addListener(async (account, fileId, newName): Promise<RenameResult> => {
  const key = keyOf(account, fileId);
  const done = uploaded.get(key);
  const conn = await connectionOf(account.id);
  if (done === undefined || conn === null) {
    return { error: 'Nazwa pliku jest zaszyfrowana razem z nim — usuń ten załącznik i dodaj plik jeszcze raz pod nową nazwą.' };
  }
  try {
    const shared = await putFile(conn, done.file, newName);
    uploaded.set(key, { shareId: shared.id, file: done.file });
    await dropFile(conn, done.shareId).catch(() => false);
    return { url: shared.url };
  } catch (e) {
    console.warn('recreatio.pl: rename failed', e);
    return { error: failed(e, 'Nie udało się zmienić nazwy — usuń ten załącznik i dodaj plik jeszcze raz.') };
  }
});

/* -- Konten in Thunderbird ---------------------------------------------------------------------- */

tb.cloudFile.onAccountAdded.addListener((account) => {
  void connectionOf(account.id).then((conn) => mark(account.id, conn !== null));
});

tb.cloudFile.onAccountDeleted.addListener((accountId) => {
  void (async () => {
    const conn = await connectionOf(accountId);
    if (conn === null) return;
    await leaveUnlessShared(accountId, conn);
    await tb.storage.local.remove(slot(accountId));
  })();
});

/* Nach jedem Start: was verbunden ist, ist eingerichtet. */
void (async () => {
  for (const account of await tb.cloudFile.getAllAccounts()) {
    await mark(account.id, (await connectionOf(account.id)) !== null).catch(() => undefined);
  }
})();

/* -- Die Seite der Einstellungen ---------------------------------------------------------------- */

const blank: SettingsState = { connected: false, name: null, days: daysOf(undefined), usage: null, error: null, note: null };

async function stateOf(accountId: string, extra: Partial<SettingsState> = {}): Promise<SettingsState> {
  const conn = await connectionOf(accountId);
  if (conn === null) return { ...blank, ...extra };
  try {
    const u = await usage(conn);
    return { connected: true, name: conn.name, days: conn.days, usage: u, error: null, note: null, ...extra };
  } catch (e) {
    return { connected: true, name: conn.name, days: conn.days, usage: null, error: failed(e, 'Nie udało się zapytać recreatio.pl.'), note: null, ...extra };
  }
}

async function answer(ask: SettingsAsk): Promise<SettingsState> {
  switch (ask.kind) {
    case 'state':
      return stateOf(ask.accountId);
    case 'connect': {
      const made = connectionFrom(ask.code, ask.days);
      if ('error' in made) return { ...(await stateOf(ask.accountId)), error: made.error };
      try {
        await usage(made);
      } catch (e) {
        return { ...(await stateOf(ask.accountId)), error: failed(e, 'Nie udało się połączyć z recreatio.pl.') };
      }
      /* Ein neuer Kod ersetzt den alten — der alte soll dann nirgends mehr gelten. */
      const before = await connectionOf(ask.accountId);
      if (before !== null && before.id !== made.id) await leaveUnlessShared(ask.accountId, before);
      await keep(ask.accountId, made);
      await mark(ask.accountId, true);
      return stateOf(ask.accountId);
    }
    case 'days': {
      const conn = await connectionOf(ask.accountId);
      if (conn !== null) await keep(ask.accountId, { ...conn, days: daysOf(ask.days) });
      return stateOf(ask.accountId);
    }
    case 'disconnect': {
      const conn = await connectionOf(ask.accountId);
      if (conn !== null) await leaveUnlessShared(ask.accountId, conn);
      await tb.storage.local.remove(slot(ask.accountId));
      await mark(ask.accountId, false);
      return stateOf(ask.accountId, { note: 'Odłączono. Linki wysłane wcześniej działają do swojego terminu; usuniesz je na recreatio.pl w „Pliki przez link”.' });
    }
  }
}

const isAsk = (m: unknown): m is SettingsAsk =>
  typeof m === 'object' && m !== null && typeof (m as { kind?: unknown }).kind === 'string' && typeof (m as { accountId?: unknown }).accountId === 'string';

tb.runtime.onMessage.addListener((message) => (isAsk(message) ? answer(message) : undefined));
