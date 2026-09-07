/*
  Was ein Teil ueber seine Umgebung wissen darf.

  <b>Uebernommen aus dem alten Veranstaltungsmodul</b>, weil das dort gut
  geloest ist: ein Teil ist eine reine Ansicht ueber `configJson`, und was er
  sonst braucht, bekommt er im Zusammenhang gereicht. Neue Teile brauchen
  weder an der Huelle noch am Herausgeber noch am Dienst eine Aenderung.

  <b>Was sich gegenueber dem alten Modul geaendert hat.</b>

  Die Adresse ist ZWEITEILIG: `collectionSlug` und `siteSlug`. Der Name einer
  Veranstaltung ist nur innerhalb ihrer Seite eindeutig; ein Teil, der einen
  Verweis auf sich selbst baut, braucht deshalb beide Haelften — mit einer
  landete er womoeglich beim Fest einer fremden Pfarrei.

  `accessToken` gibt es nicht mehr. Im alten Modul war der Link zur internen
  Seite das Geheimnis; hier liegt Internes unter dem Epochenschluessel des
  Bereichs, und ob der Leser dazugehoert, sagt `mayRead`. Ein Geheimnis, das
  in einer Adresse steht, steht auch im Verlauf des Browsers.
*/

import { createElement, type ComponentType } from 'react';
import type { RcApi } from '../../lib/rcApi';

export type EventPart = RcApi<'EventsPartView'>;

/**
 * Die Arten, aus denen eine Veranstaltung gebaut wird.
 *
 * <b>Dieselbe Liste wie im Dienst</b> (`RcEvents.PartKinds`). Laufen sie
 * auseinander, weist der Dienst eine Art ab, die der Herausgeber gerade
 * angeboten hat — und das sieht aus wie ein Fehler des Benutzers.
 */
export type EventPartKind = string;

/** What a part renderer is allowed to know about its surroundings. */
export type PartContext = {
  /** Die Seite des Veranstalters — die erste Haelfte der Adresse. */
  collectionSlug: string;
  /** Die Veranstaltung — die zweite Haelfte. */
  siteSlug: string;
  /** The page this part is being rendered on — a part that links elsewhere needs it. */
  pageSlug: string;
  /** For anything that has to name the event — a printed consent, say. */
  siteTitle: string;
  siteDateLabel: string | null;
  sitePlaces: string[];
  /**
   * Gehoert der Leser zur VERWALTUNG? Ersetzt die Haelfte des `accessToken`,
   * die im alten Modul „darf aendern" hiess: dort entschied ein Geheimnis in
   * der Adresse, hier der Schluessel des Bereichs.
   */
  mayRead: boolean;

  /**
   * Der Beleg der Anmeldung — die andere Haelfte des alten `accessToken`.
   *
   * <b>So weist sich ein Teilnehmer OHNE Konto aus.</b> Er hat ihn beim
   * Anmelden einmal bekommen, und mit ihm kann er seine Anmeldung auch
   * zuruecknehmen. Ein zweites Geheimnis daneben zu stellen hiesse zwei
   * Sperren zu pflegen, und beim naechsten Umbau vergisst jemand die zweite.
   *
   * <b>Er steht NICHT in der Adresse</b>, anders als der Link des alten
   * Moduls. Dort stuende er im Verlauf des Browsers, im Verweis der naechsten
   * Seite und im Protokoll jedes Zwischenservers. Er wird einmal eingegeben
   * und haelt, solange die Karte offen ist.
   *
   * `null` heisst: niemand hat sich ausgewiesen. Teile, die davon leben,
   * sagen es dann und zeigen nicht einfach nichts.
   */
  claim: string | null;

  /**
   * Der oeffentliche Annahmeschluessel der Veranstaltung, base64url.
   *
   * Damit verschliesst der Browser, was ein Teilnehmer OHNE Konto abgibt —
   * Anmeldung wie Teilnehmerkarte. Der Dienst legt danach Bytes ab, die er
   * nicht oeffnen kann; das ist die ganze Zusage, und sie faellt, wenn hier
   * jemand Klartext schickt.
   *
   * `null` heisst: diese Veranstaltung nimmt nichts entgegen.
   */
  intakePublicKey: string | null;
  part: EventPart;
};

