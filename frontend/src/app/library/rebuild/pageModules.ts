/**
 * UMBAU 6 — MODUŁY STRON → WIDOK (2026-10-22, Schritt 10).
 *
 * Vier Bausteine sind ausgemustert, weil der Baustein „Widok" sie kann:
 *
 * <code>
 *   entity-table     → Widok, Tabela: der Rodzaj (beim Namen) als Quelle, die Spalten nach ihren Namen
 *   topic-explorer   → Widok, Drzewo: der Temat als Quelle (mit Unterthemen) und als Achse der Gruppen
 *   knowledge-map    → Widok, Mapa: was die Powtórka wählt, als Schritte (`stepsOfRevision`)
 *   writings, Tabela → Widok, Tabela über die Kazania der Bibliothek (Datum, die Aspekte als Spalten),
 *                      in einer Baza desselben Bereichs, die die Bibliothek als Quelle nennt (sonst
 *                      entsteht „Widoki — <obszar>")
 * </code>
 *
 * Nur auf den Seiten, die dieses Konto führt, und nur, wo es in der Baza
 * schreiben darf (der Widok ist ein Dokument der Baza). Eine Stelle wird
 * ersetzt: neue Kennung, derselbe Platz, Baustein „Widok" mit Titel, Baza,
 * Widok und Gestalt. Was nicht geht, steht im Plan mit dem Grund. Die Seiten,
 * die umgestellt wurden, stehen im Bericht. Ein zweiter Lauf findet nichts mehr.
 *
 * Wer sieht, was er vorher sah: dieselbe Baza (Tabela, Drzewo, Mapa) — oder,
 * für das Archiv, eine Baza im Bereich der Bibliothek, gelesen wie die
 * Bibliothek (der Widok zeigt nur, was der Leser in der Bibliothek lesen darf).
 */

import { newId } from '../../core/ids';
import { loadSources } from '../../cogita/sources';
import { CogitaLibrary } from '../../cogita/store';
import { readView, stepsOfRevision, viewJson, AXIS_COLUMN, type ViewDoc } from '../../cogita/views';
import { loadPage, saveParts, toDraft, type DraftPart } from '../../pages/page';
import { loadDesk } from '../../workspace/desk';
import { layoutOf } from '../archiveLayout';
import { createLibrary, libraryKindOf, loadLibraries, openLibraries } from '../library';
import { storeOf, type LibraryStore } from '../libraryStore';
import { areaName } from './areaLibrary';
import { libraryName, writes, type Change, type Rebuild, type RebuildCtx, type RebuildPlan } from './rebuild';

/** Die Art eines Bausteins, die hier umgestellt wird — `null`: keine. */
export function retiredKind(kind: string, config: Readonly<Record<string, string>>): string | null {
  if (kind === 'entity-table' || kind === 'topic-explorer' || kind === 'knowledge-map') return kind;
  if (kind === 'writings' && layoutOf(config.layout) === 'table') return 'writings';
  return null;
}

const LABEL: Record<string, string> = { 'entity-table': 'Tabela wpisów', 'topic-explorer': 'Tematy', 'knowledge-map': 'Mapa wiedzy', writings: 'Archiwum tekstów (tabela)' };

/** Was die Umstellung von einer Baza wissen muss — ohne sie zu laden. */
export interface BaseFacts {
  readonly kindByName: (name: string) => { readonly id: string; readonly fields: readonly { readonly key: string; readonly label: string }[] } | undefined;
  readonly revisionGraph: (id: string) => unknown;
  /** Für das Archiv: die Aspekte (Achsen) der Bibliothek. */
  readonly aspects: readonly string[];
}

/**
 * DER WIDOK FÜR EINEN AUSGEMUSTERTEN BAUSTEIN — rein gerechnet. Gibt den
 * Widok und die Gestalt für den Baustein „Widok" (`tabela`, `drzewo`,
 * `mapa`) zurück, oder warum es nicht geht.
 */
