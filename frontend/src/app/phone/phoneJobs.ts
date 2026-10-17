/**
 * WAS DAS TELEFON VON SELBST TUT — das Archiv der SMS und das Adressbuch auf dem
 * Telefon, im Läufer (App zu, `PhoneWork.java`) und in der offenen App.
 *
 * <code>
 *   archive    neue SMS und MMS ins Archiv (Bilder, wenn „phone.media" an ist)
 *   contacts   die Kontakte aus recreatio ins Adressbuch des Telefons
 * </code>
 *
 * In der offenen App läuft beides kurz nach dem Start (`startPhone`), wenn es
 * eine Weile her ist — und nie zweimal zugleich.
 */

import { remembered, setValue } from '../core/prefs';
import { whoIsThere, WorkspaceError, type Who } from '../core/session';
import { toPhone } from './contactStore';
import { PHONE_PREF } from './here';
import { bridgeSource, Phone, phoneHere, pluginSource, type PhoneSource } from './native';
import { LOCKED, openPhone, type PhoneCtx } from './phoneContext';
import { archivePhone, type ArchiveProgress } from './smsArchive';

/** Gehen Bilder aus MMS mit ins Archiv? `on` (Vorgabe) oder `off`. */
export const MEDIA_PREF = 'phone.media';

let archiving: Promise<ArchiveProgress> | null = null;
let writing: ReturnType<typeof toPhone> | null = null;

/** Archivieren — läuft schon ein Lauf, bekommt man dessen Ergebnis. */
export function archiveNow(ctx: PhoneCtx, source: PhoneSource, options: { full?: boolean; media: boolean; onProgress?: (p: ArchiveProgress) => void }): Promise<ArchiveProgress> {
  if (archiving === null) {
    archiving = archivePhone(ctx, source, options).finally(() => { archiving = null; });
  }
  return archiving;
}

export const archiveRunning = (): boolean => archiving !== null;

/** Die Kontakte ins Telefon — nie zweimal zugleich. */
export function contactsNow(ctx: PhoneCtx, source: PhoneSource): ReturnType<typeof toPhone> {
  if (writing === null) writing = toPhone(ctx, source).finally(() => { writing = null; });
  return writing;
}

/** Ein Auftrag des Läufers (`runner.ts`). `locked`: ohne Schlüssel oder Sitzung — Wiederholen hilft nicht. */
export async function runPhoneJob(job: string): Promise<Record<string, unknown>> {
  const who = await whoIsThere();
  if (who === null) return { ok: false, locked: true, error: 'Brak sesji.' };
  const source = bridgeSource();
  if (source === null) return { ok: false, error: 'To nie jest wydanie SMS aplikacji.' };
  let ctx: PhoneCtx;
  try {
    ctx = await openPhone(who);
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict === LOCKED) return { ok: false, locked: true, error: e.message };
    throw e;
  }
  if (job === 'archive') {
    const media = (await remembered(MEDIA_PREF, 'on')) !== 'off';
    return { ok: true, ...(await archivePhone(ctx, source, { media })) };
  }
  if (job === 'contacts') return { ok: true, ...(await toPhone(ctx, source)) };
  return { ok: false, error: 'Nieznane zlecenie.' };
}

let started = false;

/**
 * KURZ NACH DEM START der App (Ausgabe „sms"): merken, dass es das Telefon
 * gibt (dann stehen SMS und Kontakte auch im Browser im Menü), das Adressbuch
 * auffrischen, wenn es länger als zwölf Stunden her ist, und archivieren, was
 * seit einer halben Stunde dazukam.
 */
export function startPhone(who: Who): void {
  if (started || !phoneHere()) return;
  started = true;
  setValue(PHONE_PREF, 'on');
  window.setTimeout(() => {
    void (async () => {
      const status = await Phone.status();
      const ctx = await openPhone(who);
      const hour = 3600_000;
      if (status.contacts && (status.contactsSyncedAt === null || Date.now() - status.contactsSyncedAt > 12 * hour)) {
        await contactsNow(ctx, pluginSource).catch(() => undefined);
      }
      if (status.defaultSms && (status.archivedAt === null || Date.now() - status.archivedAt > hour / 2)) {
        const media = (await remembered(MEDIA_PREF, 'on')) !== 'off';
        await archiveNow(ctx, pluginSource, { media }).catch(() => undefined);
      }
    })().catch(() => undefined);
  }, 8000);
}
