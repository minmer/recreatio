/**
 * WIDOKI (0094) — was die Seite des Warsztat zeigt.
 *
 * <b>Ein Widok beschreibt die Seite des Arbeitsplatzes</b>: welche Teile
 * darauf stehen, in welcher Reihenfolge, und wie jeder sich zeigt (der Weg
 * im Auswahlfeld an seinem Kopf). Drei Arten:
 *
 * <code>
 *   mine   „Mój widok" — alles, was ich habe; gibt es immer
 *   area   „Widok obszaru" — einer je Bereich, von selbst; zeigt nur, was zu
 *          diesem Bereich (und den Bereichen darin) gehört
 *   own    eigene Widoki — Name, Teile, und welche Bereiche (oder alle)
 * </code>
 *
 * Gemerkt wird für das Konto (versiegelt, `prefs.ts`, Wert `workspace.views`):
 * welcher Widok zuletzt offen war, die eigenen, und was an „Mój widok" und an
 * den Widoki der Bereiche geändert wurde. Ein Widok obszaru ohne Änderung
 * entsteht jedes Mal neu aus der Vorgabe — ein neuer Teil der Vorgabe kommt so
 * auch bei allen an, die nichts geändert haben.
 *
 * Hier steht nur das Rechnen (geprüft in `app-platform-check.mjs`); gezeichnet
 * wird in `WorkspaceHome.tsx` und `ViewParts.tsx`.
 */

import type { DisplayMode } from './display';

export type PartKind = 'alerts' | 'agenda' | 'tasks' | 'chats' | 'forms' | 'pages' | 'access' | 'people' | 'quick' | 'recent' | 'starters' | 'tiles';

export interface PartDef {
  readonly kind: PartKind;
  readonly label: string;
  readonly says: string;
  /** Die Wege, sich zu zeigen — der erste ist die Vorgabe. */
  readonly modes: readonly DisplayMode[];
  /** Nur in einem Widok mit Bereich sinnvoll (die Menschen EINES Bereichs). */
  readonly areaOnly?: boolean;
  /** Gehört keinem Bereich (Na skróty, Ostatnio): gleich in jedem Widok. */
  readonly everywhere?: boolean;
}

const mode = (id: string, label: string, says: string, extended = false): DisplayMode => ({ id, label, says, extended });

export const PART_DEFS: readonly PartDef[] = [
  { kind: 'alerts', label: 'Czeka na Ciebie', says: 'Nowe zgłoszenia, wiadomości, rezerwacje, zaległe kroki — w Twojej kolejności.', modes: [
    mode('list', 'Lista', 'Każda rzecz osobno.'),
    mode('compact', 'Zwarte', 'Jedna linijka na rodzaj, z sumą.')
  ] },
  { kind: 'agenda', label: 'Najbliższe terminy', says: 'Spotkania, msze i inne terminy z kalendarza.', modes: [
    mode('today', 'Dziś i jutro', 'Terminy na dziś i jutro.'),
    mode('week', '7 dni', 'Terminy na najbliższy tydzień.'),
    mode('calendar', 'Kalendarz', 'Pełny kalendarz — dzień, tydzień, miesiąc.', true)
  ] },
  { kind: 'tasks', label: 'Zadania', says: 'Co jest do zrobienia teraz i co zalega.', modes: [
    mode('now', 'Na teraz i zaległe', 'Tylko to, co trzeba zrobić teraz.'),
    mode('all', 'Wszystkie otwarte', 'Także zadania na później.')
  ] },
  { kind: 'chats', label: 'Rozmowy', says: 'Rozmowy obszarów i osób.', modes: [
    mode('unread', 'Nieprzeczytane', 'Tylko rozmowy z nowymi wiadomościami.'),
    mode('all', 'Wszystkie', 'Wszystkie rozmowy, ostatnie na górze.')
  ] },
  { kind: 'forms', label: 'Formularze', says: 'Formularze z liczbą zgłoszeń i nowymi.', modes: [
    mode('list', 'Lista', 'Wszystkie formularze.'),
    mode('fresh', 'Tylko z nowymi', 'Tylko formularze, w których jest coś nowego.')
  ] },
  { kind: 'pages', label: 'Strony', says: 'Strony — otwórz, edytuj, udostępnij.', modes: [
    mode('list', 'Lista', 'Strony z przyciskami.')
  ] },
  { kind: 'access', label: 'Dostęp', says: 'Linki, przez które inni mają dostęp — i nowy link.', modes: [
    mode('links', 'Linki', 'Działające linki i „Udostępnij".'),
    mode('full', 'Linki ze szczegółami', 'Tworzenie, cele, wyłączanie, linki w tej przeglądarce.', true)
  ] },
  { kind: 'people', label: 'Osoby', says: 'Kto należy do obszaru.', areaOnly: true, modes: [
    mode('list', 'Lista', 'Imiona i to, co kto może.'),
    mode('full', 'Role i poziomy', 'Wszystkie role obszaru, z dodawaniem.', true)
  ] },
  { kind: 'quick', label: 'Na skróty', says: 'Najczęstsze miejsca jednym kliknięciem.', everywhere: true, modes: [
    mode('buttons', 'Przyciski', 'Kalendarz, zadania, rozmowy, formularze, szukaj.')
  ] },
  { kind: 'recent', label: 'Ostatnio', says: 'Ostatnio otwierane strony, moduły i obszary.', everywhere: true, modes: [
    mode('chips', 'Lista', 'Ostatnio otwierane.')
  ] },
  { kind: 'starters', label: 'Co chcesz zrobić?', says: 'Gotowe początki: zapisy na wydarzenie, nowa grupa.', everywhere: true, modes: [
    mode('cards', 'Karty', 'Kilka pytań i wszystko gotowe.')
  ] },
  { kind: 'tiles', label: 'Wszystkie części warsztatu', says: 'Kafelki: kalendarz, msze, rezerwacje, biblioteka…', everywhere: true, modes: [
    mode('main', 'Najważniejsze', 'Części, z których korzysta się na co dzień.'),
    mode('all', 'Wszystkie', 'Także role, adresy i domeny.', true)
  ] }
];

