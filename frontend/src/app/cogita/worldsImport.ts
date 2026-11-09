/**
 * 2026-11-05 (Prompt 24) — VERWEISE IN ANDERE BAZY BEIM IMPORT UND BEIM LÖSCHEN (`worlds.ts`).
 * <code>
 *   Import      nimmt "@@name:@…" überall an (Verweisfelder, Zapis, "flow" eines Abstechers) — nichts blockiert daran.
 *               Geprüft wird gegen die andere Baza (`crossCheck`, nach dem Öffnen): ein bekannter Name (Ustawienia "worlds"
 *               nach dem Import, auch aus dem Dokument) wird geöffnet und das Ziel gesucht; ein unbekannter Name wird unter
 *               den lesbaren Bazy gesucht (ihre Ustawienia "handle") und — gefunden — in "worlds" ergänzt, im selben Zapis
 *               (`withWorlds`); was nicht lesbar ist oder fehlt, wird genannt — der Import geht weiter.
 *   Felder      ein "@@…" in einem Verweisfeld ohne "external": true: Hinweis (der Editor böte dort keine anderen Welten an).
 *   Löschen     was andere Bazy auf das Gelöschte zeigen lassen (`incomingIn`) — die Rückfrage nennt es; dort wird es
 *               „zerwany" (ihr „Do zrobienia"), blockiert wird nichts.
 * </code>
 * Rein bis auf `crossCheckFor` und `incomingLinksFor` (öffnen Bazy mit dem Konto); geprüft in `scripts/app-worlds-check.mjs`.
 */

import { newId } from '../core/ids';
import type { Me } from '../core/me';
import { t } from '../core/i18n';
import { fieldsOf, labelOf, type Entity, type FieldDef, type KindDef, type Lookup } from './schema';
import { readSettings, type CogitaLibrary, type WorldRef } from './store';
import type { DocKind } from './kinds';
import { crossOf, crossRefsIn, crossText, findWorld, openWorld, readableBases, resolveCross, withWorld, type CrossRef } from './worlds';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Ein Verweis in eine andere Baza, wo er im Dokument steht. */
export interface CrossUse {
  readonly ref: CrossRef;
  /** „Wpis „Prawa Newtona”, pole „W innych światach”" — für die Hinweise. */
  readonly where: string;
  /** In einem Verweisfeld: ob es "external": true trägt. */
  readonly external?: boolean;
  /** Der "flow" eines Abstechers — das Ziel muss eine Erzählung sein. */
  readonly detour?: true;
}

/** Was ein Plan an Einträgen und Dokumenten schreibt (die Gestalt von `ImportPlan`). */
export interface CrossPlan {
  readonly kinds: readonly { readonly id: string; readonly def: KindDef }[];
  readonly entities: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }[];
  readonly docs: readonly { readonly id: string; readonly kind: DocKind; readonly data: Readonly<Record<string, unknown>> }[];
}

/** Wie ein Dokument in den Hinweisen heisst (`cogitaData.worlds.doc.<art>`); `undefined`: keine eigene Bezeichnung. */
const DOC_NAMED: ReadonlySet<string> = new Set(['flow', 'view', 'revision', 'collection', 'template', 'look', 'rules', 'anchor']);
const docName = (kind: DocKind): string | undefined => (DOC_NAMED.has(kind) ? t(`cogitaData.worlds.doc.${kind}`) : undefined);

/** Alle Verweise in andere Bazy, die ein Plan schreibt — je Stelle (Eintrag + Feld, Dokument + Schritt). */
export function crossUses(lib: Pick<CogitaLibrary, 'kind' | 'entity'>, plan: CrossPlan): CrossUse[] {
  const out: CrossUse[] = [];
  const kinds = new Map(plan.kinds.map((k) => [k.id, k.def]));
  const look: Lookup = { kind: (id) => kinds.get(id) ?? lib.kind(id), entity: (id) => lib.entity(id) };
  for (const e of plan.entities) {
    const entity: Entity = { id: e.id, kinds: e.kinds, data: e.data };
    const fields = new Map<string, FieldDef>(fieldsOf(entity, look).map((f) => [f.key, f]));
    const title = labelOf(entity, look) || e.id;
    for (const [key, value] of Object.entries(e.data)) {
      if (key.startsWith('_')) continue;
      const f = fields.get(key);
      for (const c of crossRefsIn(value)) {
        out.push({ ref: { handle: c.handle, ref: c.ref }, where: t('cogitaData.import.entryField', { name: title, field: f?.label ?? key }), ...(f?.type === 'ref' && c.label === undefined ? { external: f.external === true } : {}) });
      }
    }
  }
  for (const d of plan.docs) {
    if (d.kind === 'settings') continue;
    const name = t('cogitaData.import.docTitle', { doc: docName(d.kind) ?? t('cogitaData.worlds.doc.other'), name: str(d.data.name) || '—' });
    const nodes = d.kind === 'flow' && isObject(d.data.graph) && Array.isArray(d.data.graph.nodes) ? d.data.graph.nodes.filter(isObject) : [];
    const said = new Set<string>();
    for (const n of nodes) {
      if (n.type !== 'detour' || !isObject(n.config)) continue;
      const c = crossOf(n.config.flow);
      if (c === null) continue;
      said.add(crossText(c));
      out.push({ ref: c, where: t('cogitaData.worlds.detourAt', { name, id: str(n.id) || '—' }), detour: true });
    }
    for (const c of crossRefsIn(d.data)) if (!said.has(crossText(c))) out.push({ ref: { handle: c.handle, ref: c.ref }, where: name });
  }
  return out;
}

