import { createElement, type ComponentType } from 'react';
import type { EventPart, EventPartKind } from '../../../lib/api';

/** What a part renderer is allowed to know about its surroundings. */
export type PartContext = {
  siteSlug: string;
  /** The page this part is being rendered on — a part that links elsewhere needs it. */
  pageSlug: string;
  /** For anything that has to name the event — a printed consent, say. */
  siteTitle: string;
  siteDateLabel: string | null;
  sitePlaces: string[];
  /** Present when the reader arrived through an individual link. */
  accessToken: string | null;
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