const KNOWN_PART = new Map(PART_DEFS.map((one) => [one.kind, one]));

export const partDef = (kind: PartKind): PartDef => KNOWN_PART.get(kind)!;

/** Der Weg eines Teils zu einer Kennung — eine unbekannte fällt auf die Vorgabe. */
export const partMode = (kind: PartKind, id: string | null | undefined): DisplayMode => {
  const def = partDef(kind);
  return def.modes.find((one) => one.id === id) ?? def.modes[0];
};

export interface PartConfig {
  readonly kind: PartKind;
  readonly mode: string;
}

export type ViewKind = 'mine' | 'area' | 'own';

export interface ViewConfig {
  readonly id: string;
  readonly name: string;
  readonly kind: ViewKind;
  /** Welche Bereiche — leer: alle (bei `area` der Bereich und alles darin). */
  readonly areaIds: readonly string[];
  readonly parts: readonly PartConfig[];
}

export interface ViewsState {
  /** Welcher Widok zuletzt offen war. */
  readonly current: string;
  readonly own: readonly ViewConfig[];
  /** Was an „Mój widok" und an den Widoki der Bereiche geändert wurde — je Kennung. */
  readonly changed: Readonly<Record<string, { readonly name?: string; readonly parts: readonly PartConfig[] }>>;
}

export const MINE = 'mine';
export const EMPTY_VIEWS: ViewsState = { current: MINE, own: [], changed: {} };

export const MINE_PARTS: readonly PartConfig[] = [
  { kind: 'alerts', mode: 'list' },
  { kind: 'agenda', mode: 'today' },
  { kind: 'quick', mode: 'buttons' },
  { kind: 'recent', mode: 'chips' },
  { kind: 'starters', mode: 'cards' },
  { kind: 'tiles', mode: 'main' }
];

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

/** Ein Bereich, wie ihn die Widoki brauchen. */
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

/* -- Lesen, duldsam ---------------------------------------------------------------------- */

/** Teile aus irgendetwas: Unbekanntes fällt weg, ein unbekannter Weg wird die Vorgabe, Bereichsteile nur, wo erlaubt. */
export function readParts(value: unknown, areaAllowed = true): PartConfig[] {
  if (!Array.isArray(value)) return [];
  const out: PartConfig[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const kind = (raw as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || !KNOWN_PART.has(kind as PartKind)) continue;
    const def = KNOWN_PART.get(kind as PartKind)!;
    if (def.areaOnly === true && !areaAllowed) continue;
    out.push({ kind: def.kind, mode: partMode(def.kind, (raw as { mode?: unknown }).mode as string).id });
  }
  return out;
}

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && one.length <= 64) : []);