/** Was ein Plan sofort sagt (ohne eine Baza zu öffnen): "@@…" in einem Verweisfeld ohne "external": true. */
export function crossImportWarnings(lib: Pick<CogitaLibrary, 'kind' | 'entity'>, plan: CrossPlan): string[] {
  return crossUses(lib, plan).filter((u) => u.external === false)
    .map((u) => t('cogitaData.worlds.notExternal', { where: u.where, ref: crossText(u.ref) }));
}

/** Die Ustawienia nach dem Import: die der Baza, überschrieben durch die des Dokuments. */
export function settingsAfter(lib: Pick<CogitaLibrary, 'settingsEntry'>, plan: Pick<CrossPlan, 'docs'>): ReturnType<typeof readSettings> {
  const planned = plan.docs.find((d) => d.kind === 'settings');
  return readSettings(planned?.data ?? lib.settingsEntry()?.data);
}

/** Wie `crossCheck` andere Bazy öffnet — im Browser mit dem Konto (`crossCheckFor`), in der Prüfung aus dem Speicher. */
export interface WorldOpener {
  /** Die Baza unter dieser Kennung — `null`: nicht lesbar. */
  readonly open: (libraryId: string) => Promise<CogitaLibrary | null>;
  /** Eine lesbare Baza, die sich selbst so nennt (ihre Ustawienia "handle"). */
  readonly find: (handle: string) => Promise<{ readonly world: WorldRef; readonly lib: CogitaLibrary } | null>;
}

export interface CrossCheck {
  readonly warnings: readonly string[];
  /** Gefundene Bazy, die "worlds" im selben Zapis bekommt (`withWorlds`). */
  readonly add: readonly WorldRef[];
  /** Wie viele Verweise geprüft wurden (gefunden oder nicht). */
  readonly checked: number;
}

const many = (n: number) => t('cogitaData.worlds.refs', { count: n });

/**
 * DIE VERWEISE GEGEN IHRE BAZY: je Name einmal geöffnet. Nie ein Fehler — jede Zeile ist ein Hinweis, der Import geht
 * weiter (ein zerwany Verweis ist für Lernende unsichtbar und steht im „Do zrobienia" des Besitzers).
 */
export async function crossCheck(uses: readonly CrossUse[], known: { readonly own?: string; readonly worlds: readonly WorldRef[] }, opener: WorldOpener): Promise<CrossCheck> {
  const warnings: string[] = [];
  const add: WorldRef[] = [];
  let checked = 0;
  const byHandle = new Map<string, CrossUse[]>();
  for (const u of uses) byHandle.set(u.ref.handle, [...(byHandle.get(u.ref.handle) ?? []), u]);
  for (const [handle, list] of byHandle) {
    if (known.own === handle) {
      warnings.push(t('cogitaData.worlds.sameBase', { handle, refs: many(list.length), where: list[0]!.where }));
      continue;
    }
    let world = known.worlds.find((w) => w.handle === handle) ?? null;
    let wlib: CogitaLibrary | null = null;
    if (world === null) {
      const found = await opener.find(handle).catch(() => null);
      if (found === null) {
        warnings.push(t('cogitaData.worlds.unknown', { handle, refs: many(list.length), where: list[0]!.where }));
        continue;
      }
      world = { ...found.world, handle };
      wlib = found.lib;
      add.push(world);
      warnings.push(t('cogitaData.worlds.added', { name: world.name, handle }));
    } else {
      wlib = await opener.open(world.id).catch(() => null);
    }
    if (wlib === null) {
      warnings.push(t('cogitaData.worlds.unreadable', { name: world.name, handle, refs: many(list.length) }));
      continue;
    }
    const said = new Set<string>();
    for (const u of list) {
      checked += 1;
      const target = resolveCross(wlib, u.ref.ref);
      const key = `${u.where}|${u.ref.ref}`;
      if (said.has(key)) continue;
      said.add(key);
      if (target === null) warnings.push(t('cogitaData.worlds.broken', { where: u.where, ref: crossText(u.ref), name: world.name }));
      else if (u.detour === true && target.kind !== 'flow') warnings.push(t('cogitaData.worlds.notStory', { where: u.where, ref: crossText(u.ref), name: world.name }));
    }
  }
  return { warnings, add, checked };
}

