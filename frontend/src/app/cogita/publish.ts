/**
 * COGITA — VERÖFFENTLICHEN (COGITA.md §14, [F20, P10]).
 *
 * <b>Ein gemeinsamer Weg, einen Baustein direkt zu veröffentlichen</b> —
 * ein Formular, eine Wiederholung, einen Ablauf: der Dienst gibt eine Adresse
 * `c/<kennung>` auf die Rolle dessen, der veröffentlicht; der Browser legt
 * den Baustein darauf. Danach ist es eine Seite wie jede andere — er führt
 * sie, kann sie bearbeiten und an eine eigene Adresse hängen.
 *
 * <b>Was hinausgeht</b>: eine Wiederholung als Abschrift ihrer Karten (ohne
 * Lernstand), ein Ablauf samt dem, was er zeigt, ein Eintrag als Karte mit
 * seinen Feldern — als offene Fassung in der Bibliothek (`data.public`), die
 * eine öffentliche Seite ohne Schlüssel liest. Nichts geht von selbst hinaus.
 */

import { newId } from '../core/ids';
import { COLUMNS, type Breakpoint, type Frame, type Layout } from '../pages/layout';
import { savePage, saveParts, type DraftPart } from '../pages/page';
import { call } from '../core/session';
import type { Card } from './cardBasics';
import { fileUrl, publishFile } from './files';
import { contentOf, readFlow, resolveFlow, type Flow } from './flow';
import { readGraph } from './graph';
import type { Dependency } from './knowness';
import { planOf, type Plan } from './revision';
import { fieldsOf, fieldText, labelOf, plainOf, valuesOf, type Entity, type MediaRef } from './schema';
import { ENTITY_BUNDLE, FLOW_BUNDLE, REVISION_BUNDLE } from './published';
import type { CogitaLibrary } from './store';

/* -- Die Adresse ------------------------------------------------------------------------------ */

export const newAddress = (roleId: string): Promise<{ path: string; roleId: string; claimedAt: string }> =>
  call('/workspace/publish/address', { method: 'POST', body: JSON.stringify({ roleId }) });

export const myAddresses = (): Promise<{ addresses: readonly { path: string; roleId: string; claimedAt: string | null; parts: number }[] }> =>
  call('/workspace/publish/addresses');

/** Dieselbe Anordnung in jeder Grösse — volle Breite, der Reihe nach. */
export function fullWidth(row: number, rowSpan: number): Layout {
  const out: Partial<Record<Breakpoint, Frame>> = {};
  for (const [breakpoint, columns] of Object.entries(COLUMNS)) {
    out[breakpoint as Breakpoint] = { position: { row, col: 1 }, size: { colSpan: columns, rowSpan } };
  }
  return out;
}

export interface PublishedPart {
  readonly kind: string;
  readonly config: Readonly<Record<string, string>>;
  /** Ein vorhandener Baustein (ein Formular) — sonst entsteht einer mit der Stelle. */
  readonly moduleId?: string | null;
  readonly rowSpan?: number;
}

/**
 * EINEN BAUSTEIN DIREKT VERÖFFENTLICHEN — eine neue Adresse, eine Seite mit
 * Titel, der Baustein darauf. Gibt den Pfad zurück (`c/ab3k9x2m`).
 */
export async function publishModule(input: { readonly roleId: string; readonly title: string; readonly lead?: string | null; readonly parts: readonly PublishedPart[] }): Promise<string> {
  const { path } = await newAddress(input.roleId);
  await savePage(path, { title: input.title.trim() || 'Bez tytułu', lead: input.lead?.trim() || null });
  let row = 1;
  const drafts: DraftPart[] = input.parts.map((part) => {
    const span = Math.max(1, Math.min(5, part.rowSpan ?? 5));
    const draft: DraftPart = { id: newId(), moduleId: part.moduleId ?? null, kind: part.kind, layout: fullWidth(row, span), config: { ...part.config } };
    row += span;
    return draft;
  });
  if (drafts.length > 0) await saveParts(path, drafts);
  return path;
}

export const pageUrl = (path: string): string =>
  `${typeof window === 'undefined' ? 'https://recreatio.pl/' : `${window.location.origin}${window.location.pathname}`}#/${path}`;

/** Ein Eintrag, wie ihn eine öffentliche Seite zeigt — sein Etikett und seine Felder in Worten. */
export interface PublicEntity {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly string[];
  /** Die Kennungen der Arten ('knowledge', 'person', eigene). */
  readonly kindIds: readonly string[];
  readonly fields: readonly { readonly key: string; readonly label: string; readonly text: string; readonly type: string }[];
  readonly media: readonly MediaRef[];
}