export function convertPart(kind: string, config: Readonly<Record<string, string>>, facts: BaseFacts): { view: ViewDoc; mode: string } | { problem: string } {
  const title = (config.title ?? '').trim();
  if (kind === 'entity-table') {
    const wanted = (config.kind ?? '').trim();
    const k = wanted === '' ? undefined : facts.kindByName(wanted);
    if (wanted !== '' && k === undefined) return { problem: `w bazie nie ma rodzaju „${wanted}”` };
    const labels = (config.columns ?? '').split(/[,\n]/).map((c) => c.trim().toLowerCase()).filter((c) => c !== '');
    const columns = k === undefined ? [] : labels.map((l) => k.fields.find((f) => f.label.toLowerCase() === l || f.key.toLowerCase() === l)?.key).filter((x): x is string => x !== undefined);
    return { mode: 'tabela', view: readView({ name: title || (k === undefined ? 'Wpisy' : wanted), mode: 'table', steps: [k === undefined ? { type: 'source.all', config: {} } : { type: 'source.kind', config: { kind: k.id } }], columns }) };
  }
  if (kind === 'topic-explorer') {
    const topic = (config.topic ?? '').trim();
    return {
      mode: 'drzewo',
      view: readView(topic === ''
        ? { name: title || 'Tematy', mode: 'tree', steps: [{ type: 'source.kind', config: { kind: 'topic' } }] }
        : { name: title || 'Tematy', mode: 'tree', steps: [{ type: 'source.topic', config: { topic, depth: 9 } }], group: { by: 'topic', axis: topic } })
    };
  }
  if (kind === 'knowledge-map') {
    const graph = facts.revisionGraph((config.revision ?? '').trim());
    if (graph === undefined) return { problem: 'w bazie nie ma tej powtórki' };
    return { mode: 'mapa', view: readView({ name: title || 'Mapa wiedzy', mode: 'map', steps: stepsOfRevision(graph) }) };
  }
  if (kind === 'writings') {
    const library = (config.library ?? '').trim();
    const topic = (config.topic ?? '').trim();
    const project = (config.project ?? '').trim();
    const steps = [
      topic === '' ? { type: 'source.kind', config: { kind: 'text', from: library } } : { type: 'source.topic', config: { topic, depth: 9 } },
      ...(topic === '' ? [] : [{ type: 'filter.rule', config: { rule: { op: 'and', items: [{ cmp: 'kind', value: 'text' }] } } }]),
      ...(project === '' ? [] : [{ type: 'filter.rule', config: { rule: { op: 'and', items: [{ cmp: 'refers', value: project }] } } }])
    ];
    return {
      mode: 'tabela',
      view: readView({ name: title || 'Kazania', mode: 'table', steps, columns: ['date', ...facts.aspects.map((a) => `${AXIS_COLUMN}${a}`)], sort: { key: 'date', dir: -1 } })
    };
  }
  return { problem: 'tego modułu się nie zamienia' };
}

/* -- Woher die Baza kommt ------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const sourcesOf = (store: LibraryStore): Record<string, unknown>[] => {
  const settings = store.all().find((e) => e.kind === 'settings');
  return Array.isArray(settings?.data.sources) ? settings!.data.sources.filter(isObject) : [];
};

/** Für das Archiv: eine Baza im Bereich der Bibliothek, die sie als Quelle nennt — oder eine, die es wird. */
function baseForLibrary(ctx: RebuildCtx, libraryId: string): { baseId: string | null; linked: boolean } {
  const library = ctx.libraries.find((l) => l.libraryId === libraryId);
  if (library === undefined) return { baseId: null, linked: false };
  const bases = ctx.libraries.filter((l) => libraryKindOf(l) === 'knowledge' && l.areaId === library.areaId && l.writes);
  const linked = bases.find((b) => { const s = ctx.stores.get(b.libraryId); return s !== undefined && sourcesOf(s).some((x) => x.id === libraryId); });
  if (linked !== undefined) return { baseId: linked.libraryId, linked: true };
  return { baseId: bases[0]?.libraryId ?? null, linked: false };
}

/** Die Speicher: die der Porządki und die, die dieser Lauf erst angelegt hat. */
type Stores = (id: string) => LibraryStore | undefined;

async function opened(ctx: RebuildCtx, baseId: string, stores: Stores = (id) => ctx.stores.get(id)): Promise<CogitaLibrary | null> {
  const store = stores(baseId);
  if (store === undefined) return null;
  const lib = new CogitaLibrary(store, true);
  const { loaded } = await loadSources(lib, async (ref) => stores(ref.id) ?? null);
  lib.setSources(loaded);
  return lib;
}