/** Der Plan mit den gefundenen Bazy in "worlds" (das Dokument der Ustawienia geändert oder neu) — rein. */
export function withWorlds<P extends { readonly docs: readonly { readonly id: string; readonly kind: DocKind; readonly data: Record<string, unknown>; readonly isNew: boolean }[] }>(lib: Pick<CogitaLibrary, 'settingsEntry'>, plan: P, add: readonly WorldRef[]): P {
  if (add.length === 0) return plan;
  const at = plan.docs.findIndex((d) => d.kind === 'settings');
  const had = lib.settingsEntry();
  const base = at >= 0 ? plan.docs[at]! : { id: had?.id ?? newId(), kind: 'settings' as DocKind, data: { ...(had?.data ?? {}) }, isNew: had === undefined };
  let list = readSettings(base.data).worlds;
  for (const w of add) list = withWorld(list, w) ?? list;
  const next = { ...base, data: { ...base.data, worlds: list.map((w) => ({ id: w.id, handle: w.handle, name: w.name })) } };
  const docs = at >= 0 ? plan.docs.map((d, i) => (i === at ? next : d)) : [...plan.docs, next];
  return { ...plan, docs };
}

/** Im Browser: die Verweise eines Plans gegen die Bazy, die dieses Konto lesen kann. */
export function crossCheckFor(me: Me, lib: CogitaLibrary, plan: CrossPlan): Promise<CrossCheck> {
  const uses = crossUses(lib, plan);
  if (uses.length === 0) return Promise.resolve({ warnings: [], add: [], checked: 0 });
  const s = settingsAfter(lib, plan);
  return crossCheck(uses, { ...(s.handle === undefined ? {} : { own: s.handle }), worlds: s.worlds }, {
    open: (id) => openWorld(me, id),
    find: async (handle) => {
      const hit = await findWorld(me, handle, lib.libraryId);
      return hit === null ? null : { world: { id: hit.row.libraryId, handle, name: hit.row.name }, lib: hit.lib };
    }
  });
}

/* -- Löschen: was andere Bazy darauf zeigen lassen ------------------------------------------------------------------- */

export interface IncomingLink {
  /** Der Name der anderen Baza. */
  readonly base: string;
  /** Wo dort: ein Eintrag oder ein Dokument. */
  readonly from: string;
  /** Was hier gelöscht wird. */
  readonly target: string;
}

/**
 * Was die Baza `other` auf Gelöschtes in `target` zeigen lässt: ihre Namen für `target` (Ustawienia "worlds"), ihre
 * eigenen Einträge und Dokumente durchsucht, jedes Ziel in `target` aufgelöst.
 */
export function incomingIn(other: CogitaLibrary, otherName: string, target: CogitaLibrary, gone: ReadonlySet<string>): IncomingLink[] {
  const handles = new Set(other.settings().worlds.filter((w) => w.id === target.libraryId).map((w) => w.handle));
  if (handles.size === 0) return [];
  const out: IncomingLink[] = [];
  const titleOf = (id: string): string => { const e = target.entity(id); if (e !== undefined) return target.label(e) || id; const d = [...target.docs('flow'), ...target.docs('view')].find((x) => x.id === id); return d === undefined ? id : str(d.data.name) || id; };
  const scan = (data: unknown, from: string) => {
    for (const c of crossRefsIn(data)) {
      if (!handles.has(c.handle)) continue;
      const hit = resolveCross(target, c.ref);
      if (hit !== null && gone.has(hit.id)) out.push({ base: otherName, from, target: titleOf(hit.id) });
    }
  };
  for (const e of other.entities()) if (other.isOwn(e.id)) scan(e.data, other.label(e) || e.id);
  for (const kind of ['flow', 'view', 'revision', 'collection'] as const) {
    for (const d of other.docs(kind)) if (other.isOwn(d.id)) scan(d.data, t('cogitaData.import.docTitle', { doc: docName(kind) ?? kind, name: str(d.data.name) || '—' }));
  }
  return out;
}

/**
 * Was gelöscht wird, wird gesucht, BEVOR es weg ist: `resolveCross` braucht das Ziel noch. Für die Rückfrage: alle
 * lesbaren Bazy dieses Kontos (ausser `target`).
 */
export async function incomingLinksFor(me: Me, target: CogitaLibrary, gone: ReadonlySet<string>): Promise<IncomingLink[]> {
  if (gone.size === 0) return [];
  const out: IncomingLink[] = [];
  for (const row of await readableBases(me)) {
    if (row.libraryId === target.libraryId) continue;
    const other = await openWorld(me, row.libraryId);
    if (other !== null) out.push(...incomingIn(other, row.name, target, gone));
  }
  return out;
}

/** Ein Satz für die Rückfrage: „Linki z innych światów: Fizyka — Prawa Newtona → Rewolucja 1688; …". */
export function incomingText(list: readonly IncomingLink[], max = 6): string {
  if (list.length === 0) return '';
  const shown = list.slice(0, max).map((l) => `${l.base} — ${l.from} → ${l.target}`).join('; ');
  return t('cogitaData.worlds.incoming', { list: list.length > max ? t('cogitaData.import.listedMore', { list: shown, count: list.length - max }) : shown });
}
