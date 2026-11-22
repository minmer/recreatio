/**
 * 2026-11-22 — WAS EINE KLASSE IST, ohne Netz gerechnet (geprüft in `scripts/app-class-check.mjs`): aus den Schlüsseln, die
 * ein Bereich sich merkt (`area_import_key`), die Baza, die Rolle der Uczniowie und der Link zum Beitreten.
 */

/** Unter diesem Schlüssel (Art `role`) merkt sich die Klasse ihre Uczniowie — derselbe wie in einer Klasse einer Schule. */
export const CLASS_STUDENTS = 'students';
/** Unter diesem Schlüssel (Art `link`) merkt sich die Klasse ihren Link zum Beitreten (den QR-Code). */
export const CLASS_JOIN = 'class-join';
/** Wohin der Link einer Klasse führt (hinter `#/`): die Klasse und ihre Baza — so weiss die Seite auch ohne Konto, was zu lernen ist. */
export const classAim = (areaId: string, libraryId: string): string => `workspace/klasa/${areaId.toLowerCase()}/${libraryId.toLowerCase()}`;

const BASE_PREFIX = 'base-';

export interface KeyLike {
  readonly kind: string;
  readonly key: string;
  readonly refId: string | null;
  readonly refText: string | null;
}

/** Eine Klasse, wie die Listen sie zeigen. */
export interface ClassOf {
  readonly areaId: string;
  readonly name: string;
  /** Die Bazy der Klasse (meist eine). */
  readonly bases: readonly { readonly libraryId: string; readonly name: string }[];
  readonly studentsRoleId: string | null;
  /** Der Link zum Beitreten — `null`: geschlossen (oder eine Klasse ohne Code, etwa ein Kurs). */
  readonly joinInvitationId: string | null;
}

/** Aus den Bereichen mit ihren Schlüsseln die Klassen — nur die mit einer Baza; `libraryId`: nur die mit dieser. */
export function classesIn(areas: readonly { readonly areaId: string; readonly name: string; readonly keys: readonly KeyLike[] }[], libraryId?: string): ClassOf[] {
  const out: ClassOf[] = [];
  const wanted = libraryId?.toLowerCase();
  for (const a of areas) {
    const bases = a.keys
      .filter((k) => k.kind === 'library' && k.key.startsWith(BASE_PREFIX) && k.refId !== null)
      .map((k) => ({ libraryId: k.refId!, name: k.refText ?? '' }));
    if (bases.length === 0) continue;
    if (wanted !== undefined && !bases.some((b) => b.libraryId.toLowerCase() === wanted)) continue;
    const role = a.keys.find((k) => k.kind === 'role' && k.key === CLASS_STUDENTS) ?? null;
    const join = a.keys.find((k) => k.kind === 'link' && k.key === CLASS_JOIN) ?? null;
    out.push({ areaId: a.areaId, name: a.name, bases, studentsRoleId: role?.refId ?? null, joinInvitationId: join?.refId ?? null });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Klasse und Baza aus der Adresse `#/workspace/klasa/<klasse>/<baza>` — `null`: keine gültige. */
export function classIdOf(trail: readonly string[]): { readonly areaId: string; readonly libraryId: string } | null {
  const [areaId = '', libraryId = ''] = trail;
  return UUID.test(areaId) && UUID.test(libraryId) ? { areaId: areaId.toLowerCase(), libraryId: libraryId.toLowerCase() } : null;
}

/** Der Teil der App, den jemand sieht: die ganze Werkstatt oder nur die Nauka (wer über eine Klasse ein Konto anlegte). */
export type ShellChoice = 'full' | 'learn';
/** Unter diesem Namen merkt das Konto die Wahl (versiegelt, `core/prefs.ts`). */
export const SHELL_PREF = 'shell';
export const readShell = (value: string | null | undefined): ShellChoice => (value === 'learn' ? 'learn' : 'full');

/**
 * Was die kleine Werkstatt zeigen darf — alles andere führt zurück in die Nauka. `account`: Sprache, Wygląd, Hasło.
 * Die Nauka mit ihren Bazy und die Klasse; sonst nichts.
 */
export function learnShellAllows(view: string | null, trail: readonly string[]): boolean {
  if (view === 'learn' || view === 'klasa') return true;
  if (view === 'account') return trail.length === 0 || ['jezyk', 'wyglad', 'bezpieczenstwo'].includes(trail[0] ?? '');
  return false;
}