export function publicEntity(lib: CogitaLibrary, entity: Entity): PublicEntity {
  const look = lib.look;
  const fields: { key: string; label: string; text: string; type: string }[] = [];
  const media: MediaRef[] = [];
  for (const field of fieldsOf(entity, look)) {
    if (field.type === 'media') {
      for (const v of valuesOf(entity, field)) if (v.value !== null && typeof v.value === 'object' && 'file' in v.value) media.push(v.value as MediaRef);
      continue;
    }
    const text = fieldText(entity, field, look);
    if (text !== '') fields.push({ key: field.key, label: field.label, text: field.type === 'markup' ? String((entity.data[field.key] as string | undefined) ?? text) : text, type: field.type });
  }
  return { id: entity.id, label: labelOf(entity, look), kinds: entity.kinds.map((k) => lib.kind(k)?.name ?? k), kindIds: [...entity.kinds], fields, media };
}

/** Jede Datei, auf die etwas zeigt (`{file, type}`) — in Karten, Schritten, Einträgen. */
export function mediaIn(value: unknown, into: Map<string, MediaRef>, depth = 0): void {
  if (depth > 12) return;
  if (Array.isArray(value)) { for (const one of value) mediaIn(one, into, depth + 1); return; }
  if (typeof value !== 'object' || value === null) return;
  const o = value as Record<string, unknown>;
  if (typeof o.file === 'string' && typeof o.type === 'string') into.set(o.file, o as unknown as MediaRef);
  for (const one of Object.values(o)) mediaIn(one, into, depth + 1);
}

/**
 * Die offene Fassung der Dateien eines Bündels neben die versiegelte legen —
 * nur Bilder, Ton, Film und PDF (`mime` bekannt). 0110: jede dort, wo sie
 * liegt (auch in einer Quelle — dazu braucht es dort das Schreibrecht).
 * Gibt zurück, wie viele es wurden; eine, die nicht geht, hält die übrigen
 * nicht auf.
 */
export async function publishMedia(lib: CogitaLibrary, files: readonly MediaRef[], keyIn: (areaId: string, epoch: number) => Promise<Uint8Array | undefined>): Promise<number> {
  let done = 0;
  for (const media of files) {
    if (media.mime === undefined) continue;
    const owner = media.library ?? lib.libraryId;
    const area = lib.areaOf(owner);
    if (area === undefined) continue;
    const url = await fileUrl(owner, media, (epoch) => keyIn(area, epoch)).catch(() => null);
    if (url === null) continue;
    if (await publishFile(owner, media, url).then(() => true, () => false)) done += 1;
  }
  return done;
}

/**
 * EIN EINTRAG ALS BÜNDEL: die Karte des Eintrags (`entity`), dazu für Listen
 * und Tabellen seine Arten und bis zu acht Felder in Worten (`kinds`,
 * `list` — die Zusammenfassung der Bibliothek trägt sie hinaus), und seine
 * Dateien.
 */
export function entityBundle(lib: CogitaLibrary, entity: Entity): Record<string, unknown> {
  const pub = publicEntity(lib, entity);
  return {
    format: ENTITY_BUNDLE, v: 1, title: pub.label, entity: pub, kinds: pub.kinds,
    list: pub.fields.slice(0, 8).map((f) => ({ label: f.label, text: f.type === 'markup' ? plainOf(f.text) : f.text })),
    files: pub.media
  };
}

export interface PublicRevision {
  readonly format: typeof REVISION_BUNDLE;
  readonly v: 1;
  readonly title: string;
  readonly summary?: string;
  readonly plan: Omit<Plan, 'cards'>;
  readonly cards: readonly Card[];
  /** Was nach einer Antwort zur Erklärung erscheint. */
  readonly explain: Readonly<Record<string, PublicEntity>>;
  readonly deps: readonly Dependency[];
  /** Die Dateien der Karten und Erklärungen — ihre offene Fassung steht daneben (fehlt in älteren Bündeln). */
  readonly files?: readonly MediaRef[];
}

