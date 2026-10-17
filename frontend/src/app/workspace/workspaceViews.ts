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

export type PartKind = 'mypages' | 'alerts' | 'agenda' | 'tasks' | 'chats' | 'forms' | 'pages' | 'access' | 'people' | 'learn';

export interface PartDef {
  readonly kind: PartKind;
  readonly label: string;
  readonly says: string;
  /** Nur mit einem Bereich sinnvoll (die Menschen EINES Bereichs). */
  readonly areaOnly?: boolean;
}

export const PART_DEFS: readonly PartDef[] = [
  { kind: 'mypages', label: 'Twoje strony', says: 'Strony, na których pracujesz — także przygotowane przez kogoś innego (np. strona Twojej grupy).' },
  { kind: 'alerts', label: 'Czeka na Ciebie', says: 'Nowe zgłoszenia, wiadomości, rezerwacje, zaległe kroki — w Twojej kolejności.' },
  { kind: 'agenda', label: 'Najbliższe terminy', says: 'Spotkania, msze i inne terminy z kalendarza.' },
  { kind: 'tasks', label: 'Zadania', says: 'Co jest do zrobienia teraz i co zalega.' },
  { kind: 'chats', label: 'Rozmowy', says: 'Rozmowy obszarów i osób.' },
  { kind: 'forms', label: 'Formularze', says: 'Formularze z liczbą zgłoszeń i nowymi.' },
  { kind: 'pages', label: 'Strony', says: 'Strony — otwórz, edytuj, udostępnij.' },
  { kind: 'access', label: 'Dostęp', says: 'Linki, przez które inni mają dostęp — i nowy link.' },
  { kind: 'people', label: 'Osoby', says: 'Kto należy do obszaru.', areaOnly: true },
  /* 0109 — Nauka: was jetzt dran ist. */
  { kind: 'learn', label: 'Nauka', says: 'Powtórki na teraz, bazy wiedzy i trwające sesje.' }
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
