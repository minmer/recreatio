/**
 * WAS DAS TELEFON VON SELBST TUT — das Archiv der SMS und das Adressbuch auf dem
 * Telefon, im Läufer (App zu, `PhoneWork.java`) und in der offenen App.
 *
 * <code>
 *   archive    die gewählten Gespräche ins Archiv der gewählten Rolle
 *              (`archiveSettings.ts`; Bilder, wenn „phone.media" an ist) — von
 *              selbst erst, wenn jemand das Archiv eingerichtet hat
 *   contacts   die Kontakte aus recreatio ins Adressbuch des Telefons
 *   outbox     was im Browser auf dieses Telefon wartet (0116): übernehmen und
 *              planen, Ausgänge melden, Absagen umsetzen (`outbox.ts`)
 * </code>
 *
 * In der offenen App läuft beides kurz nach dem Start (`startPhone`), wenn es
 * eine Weile her ist — und nie zweimal zugleich.
 */

import { remembered, setValue } from '../core/prefs';
import { whoIsThere, WorkspaceError, type Who } from '../core/session';
import { archiveArea, archiveSettings } from './archiveSettings';
import { toPhone } from './contactStore';
import { PHONE_PREF } from './here';
import { bridgeSource, Phone, phoneHere, pluginSource, type PhoneSource } from './native';
import { runOutbox } from './outbox';
import { LOCKED, openArea, openPhone, type PhoneCtx } from './phoneContext';
import { archivePhone, type ArchiveProgress } from './smsArchive';

/** Gehen Bilder aus MMS mit ins Archiv? `on` (Vorgabe) oder `off`. */
export const MEDIA_PREF = 'phone.media';

let archiving: Promise<ArchiveProgress> | null = null;
let writing: ReturnType<typeof toPhone> | null = null;

/**
 * ARCHIVIEREN — in den Bereich der gewählten Rolle, die gewählten Gespräche. Läuft schon ein
 * Lauf, bekommt man dessen Ergebnis.
 */
export function archiveNow(who: Who, source: PhoneSource, options: { full?: boolean; onProgress?: (p: ArchiveProgress) => void } = {}): Promise<ArchiveProgress> {
  if (archiving === null) {
    archiving = (async () => {
      const { areaId, settings } = await archiveArea(who);
      const ctx = await openArea(who, areaId);
      const media = (await remembered(MEDIA_PREF, 'on')) !== 'off';
      return archivePhone(ctx, source, { media, choice: settings, full: options.full, onProgress: options.onProgress });
    })().finally(() => { archiving = null; });
  }
  return archiving;
}

export const archiveRunning = (): boolean => archiving !== null;

/**
 * Die Kontakte ins Telefon — nie zweimal zugleich. Läuft schon ein Abgleich, bekommt man dessen
 * Ergebnis; `again`: danach noch einer, denn der laufende hat die Liste VOR einer Änderung gelesen.
 */
export function contactsNow(ctx: PhoneCtx, source: PhoneSource, again = false): ReturnType<typeof toPhone> {
  if (writing !== null && !again) return writing;
  const mine = (writing ?? Promise.resolve()).catch(() => undefined).then(() => toPhone(ctx, source));
  writing = mine;
  mine.then(() => undefined, () => undefined).finally(() => { if (writing === mine) writing = null; });
  return mine;
}

/** Ein Auftrag des Läufers (`runner.ts`). `locked`: ohne Schlüssel oder Sitzung — Wiederholen hilft nicht. */
export async function runPhoneJob(job: string): Promise<Record<string, unknown>> {
  const who = await whoIsThere();
  if (who === null) return { ok: false, locked: true, error: 'Brak sesji.' };
  const source = bridgeSource();
  if (source === null) return { ok: false, error: 'To nie jest wydanie SMS aplikacji.' };
  try {
    if (job === 'archive') {
      /* Von selbst erst, wenn das Archiv eingerichtet ist (Rolle gewählt oder einmal von Hand archiviert). */
      if ((await archiveSettings()).areaId === null) return { ok: true, skipped: 'not set up' };
      return { ok: true, ...(await archiveNow(who, source)) };
    }
    if (job === 'contacts') return { ok: true, ...(await toPhone(await openPhone(who), source)) };
    if (job === 'outbox') return { ok: true, ...(await outboxNow(who, source)) };
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict === LOCKED) return { ok: false, locked: true, error: e.message };
    throw e;
  }
  return { ok: false, error: 'Nieznane zlecenie.' };
}

let sending: ReturnType<typeof runOutbox> | null = null;

/** Was im Browser wartet — nie zweimal zugleich (ein zweiter Ruf bekommt den laufenden). */
export function outboxNow(who: Who, source: PhoneSource): ReturnType<typeof runOutbox> {
  if (sending === null) sending = runOutbox(who, source).finally(() => { sending = null; });
  return sending;
}

let started = false;

/**
 * KURZ NACH DEM START der App (Ausgabe „sms"): merken, dass es das Telefon
 * gibt (dann stehen SMS und Kontakte auch im Browser im Menü), das Adressbuch
 * auffrischen, wenn es länger als eine Stunde her ist (Änderungen aus dem
 * Browser), und archivieren, was seit einer halben Stunde dazukam.
 */
export function startPhone(who: Who): void {
  if (started || !phoneHere()) return;
  started = true;
  setValue(PHONE_PREF, 'on');
  window.setTimeout(() => {
    void (async () => {
      const status = await Phone.status();
      const hour = 3600_000;
      if (status.contacts && (status.contactsSyncedAt === null || Date.now() - status.contactsSyncedAt > hour)) {
        await contactsNow(await openPhone(who), pluginSource).catch(() => undefined);
      }
      /*
       * Archiviert wird von selbst erst, wenn jemand das Archiv eingerichtet hat — die Rolle gewählt
       * oder einmal „Archiwizuj teraz" gedrückt. Vorher käme alles in den eigenen Bereich, bevor man
       * sich für eine Rolle und die Gespräche entschieden hat.
       */
      const settings = await archiveSettings();
      if (status.smsRead && settings.areaId !== null
        && (status.archivedAt === null || Date.now() - status.archivedAt > hour / 2)) {
        await archiveNow(who, pluginSource).catch(() => undefined);
      }
    })().catch(() => undefined);
    /* 2026-10-18 — die Timer der Lampen: was anderswo geändert wurde, gilt ab jetzt auch auf diesem Telefon. */
    void import('../lamps/timerStart').then((m) => m.startLamps(who)).catch(() => undefined);
  }, 8000);

  /*
   * 0116 — solange die App offen ist: jede Minute nachsehen, ob im Browser etwas auf dieses
   * Telefon wartet (ohne Firebase gibt es sonst nur das Fragen im Takt, alle 15 Minuten).
   */
  const look = () => {
    if (document.visibilityState !== 'visible') return;
    void archiveSettings().then((s) => (s.areaId === null ? undefined : outboxNow(who, pluginSource))).catch(() => undefined);
  };
  window.setTimeout(look, 12_000);
  window.setInterval(look, 60_000);
  document.addEventListener('visibilitychange', look);
}