export function readViewsState(json: string | null | undefined): ViewsState {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(json ?? '') as Record<string, unknown>; } catch { return EMPTY_VIEWS; }
  if (typeof raw !== 'object' || raw === null) return EMPTY_VIEWS;

  const own: ViewConfig[] = [];
  for (const one of Array.isArray(raw.own) ? raw.own : []) {
    if (typeof one !== 'object' || one === null) continue;
    const r = one as Record<string, unknown>;
    const id = text(r.id, 64);
    if (id === '' || !id.startsWith('own:') || own.some((v) => v.id === id)) continue;
    const areaIds = ids(r.areaIds);
    own.push({ id, name: text(r.name, 80) || 'Mój widok', kind: 'own', areaIds, parts: readParts(r.parts, areaIds.length > 0) });
  }

  const changed: Record<string, { name?: string; parts: PartConfig[] }> = {};
  if (typeof raw.changed === 'object' && raw.changed !== null) {
    for (const [id, value] of Object.entries(raw.changed as Record<string, unknown>)) {
      if (id !== MINE && !id.startsWith('area:')) continue;
      if (typeof value !== 'object' || value === null) continue;
      const name = text((value as Record<string, unknown>).name, 80);
      changed[id] = { ...(name === '' ? {} : { name }), parts: readParts((value as Record<string, unknown>).parts, id !== MINE) };
    }
  }

  return { current: text(raw.current, 64) || MINE, own, changed };
}

export const viewsJson = (state: ViewsState): string => JSON.stringify(state);

/* -- Die Widoki ---------------------------------------------------------------------------- */

export function mineView(state: ViewsState): ViewConfig {
  const changed = state.changed[MINE];
  return { id: MINE, name: changed?.name ?? 'Mój widok', kind: 'mine', areaIds: [], parts: changed?.parts ?? MINE_PARTS };
}

export function areaView(state: ViewsState, area: ViewArea): ViewConfig {
  const id = areaViewId(area.areaId);
  const changed = state.changed[id];
  return { id, name: changed?.name ?? area.name, kind: 'area', areaIds: [area.areaId], parts: changed?.parts ?? AREA_PARTS };
}

/** Alle Widoki: „Mój widok", die eigenen, dann einer je Bereich (ohne den eigenen, privaten). */
export function allViews(state: ViewsState, areas: readonly ViewArea[]): ViewConfig[] {
  return [
    mineView(state),
    ...state.own,
    ...areas.filter((a) => a.personal !== true).map((a) => areaView(state, a))
  ];
}

/** Welche Bereiche ein Widok wirklich zeigt — `null`: alle. */
export function scopeOf(view: ViewConfig, areas: readonly ViewArea[]): ReadonlySet<string> | null {
  if (view.areaIds.length === 0) return null;
  return new Set(withInside(areas, view.areaIds));
}

/* -- Ändern ---------------------------------------------------------------------------------- */

/** Einen Widok so speichern, wie er jetzt ist. */
export function saveView(state: ViewsState, view: ViewConfig): ViewsState {
  if (view.kind === 'own') {
    return { ...state, own: state.own.map((one) => (one.id === view.id ? view : one)) };
  }
  return { ...state, changed: { ...state.changed, [view.id]: { name: view.name, parts: view.parts } } };
}

/** Einen geänderten „Mój widok" / Widok obszaru wieder auf die Vorgabe. */
export function resetView(state: ViewsState, id: string): ViewsState {
  const changed = { ...state.changed };
  delete changed[id];
  return { ...state, changed };
}

export function newView(state: ViewsState, name: string, from: ViewConfig, id: string): ViewsState {
  const view: ViewConfig = {
    id, name: name.trim() === '' ? 'Nowy widok' : name.trim().slice(0, 80), kind: 'own',
    areaIds: [...from.areaIds],
    parts: from.parts.filter((p) => from.areaIds.length > 0 || partDef(p.kind).areaOnly !== true)
  };
  return { ...state, own: [...state.own, view], current: id };
}

export function removeView(state: ViewsState, id: string): ViewsState {
  return { ...state, own: state.own.filter((one) => one.id !== id), current: state.current === id ? MINE : state.current };
}

export const pick = (state: ViewsState, id: string): ViewsState => (state.current === id ? state : { ...state, current: id });

export function setPartMode(view: ViewConfig, index: number, modeId: string): ViewConfig {
  return { ...view, parts: view.parts.map((p, i) => (i === index ? { ...p, mode: partMode(p.kind, modeId).id } : p)) };
}

export function movePart(view: ViewConfig, index: number, by: -1 | 1): ViewConfig {
  const to = index + by;
  if (to < 0 || to >= view.parts.length) return view;
  const parts = [...view.parts];
  [parts[index], parts[to]] = [parts[to], parts[index]];
  return { ...view, parts };
}

export const removePart = (view: ViewConfig, index: number): ViewConfig => ({ ...view, parts: view.parts.filter((_, i) => i !== index) });

export function addPart(view: ViewConfig, kind: PartKind): ViewConfig {
  if (partDef(kind).areaOnly === true && view.areaIds.length === 0) return view;
  return { ...view, parts: [...view.parts, { kind, mode: partDef(kind).modes[0].id }] };
}

/** Welche Teile sich zu diesem Widok hinzufügen lassen. */
export const addable = (view: ViewConfig): PartDef[] => PART_DEFS.filter((def) => def.areaOnly !== true || view.areaIds.length > 0);

