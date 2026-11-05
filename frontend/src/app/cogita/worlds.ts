/**
 * 2026-11-05 (Prompt 24) — VERBINDUNGEN ZWISCHEN BAZY WIEDZY („Inne światy"): ein Eintrag, eine Erzählung oder ein Widok
 * einer anderen Baza, als Angebot — nie als Voraussetzung.
 * <code>
 *   Wert        "@@<name der Baza>:<@bleibender Name oder Kennung>", z. B. "@@historia:@historia/rewolucja-1688"
 *               — in Feldern (Odwołanie mit "external": true), im Zapis [[Rewolucja 1688|@@historia:@historia/rewolucja-1688]],
 *               als Abstecher {"type": "detour", "config": {"flow": "@@historia:@historia/f/rewolucja"}}; Export: dieselbe Form
 *   Name        jede Baza nennt sich selbst in ihren Ustawienia ("handle": "historia"); welche anderen sie kennt, steht dort
 *               unter "worlds" ([{"id", "handle", "name"}]) — beim Import und beim Wählen aus den lesbaren Bazy ergänzt
 *   Regeln      nie eine Voraussetzung, nie Kenntnis, nie Teil der Landschaft, der Ziele oder der Powtórki dieser Baza (alles
 *               dort löst nur eigene Kennungen auf — "@@…" ist für sie keine); die andere entscheidet selbst, was vorher kommt;
 *               Fortschritt bleibt, wo er entsteht (der Lernende der anderen Baza); zu sehen nur, wer die andere lesen kann —
 *               sonst nichts (der Besitzer sieht „niedostępne"); ein Ziel, das es nicht mehr gibt: „zerwany" (Do zrobienia),
 *               für Lernende verborgen
 * </code>
 * Rein bis auf `openWorld` (öffnet eine Baza mit dem Konto, einmal je Tab); geprüft in `scripts/app-worlds-check.mjs`.
 */

import { loadLibraries, openLibraries, type OpenLibrary } from '../library/library';
import { storeOf } from '../library/libraryStore';
import type { Me } from '../core/me';
import { loadSources, accountSources } from './sources';
import { CogitaLibrary, WORLD_HANDLE, type WorldRef } from './store';

export { readHandle, readWorlds, WORLD_HANDLE, type WorldRef } from './store';

const CROSS = /^@@([a-z0-9][a-z0-9_-]{0,39}):(\S.*)$/i;

export interface CrossRef {
  /** Der Name der anderen Baza (ohne @@). */
  readonly handle: string;
  /** Der bleibende Name ("@historia/…") oder die Kennung des Ziels dort. */
  readonly ref: string;
}

/** Ein Wert als Verweis in eine andere Baza — sonst `null`. */
export function crossOf(value: unknown): CrossRef | null {
  if (typeof value !== 'string') return null;
  const m = CROSS.exec(value.trim());
  return m === null ? null : { handle: m[1].toLowerCase(), ref: m[2].trim() };
}
export const crossText = (c: CrossRef): string => `@@${c.handle}:${c.ref}`;
export const isCross = (value: unknown): boolean => crossOf(value) !== null;

/** Die Verweise eines Zapis: [[Wort|@@historia:@…]]. */
const MARKUP = /\[\[([^\]|]*)\|(@@[a-z0-9][a-z0-9_-]{0,39}:[^\]\s]+)\]\]/gi;

export type CrossFound = CrossRef & { readonly label?: string; readonly field?: string };

/**
 * Alle Verweise in andere Bazy in den Daten eines Eintrags (Felder, Listen, Bausteine, Zapis), jeder einmal. `markup: false`:
 * nur ganze Werte (die Felder „W innych światach") — die Links im Text stehen schon im Text.
 */
export function crossRefsIn(data: unknown, options: { readonly markup?: boolean } = {}): CrossFound[] {
  const markup = options.markup !== false;
  const out: CrossFound[] = [];
  const seen = new Set<string>();
  const add = (c: CrossRef | null, field: string | undefined, label?: string) => {
    if (c === null) return;
    const k = crossText(c);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ ...c, ...(label === undefined || label === '' ? {} : { label }), ...(field === undefined ? {} : { field }) });
  };
  const walk = (v: unknown, depth: number, field: string | undefined) => {
    if (depth > 8) return;
    if (typeof v === 'string') {
      add(crossOf(v), field);
      if (markup && v.includes('[[')) for (const m of v.matchAll(MARKUP)) add(crossOf(m[2]), field, m[1].trim());
      return;
    }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1, field); return; }
    if (typeof v === 'object' && v !== null) for (const [k, x] of Object.entries(v)) if (!k.startsWith('_')) walk(x, depth + 1, field ?? k);
  };
  walk(data, 0, undefined);
  return out;
}