const factsOf = (lib: CogitaLibrary | null, library: LibraryStore | undefined): BaseFacts => ({
  kindByName: (name) => lib?.kinds.find((k) => k.name.toLowerCase() === name.toLowerCase() || k.id === name),
  revisionGraph: (id) => lib?.docs('revision').find((e) => e.id === id)?.data.graph,
  aspects: library === undefined ? [] : library.all().filter((e) => e.kind === 'topic' && e.data.aspect === 'yes').map((e) => e.id)
});

interface Found {
  readonly path: string;
  readonly title: string;
  readonly part: DraftPart;
  readonly kind: string;
}

async function findParts(): Promise<Found[]> {
  const desk = await loadDesk();
  const out: Found[] = [];
  for (const one of desk.pages.filter((p) => p.aliasOf === null)) {
    const page = await loadPage(one.path).catch(() => null);
    if (page === null) continue;
    for (const raw of page.parts) {
      const part = toDraft(raw);
      const kind = retiredKind(part.kind, part.config);
      if (kind !== null) out.push({ path: one.path, title: page.title ?? one.path, part, kind });
    }
  }
  return out;
}

export const pageModules: Rebuild = {
  id: 'moduly-stron',
  title: 'Moduły stron → Widok',
  says: 'Tabela wpisów, Tematy, Mapa wiedzy i tabela Archiwum tekstów zostały wycofane — to samo (i więcej) pokazuje moduł „Widok”. Ten krok zamienia je na stronach, które prowadzisz: tworzy zapisany widok w bazie i stawia „Widok” w tym samym miejscu.',

  async plan(ctx: RebuildCtx): Promise<RebuildPlan> {
    const changes: Change[] = [];
    const notes: string[] = [];
    for (const found of await findParts()) {
      const where = `Strona „${found.title}” (#/${found.path}) · ${LABEL[found.kind]}`;
      const key = `part:${found.path}:${found.part.id}`;
      if (found.kind === 'writings') {
        const library = found.part.config.library ?? '';
        const { baseId, linked } = baseForLibrary(ctx, library);
        const facts = factsOf(null, ctx.stores.get(library));
        const area = ctx.libraries.find((l) => l.libraryId === library)?.areaId;
        changes.push({
          key, libraryId: library, where, ok: area !== undefined,
          what: area === undefined ? 'tej biblioteki nie widzisz — zostaje, jak jest'
            : `→ Widok (tabela: data${facts.aspects.length > 0 ? ` i ${facts.aspects.length} osi tematów` : ''}) w bazie ${baseId === null ? `„Widoki — ${areaName(ctx, area)}” (powstanie${ctx.libraries.find((l) => l.libraryId === library)?.areaPublic === true ? '; obszar jest jawny, więc cała baza będzie publiczna — trzyma tylko widoki' : ''})` : `„${libraryName(ctx, baseId)}”`}${baseId !== null && !linked ? ' — dostanie bibliotekę jako źródło' : ''}`
        });
        continue;
      }
      const baseId = found.part.config.library ?? '';
      if (!writes(ctx, baseId)) { changes.push({ key, libraryId: baseId, where, ok: false, what: 'w tej bazie nie możesz pisać — zamieni ją ktoś, kto w niej pisze' }); continue; }
      const result = convertPart(found.kind, found.part.config, factsOf(await opened(ctx, baseId), undefined));
      changes.push('problem' in result
        ? { key, libraryId: baseId, where, ok: false, what: `zostaje, jak jest: ${result.problem}` }
        : { key, libraryId: baseId, where, ok: true, what: `→ Widok (${result.mode}) „${result.view.name}” w bazie „${libraryName(ctx, baseId)}”` });
    }
    if (changes.length === 0) notes.push('Na stronach, które prowadzisz, nie ma już wycofanych modułów.');
    return { changes, notes };
  },

  async run(plan: RebuildPlan, ctx: RebuildCtx): Promise<readonly string[]> {
    const report: string[] = [];
    const todo = new Set(plan.changes.filter((c) => c.ok).map((c) => c.key));
    const byPage = new Map<string, Found[]>();
    for (const found of await findParts()) {
      if (!todo.has(`part:${found.path}:${found.part.id}`)) continue;
      byPage.set(found.path, [...(byPage.get(found.path) ?? []), found]);
    }
    /* Was dieser Lauf anlegt (eine Baza „Widoki — …" je Bereich), gilt für die nächsten Seiten mit. */
    const made = new Map<string, { id: string; store: LibraryStore }>();
    const stores: Stores = (id) => [...made.values()].find((m) => m.id === id)?.store ?? ctx.stores.get(id);
    for (const [path, list] of byPage) {
      ctx.progress(`Strona ${path}…`);
      const page = await loadPage(path);
      const replaced = new Map<string, DraftPart>();
      for (const found of list) {
        let baseId = found.part.config.library ?? '';
        let facts: BaseFacts;
        if (found.kind === 'writings') {
          const library = baseId;
          const chosen = baseForLibrary(ctx, library);
          const area = ctx.libraries.find((l) => l.libraryId === library)?.areaId ?? '';
          if (chosen.baseId === null && !made.has(area)) made.set(area, await createBase(ctx, library));
          baseId = chosen.baseId ?? made.get(area)!.id;
          if (!chosen.linked) await linkLibrary(ctx, baseId, library, stores);
          facts = factsOf(null, ctx.stores.get(library));
        } else {
          facts = factsOf(await opened(ctx, baseId, stores), undefined);
        }
        const result = convertPart(found.kind, found.part.config, facts);
        if ('problem' in result) { report.push(`${path}: ${LABEL[found.kind]} — ${result.problem}.`); continue; }
        const lib = await opened(ctx, baseId, stores);
        if (lib === null) { report.push(`${path}: nie udało się otworzyć bazy.`); continue; }
        const doc = await lib.saveDoc('view', viewJson(result.view));
        replaced.set(found.part.id, {
          id: newId(), moduleId: null, kind: 'view', layout: found.part.layout,
          config: { title: found.part.config.title ?? '', library: baseId, view: doc.id, mode: result.mode }
        });
      }
      if (replaced.size === 0) continue;
      const drafts = page.parts.map((raw) => { const d = toDraft(raw); return replaced.get(d.id) ?? d; });
      await saveParts(path, drafts);
      report.push(`Strona „${page.title ?? path}” (#/${path}): ${replaced.size} ${replaced.size === 1 ? 'moduł zamieniony' : 'moduły zamienione'} na „Widok”.`);
    }
    if (report.length === 0) report.push('Nic do zamiany.');
    return report;
  }
};

