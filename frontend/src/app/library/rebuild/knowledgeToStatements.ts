/**
 * UMBAU 3 — WIEDZA → KOMENTARZE (2026-10-22, Schritt 6, Entscheidung 5).
 *
 * Eine Aussage gibt es nur noch einmal: als Komentarz einer Bibliothek. Jedes
 * „Wiedza" einer Baza wiedzy, in der ich schreiben darf, zieht in die
 * Bibliothek DESSELBEN Bereichs (der Dienst erlaubt nur das — niemand liest es
 * danach, der es vorher nicht lesen durfte) und wird dort ein Komentarz, unter
 * derselben Kennung: Przebiegi, Pytania („Wyjaśnienie"), Tematy und der
 * Fortschritt, die es nennen, finden es weiter. Die Bibliothek wird Quelle der
 * Baza (Ustawienia → źródła), damit sie es dort sieht.
 *
 * <code>
 *   text              der erste Absatz (Zapis, [[Wort|@…]] bleibt)
 *   source + locator  ein Verweis IM Absatz: „… [@dzieło, s. 23]."
 *   about             die Gegenstände (subjects)
 *   tags              bleiben stehen, bis Schritt 7 aus Perspektiven Aspekte macht
 *   anderes           bleibt, wie es ist
 * </code>
 *
 * Nicht umgestellt (und im Plan genannt): ein Wiedza mit weiteren Arten, ein
 * veröffentlichtes (seine offene Fassung fiele weg — erst Schritt 8), eines in
 * einer Baza, die ich nur lese. Fehlt im Bereich eine Bibliothek, in der ich
 * schreiben darf, legt der Umbau eine an („Komentarze — <Bereich>").
 */

import { plural } from '../../core/plural';
import { createLibrary, libraryKindOf, loadLibraries, openLibraries } from '../library';
import { ids, str, type EntryData, type LibEntry } from '../libraryKinds';
import { storeOf, type Entry, type LibraryStore } from '../libraryStore';
import { libraryName, writes, type Change, type Rebuild, type RebuildCtx, type RebuildPlan } from './rebuild';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Ein Wert der Cogita kann in einer Hülle stehen ({ value, state, source, note }). */
const bare = (v: unknown): unknown => (isObject(v) && 'value' in v ? v.value : v);
const kindsOf = (entry: LibEntry): string[] => (Array.isArray(entry.data._kinds) ? entry.data._kinds.filter((k): k is string => typeof k === 'string') : []);

/** Ist das ein „Wiedza" der Baza (und nur das)? */
export const isKnowledge = (entry: LibEntry): boolean => entry.kind === 'entity' && (kindsOf(entry).length === 0 || (kindsOf(entry).length === 1 && kindsOf(entry)[0] === 'knowledge'));