/** Ein Text, in dem die Verweise in andere Bazy durch `to` ersetzt sind (Export, Umbenennen eines Namens). */
export function mapCross(text: string, to: (c: CrossRef) => CrossRef | null): string {
  const one = crossOf(text);
  if (one !== null) { const n = to(one); return n === null ? text : crossText(n); }
  if (!text.includes('[[')) return text;
  return text.replace(MARKUP, (all, label: string, ref: string) => { const c = crossOf(ref); const n = c === null ? null : to(c); return n === null ? all : `[[${label}|${crossText(n)}]]`; });
}

/** Ein Name für eine Baza aus ihrem Titel („Historia Anglii" → "historia-anglii"). */
export function handleFrom(name: string): string {
  const flat = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()
    .replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return WORLD_HANDLE.test(flat) ? flat : 'baza';
}

/* -- Ziele in der anderen Baza --------------------------------------------------------------------------------------- */

export type CrossTarget = {
  readonly kind: 'entry' | 'flow' | 'view';
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** Eine Erzählung: ihre Einheit (in der anderen Baza). */
  readonly unit?: string;
};

/** Das Ziel in der anderen Baza: ein Eintrag, eine Erzählung oder ein Widok — oder `null` (es gibt es dort nicht). */
export function resolveCross(world: CogitaLibrary, ref: string): CrossTarget | null {
  const r = ref.trim();
  const named = r.startsWith('@') ? r.slice(1) : null;
  const byName = (among: 'entity' | 'flow' | 'view') => (named === null ? undefined : world.byImportRef(named, among)?.id);
  const entId = byName('entity') ?? (named === null ? r : undefined);
  const ent = entId === undefined ? undefined : world.entity(entId);
  if (ent !== undefined) return { kind: 'entry', id: ent.id, title: world.label(ent), summary: summaryOf(world, ent.id) };
  const flowId = byName('flow') ?? (named === null ? r : undefined);
  const flow = flowId === undefined ? undefined : world.docs('flow').find((d) => d.id === flowId);
  if (flow !== undefined) {
    const data = flow.data;
    const u = typeof data.unit === 'string' ? data.unit.trim() : '';
    const unit = u === '' ? undefined : u.startsWith('@') ? world.byImportRef(u.slice(1), 'entity')?.id : u;
    return { kind: 'flow', id: flow.id, title: typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : flow.id, summary: unit === undefined ? '' : summaryOf(world, unit), ...(unit === undefined ? {} : { unit }) };
  }
  const viewId = byName('view') ?? (named === null ? r : undefined);
  const view = viewId === undefined ? undefined : world.docs('view').find((d) => d.id === viewId);
  if (view !== undefined) return { kind: 'view', id: view.id, title: typeof view.data.name === 'string' ? view.data.name : view.id, summary: '' };
  return null;
}

/** Wie ein Ziel in einem Verweis steht: sein bleibender Name ("@historia/…"), sonst seine Kennung. */
export function refOfTarget(world: CogitaLibrary, id: string): string {
  const ref = world.entry(id)?.data._ref;
  return typeof ref === 'string' && ref !== '' ? `@${ref}` : id;
}

const plainText = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(plainText).join(' ');
  if (typeof v === 'object' && v !== null) { const o = v as Record<string, unknown>; return typeof o.text === 'string' ? o.text : typeof o.value === 'string' ? o.value : ''; }
  return '';
};

/** Der eine Satz eines Eintrags (das Streszczenie; sonst der Anfang seines ersten Textes) — ohne Zapis. */
export function summaryOf(lib: Pick<CogitaLibrary, 'entry'>, id: string): string {
  const d = lib.entry(id)?.data ?? {};
  for (const k of ['streszczenie', 'summary', 'zusammenfassung', 'lead', 'opis', 'description', 'beschreibung', 'tekst', 'tresc', 'text', 'content', 'blocks']) {
    const t = plainText(d[k]).replace(/\[\[([^\]|]*)\|[^\]]*\]\]/g, '$1').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();
    if (t !== '') { const one = t.split(/(?<=[.!?])\s/)[0] ?? t; return one.length > 200 ? `${one.slice(0, 199)}…` : one; }
  }
  return '';
}