/** Eine Baza für die Widoki eines Bereichs — wenn es dort keine gibt, in der ich schreibe. */
async function createBase(ctx: RebuildCtx, libraryId: string): Promise<{ id: string; store: LibraryStore }> {
  const library = ctx.libraries.find((l) => l.libraryId === libraryId);
  if (library === undefined) throw new Error('nie widać biblioteki');
  const name = `Widoki — ${areaName(ctx, library.areaId)}`;
  ctx.progress(`Zakładanie bazy „${name}”…`);
  const id = await createLibrary(ctx.me.ring, library.areaId, name, 'knowledge');
  const rows = await openLibraries(ctx.me.ring, (await loadLibraries()).libraries);
  const row = rows.find((r) => r.libraryId === id);
  if (row === undefined) throw new Error('nie widać nowej bazy');
  const store = storeOf(ctx.me.ring, row);
  await store.sync();
  return { id, store };
}

/** Die Bibliothek als Quelle der Baza — wenn sie es noch nicht ist. */
async function linkLibrary(ctx: RebuildCtx, baseId: string, libraryId: string, stores: Stores): Promise<void> {
  const store = stores(baseId);
  if (store === undefined) return;
  const sources = sourcesOf(store);
  if (sources.some((s) => s.id === libraryId)) return;
  const settings = store.all().find((e) => e.kind === 'settings');
  const name = ctx.libraries.find((l) => l.libraryId === libraryId)?.name ?? 'Biblioteka';
  await store.save({ ...(settings === undefined ? {} : { id: settings.id }), kind: 'settings', data: { ...(settings?.data ?? {}), sources: [...sources, { id: libraryId, kind: 'books', name }] } });
}