export type PartEditorContext = {
  part: EventPart;
  /** For a part whose settings are drawn from the event's own data. */
  siteId: string;
  /**
   * Whether the page this part sits on is open to everyone. A part that shows
   * other people's data has to be able to say so while it is being built, not
   * after it has been published.
   */
  pageKind: 'public' | 'internal';
  /** Called after a change that lives outside ConfigJson (form fields). */
  onStructureChanged: () => void;
};

/**
 * A part module owns everything about one kind of slide: its config shape, how
 * that config survives bad JSON, how it renders, and how it is edited. The
 * registry only ever sees the erased JSON-in / JSON-out form below, so parts can
 * be added without touching the shell.
 */
export type PartRendererProps = { configJson: string | null; ctx: PartContext };

export type PartEditorProps = {
  configJson: string | null;
  onChange: (json: string) => void;
  ctx: PartEditorContext;
};

export type PartModule = {
  kind: EventPartKind;
  label: string;
  description: string;
  defaultConfigJson: () => string;
  /** Worked example for the JSON dictionary — richer than the blank default. */
  exampleConfigJson: () => string;
  Renderer: ComponentType<PartRendererProps>;
  Editor: ComponentType<PartEditorProps>;
  /**
   * The tolerant reader on its own, JSON in and config out.
   *
   * It exists so the round trip the builder performs on every keystroke —
   * config to JSON, JSON back to config — can be exercised without a browser.
   * That round trip is where a newly added, still-empty entry used to vanish,
   * and the "add" button appeared to do nothing at all.
   */
  readConfigJson: (configJson: string | null) => unknown;
};

/**
 * Wraps a typed part so the registry can hold it alongside differently-typed
 * ones. The inner renderer and editor are mounted as real components via
 * createElement rather than called as functions, so a part is free to use hooks.
 */
export function definePart<C>(spec: {
  kind: EventPartKind;
  label: string;
  description: string;
  defaultConfig: () => C;
  /** Only for the dictionary; parts whose default is empty should supply one. */
  example?: () => C;
  parse: (raw: unknown) => C;
  Renderer: ComponentType<{ config: C; ctx: PartContext }>;
  Editor: ComponentType<{ config: C; onChange: (next: C) => void; ctx: PartEditorContext }>;
}): PartModule {
  const read = (configJson: string | null): C => spec.parse(parseJson(configJson));

  const Renderer: ComponentType<PartRendererProps> = ({ configJson, ctx }) =>
    createElement(spec.Renderer, { config: read(configJson), ctx });
  Renderer.displayName = `EventPart(${spec.kind})`;

  const Editor: ComponentType<PartEditorProps> = ({ configJson, onChange, ctx }) =>
    createElement(spec.Editor, {
      config: read(configJson),
      onChange: (next: C) => onChange(JSON.stringify(next, null, 2)),
      ctx
    });
  Editor.displayName = `EventPartEditor(${spec.kind})`;

  return {
    kind: spec.kind,
    label: spec.label,
    description: spec.description,
    defaultConfigJson: () => JSON.stringify(spec.defaultConfig(), null, 2),
    exampleConfigJson: () => JSON.stringify((spec.example ?? spec.defaultConfig)(), null, 2),
    Renderer,
    Editor,
    readConfigJson: read
  };
}

// ── Tolerant readers ─────────────────────────────────────────────────────────
// Config is authored in the editor and can be half-finished at any moment. Every
// reader below returns a usable value instead of throwing, so one bad field can
// never blank a page.

export function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function asStringList(value: unknown): string[] {
  return asArray(value)
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Maps an array of unknowns through a reader, dropping the ones that fail. */
export function mapEntries<T>(value: unknown, read: (record: Record<string, unknown>) => T | null): T[] {
  const result: T[] = [];
  for (const entry of asArray(value)) {
    const mapped = read(asRecord(entry));
    if (mapped !== null) result.push(mapped);
  }
  return result;
}