/* -- JSON (0094: wie alles andere hinaus und herein) ------------------------------------------------ */

export const VIEW_FORMAT = 'recreatio.view';

export function exportView(view: ViewConfig, areas: readonly ViewArea[]): Record<string, unknown> {
  return {
    format: VIEW_FORMAT,
    version: 1,
    name: view.name,
    areas: view.areaIds.map((id) => ({ id, name: areas.find((a) => a.areaId === id)?.name ?? null })),
    parts: view.parts.map((p) => ({ kind: p.kind, mode: p.mode }))
  };
}

/**
 * Ein Dokument als Widok — für DIESEN Widok (sein Name und seine Bereiche
 * bleiben, wenn er keiner der eigenen ist). Bereiche werden an der Kennung
 * erkannt, sonst am Namen; was keiner ist, wird gesagt und übergangen.
 */
export function planViewImport(doc: unknown, into: ViewConfig, areas: readonly ViewArea[]): { view: ViewConfig; warnings: string[] } | { error: string } {
  if (typeof doc !== 'object' || doc === null) return { error: 'To nie jest dokument JSON z widokiem.' };
  const raw = doc as Record<string, unknown>;
  if (raw.format !== undefined && raw.format !== VIEW_FORMAT) return { error: `To dokument „${String(raw.format)}”, a tutaj importuje się „${VIEW_FORMAT}”.` };
  if (!Array.isArray(raw.parts)) return { error: 'Brakuje listy "parts".' };

  const warnings: string[] = [];
  let areaIds = into.areaIds;
  if (into.kind === 'own' && Array.isArray(raw.areas)) {
    const found: string[] = [];
    for (const one of raw.areas) {
      const r = (typeof one === 'object' && one !== null ? one : {}) as Record<string, unknown>;
      const hit = areas.find((a) => a.areaId === r.id) ?? areas.find((a) => typeof r.name === 'string' && a.name.toLowerCase() === r.name.trim().toLowerCase());
      if (hit === undefined) warnings.push(`Obszar ${typeof r.name === 'string' ? `„${r.name}”` : String(r.id)} — nie ma go u Ciebie, pominięty.`);
      else if (!found.includes(hit.areaId)) found.push(hit.areaId);
    }
    areaIds = found;
  }

  const parts = readParts(raw.parts, areaIds.length > 0);
  const dropped = raw.parts.length - parts.length;
  if (dropped > 0) warnings.push(`${dropped === 1 ? 'Jedna część' : `${dropped} części`} — nieznana albo tylko dla widoku obszaru, pominięta.`);

  const name = into.kind === 'own' && typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim().slice(0, 80) : into.name;
  return { view: { ...into, name, areaIds, parts }, warnings };
}

export function viewDescription(): string {
  return `# Widok jako JSON ("${VIEW_FORMAT}", wersja 1)

Widok opisuje stronę warsztatu: jakie części na niej stoją, w jakiej kolejności i jak każda się pokazuje.
Import zmienia OTWARTY widok. W „Mój widok" i w widoku obszaru zmieniają się tylko części; we własnym widoku także nazwa i obszary.

  "format" — "${VIEW_FORMAT}"
  "version" — 1
  "name" — nazwa widoku
  "areas" — obszary widoku (tylko we własnym widoku); pusta lista — wszystkie:
      "id" — identyfikator obszaru (z eksportu); gdy u Ciebie go nie ma, obszar rozpoznaje się po nazwie
      "name" — nazwa obszaru
  "parts" — części po kolei, od góry:
      "kind" — rodzaj części (lista niżej)
      "mode" — sposób wyświetlania; brak albo nieznany — pierwszy z listy

Części ("kind") i ich sposoby wyświetlania ("mode"; pierwszy jest domyślny):
${PART_DEFS.map((def) => `  "${def.kind}" — ${def.label}: ${def.says}${def.areaOnly === true ? ' Tylko w widoku z obszarem.' : ''}
${def.modes.map((m) => `      "${m.id}" — ${m.label}${m.extended ? ' (rozszerzony)' : ''}: ${m.says}`).join('\n')}`).join('\n')}

Przykład:
${JSON.stringify(viewExample(), null, 2)}
`;
}

export const viewExample = (): Record<string, unknown> => ({
  format: VIEW_FORMAT, version: 1, name: 'Bierzmowanie — na co dzień',
  areas: [{ id: '<id-obszaru>', name: 'Bierzmowanie' }],
  parts: [{ kind: 'alerts', mode: 'list' }, { kind: 'forms', mode: 'fresh' }, { kind: 'chats', mode: 'unread' }, { kind: 'agenda', mode: 'week' }]
});