/** Den Verweis in den Absatz setzen — vor das letzte Satzzeichen, sonst ans Ende. */
function withCitation(text: string, citation: string): string {
  if (citation === '') return text;
  const trimmed = text.trimEnd();
  const m = /([.!?…]["”»)]*)$/.exec(trimmed);
  return m === null ? `${trimmed} ${citation}` : `${trimmed.slice(0, m.index)} ${citation}${m[1]}`;
}

/** Ein Wiedza als Komentarz — alles andere bleibt (Daten werden nie verloren). */
export function knowledgeAsStatement(data: EntryData): EntryData {
  const { text, about, source, locator, _kinds: _dropped, ...rest } = data;
  void _dropped;
  const work = (Array.isArray(source) ? source : [source]).map(bare).find((v): v is string => typeof v === 'string' && v.trim() !== '');
  const place = typeof bare(locator) === 'string' ? String(bare(locator)).trim() : '';
  const citation = work === undefined ? '' : `[@${work}${place === '' ? '' : `, ${place}`}]`;
  const said = typeof bare(text) === 'string' ? String(bare(text)).trim() : '';
  const paragraph = said === '' ? '' : withCitation(said, citation).trim();
  const subjects = (Array.isArray(about) ? about : about === undefined ? [] : [about]).map(bare)
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((ref) => ({ ref }));
  return {
    ...rest,
    ...(subjects.length === 0 ? {} : { subjects }),
    blocks: paragraph === '' ? [] : [{ type: 'paragraph', text: paragraph }],
    /* Ohne Absatz, aber mit Quelle: der Verweis bleibt als Gegenstand, damit nichts verloren geht. */
    ...(paragraph === '' && work !== undefined ? { subjects: [...subjects, { ref: work, ...(place === '' ? {} : { locator: place }) }] } : {})
  };
}

/** Die Bibliothek des Bereichs, in die ein Wiedza zieht: eine Quelle der Baza zuerst, dann jede, in der ich schreiben darf. */
function targetIn(ctx: RebuildCtx, base: LibraryStore): string | null {
  const settings = base.all().find((e) => e.kind === 'settings');
  const sources = new Set((Array.isArray(settings?.data.sources) ? settings!.data.sources : []).map((s) => (isObject(s) ? str(s, 'id') : '')));
  const candidates = ctx.libraries.filter((l) => libraryKindOf(l) === 'books' && l.areaId === base.areaId && l.writes);
  return (candidates.find((l) => sources.has(l.libraryId)) ?? candidates[0])?.libraryId ?? null;
}

const areaName = (ctx: RebuildCtx, areaId: string) => ctx.areas.find((a) => a.areaId === areaId)?.name ?? 'obszar';

export const knowledgeToStatements: Rebuild = {
  id: 'wiedza',
  title: 'Wiedza → komentarze',
  says: 'Stwierdzenia z baz wiedzy („Wiedza”) stają się komentarzami w bibliotece tego samego obszaru — z tym samym identyfikatorem, więc przebiegi, pytania i postępy dalej je znajdują. Biblioteka zostaje źródłem bazy.',

  plan(ctx: RebuildCtx): RebuildPlan {
    const changes: Change[] = [];
    const notes: string[] = [];
    for (const base of ctx.libraries.filter((l) => libraryKindOf(l) === 'knowledge')) {
      const store = ctx.stores.get(base.libraryId);
      if (store === undefined) continue;
      const knowledge = store.all().filter(isKnowledge);
      const mixed = store.all().filter((e) => e.kind === 'entity' && kindsOf(e).includes('knowledge') && !isKnowledge(e));
      for (const e of mixed) {
        changes.push({ key: `w:${e.id}`, libraryId: base.libraryId, entryId: e.id, where: `${base.name} · ${clip(str(e.data, 'text'))}`, what: 'ma też inne rodzaje — zostaje w bazie wiedzy', ok: false });
      }
      if (knowledge.length === 0) continue;
      if (!writes(ctx, base.libraryId)) {
        notes.push(`„${base.name}”: ${knowledge.length} ${plural(knowledge.length, 'stwierdzenie', 'stwierdzenia', 'stwierdzeń')} — tę bazę możesz tylko czytać; przeniesie je ktoś, kto w niej pisze.`);
        continue;
      }
      const target = targetIn(ctx, store);
      const into = target === null ? `nowej bibliotece „Komentarze — ${areaName(ctx, base.areaId)}”` : `bibliotece „${libraryName(ctx, target)}”`;
      for (const e of knowledge) {
        const published = (e as Entry).publishedAt != null;
        changes.push({
          key: `w:${e.id}`, libraryId: base.libraryId, entryId: e.id,
          where: `${base.name} · ${clip(str(e.data, 'text')) || 'stwierdzenie'}`,
          what: published ? 'opublikowane — przeniesienie skasowałoby jego publiczną kopię; zostaje do kroku 8' : `staje się komentarzem w ${into}${ids(e.data, 'source').length > 0 || isObject(e.data.source) ? ' (źródło jako przypis w akapicie)' : ''}`,
          ok: !published
        });
      }
    }
    if (changes.length === 0 && notes.length === 0) notes.push('W bazach wiedzy, które widzisz, nie ma stwierdzeń „Wiedza”.');
    return { changes, notes };
  },

  async run(plan: RebuildPlan, ctx: RebuildCtx): Promise<readonly string[]> {
    const report: string[] = [];
    let moved = 0;
    const failed: string[] = [];
    const created = new Map<string, LibraryStore>();
    const linked = new Set<string>();
    for (const change of plan.changes.filter((c) => c.ok && c.entryId !== undefined)) {
      const base = ctx.stores.get(change.libraryId);
      const entry = base?.own(change.entryId!);
      if (base === undefined || entry === undefined || !isKnowledge(entry)) continue;
      try {
        /* Die Bibliothek des Bereichs — vorhanden oder neu. */
        let targetId = targetIn(ctx, base);
        let target = targetId === null ? created.get(base.areaId) : ctx.stores.get(targetId);
        if (target === undefined) {
          if (targetId === null) {
            ctx.progress(`Zakładanie biblioteki „Komentarze — ${areaName(ctx, base.areaId)}”…`);
            targetId = await createLibrary(ctx.me.ring, base.areaId, `Komentarze — ${areaName(ctx, base.areaId)}`);
            report.push(`Założono bibliotekę „Komentarze — ${areaName(ctx, base.areaId)}” w obszarze „${areaName(ctx, base.areaId)}”.`);
          }
          const rows = await openLibraries(ctx.me.ring, (await loadLibraries()).libraries);
          const row = rows.find((r) => r.libraryId === targetId);
          if (row === undefined) throw new Error('nie widać biblioteki docelowej');
          target = storeOf(ctx.me.ring, row);
          await target.sync();
          created.set(base.areaId, target);
        }
        ctx.progress(`Przenoszenie: ${change.where}`);
        await base.moveTo(entry.id, target, { kind: 'comment', data: knowledgeAsStatement(entry.data) });
        moved += 1;
        /* Die Bibliothek wird Quelle der Baza — einmal je Paar. */
        const pair = `${base.libraryId}>${target.libraryId}`;
        if (!linked.has(pair)) {
          linked.add(pair);
          const settings = base.all().find((e) => e.kind === 'settings');
          const sources = Array.isArray(settings?.data.sources) ? settings!.data.sources.filter(isObject) : [];
          if (!sources.some((s) => str(s, 'id') === target!.libraryId)) {
            const name = ctx.libraries.find((l) => l.libraryId === target!.libraryId)?.name ?? `Komentarze — ${areaName(ctx, base.areaId)}`;
            await base.save({ ...(settings === undefined ? {} : { id: settings.id }), kind: 'settings', data: { ...(settings?.data ?? {}), sources: [...sources, { id: target.libraryId, kind: 'books', name }] } });
            report.push(`„${libraryName(ctx, base.libraryId)}” korzysta teraz z biblioteki „${name}”.`);
          }
        }
      } catch (e) {
        failed.push(`${change.where}: ${e instanceof Error ? e.message : 'nie udało się'}`);
      }
    }
    report.unshift(`Przeniesiono ${moved} ${plural(moved, 'stwierdzenie', 'stwierdzenia', 'stwierdzeń')} jako komentarze.`);
    if (failed.length > 0) report.push(`Nie udało się (${failed.length}): ${failed.slice(0, 10).join('; ')}`);
    report.push('Szablony kart dla rodzaju „Wiedza” nie dotyczą już przeniesionych wpisów — dla komentarzy są początki „Teza komentarza” i „Tabela komentarza” (Karty → + Nowy szablon).');
    return report;
  }
};

const clip = (text: string) => (text.length > 60 ? `${text.slice(0, 59).trimEnd()}…` : text);
