/**
 * WEM DAS ARCHIV DER SMS GEHÖRT UND WAS HINEINKOMMT — am Konto gemerkt
 * (`sms.archive`), also für jedes Telefon dasselbe: ein altes, das seine
 * Geschichte beiträgt, archiviert in dasselbe Archiv wie das neue.
 *
 * <b>Einer Rolle gehört es.</b> Gespeichert wird in einem Bereich, den diese
 * Rolle führt: für die eigene Person ihr „Prywatne", für eine andere Rolle
 * (etwa „Kancelaria") ein eigener Bereich „Archiwum SMS". Wer die Rolle hat —
 * oder sie später übernimmt —, liest das Archiv, auch im Browser.
 *
 * <b>Ein Wechsel beginnt ein neues Archiv</b> in einem anderen Bereich; das
 * alte bleibt lesbar. Wer zurückwechselt, findet seins wieder (`areas`).
 */

import { createArea, loadAreas, type AreaRow } from '../areas/area';
import { ensurePrivateArea } from '../calendar/agenda';
import { remembered, setValue } from '../core/prefs';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { selfOf } from '../roles/roles';
import { PHONE_PREF } from './here';
import type { ArchiveChoice } from './smsArchive';

export const ARCHIVE_PREF = 'sms.archive';

export interface ArchiveSettings extends ArchiveChoice {
  /** Die Rolle, der das Archiv gehört — `null`: noch nicht gewählt (die eigene Person). */
  readonly roleId: string | null;
  /** Ihr Bereich, in dem es liegt — `null`: noch nicht angelegt. */
  readonly areaId: string | null;
  /** Je Rolle der Bereich, der einmal ihr Archiv war. */
  readonly areas: Readonly<Record<string, string>>;
}

export const DEFAULT_SETTINGS: ArchiveSettings = { roleId: null, areaId: null, areas: {}, mode: 'all', chosen: [] };

/** Tolerant gelesen: was fehlt oder nicht passt, ist die Vorgabe. */
export function readSettings(text: string): ArchiveSettings {
  try {
    const o = JSON.parse(text) as Partial<ArchiveSettings>;
    const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
    const areas: Record<string, string> = {};
    if (o.areas !== null && typeof o.areas === 'object') {
      for (const [role, area] of Object.entries(o.areas)) if (typeof area === 'string') areas[role] = area;
    }
    return {
      roleId: str(o.roleId),
      areaId: str(o.areaId),
      areas,
      mode: o.mode === 'chosen' ? 'chosen' : 'all',
      chosen: Array.isArray(o.chosen) ? [...new Set(o.chosen.filter((k): k is string => typeof k === 'string'))] : []
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const settingsText = (s: ArchiveSettings): string => JSON.stringify({ v: 1, ...s });

export async function archiveSettings(): Promise<ArchiveSettings> {
  return readSettings(await remembered(ARCHIVE_PREF, ''));
}

export function saveSettings(s: ArchiveSettings): void {
  setValue(ARCHIVE_PREF, settingsText(s));
  /* Wer ein Archiv hat, sieht SMS auch im Browser im Menü. */
  setValue(PHONE_PREF, 'on');
}

/** Ein Archiv gilt, wenn ich in seinem Bereich schreiben darf. */
const writable = (areas: readonly AreaRow[], areaId: string | null | undefined): boolean =>
  areaId != null && areas.some((a) => a.areaId === areaId && (a.myLevel === 'write' || a.myLevel === 'admin'));

/**
 * WOHIN ARCHIVIERT WIRD — der Bereich der gewählten Rolle; fehlt er (noch nie gewählt,
 * oder die Rolle wurde gerade gewählt), wird er hier angelegt und gemerkt.
 */
export async function archiveArea(who: Who, settings?: ArchiveSettings): Promise<{ areaId: string; settings: ArchiveSettings }> {
  const s = settings ?? await archiveSettings();
  let { areas } = await loadAreas();
  if (writable(areas, s.areaId)) return { areaId: s.areaId!, settings: s };

  const { ring, graph } = await keysFor(who);
  if (ring === null) throw new WorkspaceError('Klucz jest zamknięty — odblokuj go hasłem.', 'locked');
  const person = selfOf(graph);
  const role = graph.roles.find((r) => r.id === s.roleId && ring.has(r.id)) ?? person;
  if (role === null || role === undefined) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby.', 'locked');

  let areaId = s.areas[role.id];
  if (!writable(areas, areaId)) {
    /* Die eigene Person: ihr „Prywatne". Jede andere Rolle (auch eine zweite Person): ein eigener Bereich. */
    if (person !== null && role.id === person.id) {
      areaId = await ensurePrivateArea(ring, role, areas);
    } else {
      if (!ring.maySign(role.id)) throw new WorkspaceError('Tą rolą nie możesz założyć obszaru — wybierz inną.');
      areaId = (await createArea(ring, role, 'Archiwum SMS')).areaId;
      ({ areas } = await loadAreas());
    }
  }
  const next: ArchiveSettings = { ...s, roleId: role.id, areaId: areaId!, areas: { ...s.areas, [role.id]: areaId! } };
  saveSettings(next);
  return { areaId: areaId!, settings: next };
}
