/**
 * DIE TEILE DER STARTSEITE UND DES BEREICHS (0094, 2026-10-16).
 *
 * Bis 2026-10-16 stand hier ein Baukasten: „Widoki" mit Teilen, die man
 * hinzufügen, verschieben, je Teil anders zeigen, speichern und als JSON
 * („recreatio.view") hinaus- und hereintragen konnte. Jede dieser Wahlen stand
 * auf der Seite selbst, vor dem, was sie zeigen sollte. Jetzt sind „Teraz" und
 * der Überblick eines Bereichs feste Seiten (`WorkspaceHome.tsx`); hier bleibt,
 * welche Teile es gibt, wie sie heissen und welche Bereiche ein Teil zeigt.
 *
 * Gemerkte Widoki (Wert `workspace.views` der Einstellungen) bleiben liegen und
 * werden nicht mehr gelesen — nichts muss umgezogen werden.
 */

import { t } from '../core/i18n';

export type PartKind = 'mypages' | 'alerts' | 'agenda' | 'tasks' | 'chats' | 'forms' | 'pages' | 'access' | 'people' | 'learn';

export interface PartDef {
  readonly kind: PartKind;
  readonly label: string;
  readonly says: string;
  /** Nur mit einem Bereich sinnvoll (die Menschen EINES Bereichs). */
  readonly areaOnly?: boolean;
}

/** Bezeichnung und Erklärung werden erst beim Lesen übersetzt. */
const partOf = (kind: PartKind, areaOnly?: true): PartDef => ({
  kind, ...(areaOnly ? { areaOnly } : {}),
  get label() { return t(`workspace.part.${kind}.label`); },
  get says() { return t(`workspace.part.${kind}.says`); }
});

export const PART_DEFS: readonly PartDef[] = [
  partOf('mypages'),
  partOf('alerts'),
  partOf('agenda'),
  partOf('tasks'),
  partOf('chats'),
  partOf('forms'),
  partOf('pages'),
  partOf('access'),
  partOf('people', true),
  /* 0109 — Nauka: was jetzt dran ist. */
  partOf('learn')
];

const KNOWN_PART = new Map(PART_DEFS.map((one) => [one.kind, one]));

export const partDef = (kind: PartKind): PartDef => KNOWN_PART.get(kind)!;

export interface PartConfig {
  readonly kind: PartKind;
  readonly mode: string;
}

export type ViewKind = 'mine' | 'area';

/** Was ein Teil über die Seite wissen muss, auf der er steht. */
export interface ViewConfig {
  readonly id: string;
  readonly name: string;
  readonly kind: ViewKind;
  /** Welche Bereiche — leer: alle (bei `area` der Bereich und alles darin). */
  readonly areaIds: readonly string[];
  readonly parts: readonly PartConfig[];
}

export const MINE = 'mine';

/** Der Überblick eines Bereichs — in dieser Reihenfolge (`WorkspaceHome.tsx`, `AreaOverview`). */
export const AREA_PARTS: readonly PartConfig[] = [
  { kind: 'alerts', mode: 'list' },
  { kind: 'agenda', mode: 'week' },
  { kind: 'chats', mode: 'all' },
  { kind: 'forms', mode: 'list' },
  { kind: 'people', mode: 'list' },
  { kind: 'pages', mode: 'list' },
  { kind: 'access', mode: 'links' }
];

export const areaViewId = (areaId: string) => `area:${areaId}`;

/** Ein Bereich, wie ihn die Teile brauchen. */
export interface ViewArea {
  readonly areaId: string;
  readonly name: string;
  readonly parentAreaId: string | null;
  readonly personal?: boolean;
}

/** Der Bereich und alles darin. */
export function withInside(areas: readonly ViewArea[], areaIds: readonly string[]): string[] {
  const out = new Set(areaIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const one of areas) {
      if (one.parentAreaId !== null && out.has(one.parentAreaId) && !out.has(one.areaId)) { out.add(one.areaId); grew = true; }
    }
  }
  return [...out];
}

/** Welche Bereiche ein Teil wirklich zeigt — `null`: alle. */
export function scopeOf(view: ViewConfig, areas: readonly ViewArea[]): ReadonlySet<string> | null {
  if (view.areaIds.length === 0) return null;
  return new Set(withInside(areas, view.areaIds));
}