/** Eine Wiederholung als Abschrift: der Plan, wie ihr Graph ihn ergibt, ihre Karten, und was sie erklären. */
export async function revisionBundle(lib: CogitaLibrary, revisionId: string, now = Date.now()): Promise<PublicRevision | { error: string }> {
  const entry = lib.docs('revision').find((e) => e.id === revisionId);
  if (entry === undefined) return { error: 'Nie ma takiej powtórki.' };
  const { cards } = await lib.cards('public');
  const result = await planOf(readGraph(entry.data.graph), {
    cards,
    kindsOf: (id) => lib.entity(id)?.kinds ?? [],
    collection: (id) => lib.members(id),
    topic: (id, depth) => lib.topicTree(id, depth),
    marks: () => [],
    now
  });
  if (result.plan === null) return { error: result.problems.join(' ') || 'Powtórka nie dała planu.' };
  const { cards: chosen, ...plan } = result.plan;
  const explain: Record<string, PublicEntity> = {};
  for (const card of chosen) {
    for (const id of [...card.explain, ...(card.entity === undefined ? [] : [card.entity])]) {
      const entity = lib.entity(id);
      if (entity !== undefined && explain[id] === undefined) explain[id] = publicEntity(lib, entity);
    }
  }
  const files = new Map<string, MediaRef>();
  mediaIn(chosen, files);
  for (const one of Object.values(explain)) one.media.forEach((m) => files.set(m.file, m));
  return {
    format: REVISION_BUNDLE, v: 1,
    title: typeof entry.data.name === 'string' ? entry.data.name : 'Powtórka',
    ...(typeof entry.data.summary === 'string' ? { summary: entry.data.summary } : {}),
    plan, cards: chosen, explain, deps: lib.dependencies(), files: [...files.values()]
  };
}

export interface PublicFlow {
  readonly format: typeof FLOW_BUNDLE;
  readonly v: 1;
  readonly title: string;
  readonly flow: Record<string, unknown>;
  /** Die Abläufe, in die er führt (Unterabläufe, Übergaben). */
  readonly flows: readonly Record<string, unknown>[];
  readonly entities: Readonly<Record<string, PublicEntity>>;
  readonly cards: readonly Card[];
  /** Die Dateien, die er zeigt — ihre offene Fassung muss daneben stehen. */
  readonly files: readonly MediaRef[];
}

/** Ein Ablauf mit allem, was er zeigt — Unterabläufe eingeschlossen, Vorlagen aufgelöst. */
export async function flowBundle(lib: CogitaLibrary, flowId: string): Promise<PublicFlow | { error: string }> {
  const find = (id: string): Flow | undefined => {
    const e = lib.docs('flow').find((one) => one.id === id);
    return e === undefined ? undefined : readFlow(e.id, e.data);
  };
  const root = find(flowId);
  if (root === undefined) return { error: 'Nie ma takiego przebiegu.' };
  const seen = new Map<string, Flow>();
  const queue = [flowId];
  while (queue.length > 0 && seen.size < 40) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    const flow = find(id);
    if (flow === undefined) continue;
    const resolved = resolveFlow(flow, find);
    seen.set(id, resolved);
    queue.push(...contentOf(resolved).flows);
  }
  const ids = new Set<string>();
  const files = new Map<string, MediaRef>();
  for (const flow of seen.values()) {
    const content = contentOf(flow);
    content.entities.forEach((id) => ids.add(id));
    for (const n of flow.graph.nodes) mediaIn(n.config, files);
  }
  const entities: Record<string, PublicEntity> = {};
  for (const id of ids) {
    const entity = lib.entity(id);
    if (entity === undefined) continue;
    const pub = publicEntity(lib, entity);
    entities[id] = pub;
    pub.media.forEach((m) => files.set(m.file, m));
  }
  const { cards: all } = await lib.cards('public');
  const cards = all.filter((c) => ids.has(c.question) || (c.entity !== undefined && ids.has(c.entity)) || ids.has(c.key));
  mediaIn(cards, files);
  const json = (flow: Flow) => ({ id: flow.id, name: flow.name, look: flow.look, start: flow.start, graph: flow.graph, slots: flow.slots, goals: flow.goals, lines: flow.lines });
  return {
    format: FLOW_BUNDLE, v: 1, title: root.name,
    flow: json(seen.get(flowId)!),
    flows: [...seen.values()].filter((f) => f.id !== flowId).map(json),
    entities, cards, files: [...files.values()]
  };
}

/** Die offene Fassung in den Eintrag legen und ihn (ausdrücklich) veröffentlichen. */
export async function publishBundle(lib: CogitaLibrary, entryId: string, bundle: Record<string, unknown>): Promise<void> {
  const entry = lib.entry(entryId);
  if (entry === undefined) return;
  await lib.store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: { ...entry.data, public: bundle } });
  await lib.store.publish([entryId]);
}

/** Zurückziehen: der Eintrag geht nicht mehr hinaus, und seine offene Fassung verlässt ihn. */
export async function unpublishBundle(lib: CogitaLibrary, entryId: string): Promise<void> {
  const entry = lib.entry(entryId);
  if (entry === undefined) return;
  await lib.store.unpublish([entryId]);
  const { public: _gone, ...rest } = entry.data;
  await lib.store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: rest });
}