/* -- Öffnen ---------------------------------------------------------------------------------------------------------- */

export type WorldStatus = 'loading' | 'ok' | 'unknown' | 'unreadable';

/** Eine geöffnete andere Baza: ihr Name (wie diese Baza sie nennt) und sie selbst — nur lesend. */
export interface OpenWorld {
  readonly world: WorldRef;
  readonly lib: CogitaLibrary;
}

/** Welche Baza ein Name meint — aus den Ustawienia dieser Baza (ihr eigener Name meint sie selbst). */
export function worldOf(lib: Pick<CogitaLibrary, 'settings' | 'libraryId'>, handle: string, ownName = ''): WorldRef | null {
  const s = lib.settings();
  if (s.handle === handle) return { id: lib.libraryId, handle, name: ownName || handle };
  return s.worlds.find((w) => w.handle === handle) ?? null;
}

let rowsOf: { readonly me: Me; readonly rows: Promise<readonly OpenLibrary[]> } | null = null;
const opened = new Map<string, Promise<CogitaLibrary | null>>();

/** Die Bazy wiedzy, die dieses Konto lesen kann (einmal je Tab; `fresh`: neu gelesen). */
export function readableBases(me: Me, fresh = false): Promise<readonly OpenLibrary[]> {
  if (rowsOf === null || rowsOf.me !== me || fresh) {
    rowsOf = { me, rows: loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then((all) => all.filter((x) => x.kind === 'knowledge')) };
    if (fresh) opened.clear();
  }
  return rowsOf.rows;
}

/**
 * Eine andere Baza öffnen (mit ihren eigenen Quellen) — nur lesend, einmal je Tab. `null`: dieses Konto kann sie nicht
 * lesen (oder es gibt sie nicht mehr). Ihr Fortschritt gehört ihr: wer dort lernt, hat dort seinen Lernenden.
 */
export function openWorld(me: Me | null, libraryId: string): Promise<CogitaLibrary | null> {
  if (me === null) return Promise.resolve(null);
  const had = opened.get(libraryId);
  if (had !== undefined) return had;
  const made = (async () => {
    const row = (await readableBases(me)).find((x) => x.libraryId === libraryId);
    if (row === undefined) return null;
    const store = storeOf(me.ring, row);
    await store.sync();
    const lib = new CogitaLibrary(store, false);
    const { loaded } = await loadSources(lib, accountSources(me)).catch(() => ({ loaded: [] }));
    lib.setSources(loaded);
    return lib;
  })().catch(() => null);
  opened.set(libraryId, made);
  return made;
}

/** Die Baza, die sich selbst so nennt (ihre Ustawienia "handle"), unter den lesbaren — für den Import und das Wählen. */
export async function findWorld(me: Me, handle: string, except?: string): Promise<{ readonly row: OpenLibrary; readonly lib: CogitaLibrary } | null> {
  for (const row of await readableBases(me)) {
    if (row.libraryId === except) continue;
    const lib = await openWorld(me, row.libraryId);
    if (lib !== null && lib.settings().handle === handle) return { row, lib };
  }
  return null;
}

/** Wie eine Baza für Verweise heisst: ihr eigener Name, sonst einer aus ihrem Titel. */
export const handleOfLib = (lib: CogitaLibrary, name: string): string => lib.settings().handle ?? handleFrom(name);

/** Die Ustawienia-Liste "worlds" mit einer Baza mehr (oder ihrem neuen Namen) — unverändert, wenn sie schon so drin steht. */
export function withWorld(list: readonly WorldRef[], add: WorldRef): WorldRef[] | null {
  const same = list.find((w) => w.id === add.id);
  if (same !== undefined) return same.name === add.name ? null : list.map((w) => (w.id === add.id ? { ...w, name: add.name } : w));
  let handle = add.handle;
  for (let n = 2; list.some((w) => w.handle === handle); n += 1) handle = `${add.handle.slice(0, 36)}-${n}`;
  return [...list, { ...add, handle }];
}

