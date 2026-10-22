/**
 * UMBAU 4 — TEMATY I PERSPEKTYWY → BIBLIOTEKA (2026-10-22, Schritt 7,
 * Entscheidung 14).
 *
 * Ein Themensystem: die Themen einer Baza wiedzy ziehen in die Bibliothek
 * DESSELBEN Bereichs (sie hält die Achsen), unter derselben Kennung — was auf
 * sie zeigt (Fragen über \`about\`, Powtórki „Temat", Przebiegi), findet sie
 * weiter; die Bibliothek wird Quelle der Baza (\`areaLibrary.ts\`).
 *
 * <code>
 *   Thema               zieht um; Felder des Lernens (Odpowiedzi, Głębokość …) bleiben am Thema,
 *                       die Baza bekommt die Erweiterung „Pola nauki" (eine Änderung des Themas)
 *   Perspektiven        die Liste der Einstellungen und die \`tags\` der Einträge werden eine
 *                       Achse: das Thema-Aspekt „Perspektywy" mit einem Thema je Perspektive
 *   Eintrag mit tags    (ein Komentarz, ein Text der Bibliothek) bekommt diese Themen in
 *                       „Tematy"; das Feld \`tags\` fällt erst weg, wenn alle da sind
 * </code>
 *
 * Nicht umgestellt, und genannt: ein Thema, das es in der Bibliothek schon
 * gibt (gleicher Name, gleiches Oberthema — zusammenführen in Cogita: „Połącz
 * z duplikatem", dann noch einmal), ein veröffentlichtes (bis Schritt 8),
 * Einträge der Baza mit Perspektiven (ein Rodzaj ohne Tematy), Bazy, die ich
 * nur lese.
 */

import { plural } from '../../core/plural';
import { baseKind, kindDoc, TOPIC_LEARNING } from '../../cogita/kinds';
import { libraryKindOf } from '../library';
import { ids, str, type EntryData, type LibEntry } from '../libraryKinds';
import type { Entry, LibraryStore } from '../libraryStore';
import { libraryFor, linkSource, newLibraryName, targetIn } from './areaLibrary';
import { libraryName, writes, type Change, type Rebuild, type RebuildCtx, type RebuildPlan } from './rebuild';

export const PERSPECTIVES = 'Perspektywy';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fold = (text: string) => text.trim().toLowerCase();
const tagsOf = (data: EntryData): string[] => (Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim()) : []);
const LEARNING_KEYS = new Set(['answers', 'entity', 'level', 'landmark', 'dimension', 'open']);

/** Hat die Baza die Erweiterung „Pola nauki" (eine Änderung des Themas mit diesen Feldern)? */
function hasLearning(base: LibraryStore): boolean {
  const doc = base.all().find((e) => e.kind === 'kind' && e.data.builtin === 'topic');
  const fields = Array.isArray(doc?.data.fields) ? doc!.data.fields.filter(isObject) : [];
  return TOPIC_LEARNING.every((f) => fields.some((g) => g.key === f.key));
}

/** Die Perspektiven einer Baza: ihre Liste in den Einstellungen und was an ihren Einträgen und an den Einträgen der Bibliothek steht. */
function perspectivesOf(base: LibraryStore, target: LibraryStore | undefined): string[] {
  const settings = base.all().find((e) => e.kind === 'settings');
  const all = [...tagsOf(settings?.data ?? {}), ...base.all().flatMap((e) => tagsOf(e.data)), ...(target?.all() ?? []).flatMap((e) => tagsOf(e.data))];
  const seen = new Map<string, string>();
  for (const t of all) if (!seen.has(fold(t))) seen.set(fold(t), t);
  return [...seen.values()];
}

/** Gibt es dieses Thema in der Bibliothek schon (gleicher Name, gleiches Oberthema)? */
const twinIn = (target: LibraryStore | undefined, topic: LibEntry): Entry | undefined =>
  target?.ofKind('topic').find((t) => fold(str(t.data, 'name')) === fold(str(topic.data, 'name')) && (ids(t.data, 'parent')[0] ?? '') === (ids(topic.data, 'parent')[0] ?? ''));

/** Die Achse „Perspektywy" einer Bibliothek — und ihre Werte, Name → Kennung. */
function axisIn(target: LibraryStore | undefined): { root: Entry | undefined; values: Map<string, string> } {
  const root = target?.ofKind('topic').find((t) => fold(str(t.data, 'name')) === fold(PERSPECTIVES) && ids(t.data, 'parent').length === 0);
  const values = new Map<string, string>();
  if (root !== undefined) for (const t of target!.ofKind('topic')) if (ids(t.data, 'parent')[0] === root.id) values.set(fold(str(t.data, 'name')), t.id);
  return { root, values };
}

export const topicsToLibrary: Rebuild = {
  id: 'tematy',
  title: 'Tematy i perspektywy → biblioteka',
  says: 'Jeden system tematów: tematy baz wiedzy przechodzą do biblioteki tego samego obszaru (z tym samym identyfikatorem), a perspektywy stają się osią „Perspektywy” — wpisy dostają z niej tematy.',

  plan(ctx: RebuildCtx): RebuildPlan {
    const changes: Change[] = [];
    const notes: string[] = [];
    for (const base of ctx.libraries.filter((l) => libraryKindOf(l) === 'knowledge')) {
      const store = ctx.stores.get(base.libraryId);
      if (store === undefined) continue;
      const topics = store.all().filter((e) => e.kind === 'topic');
      const targetId = targetIn(ctx, store);
      const target = targetId === null ? undefined : ctx.stores.get(targetId);
      const perspectives = perspectivesOf(store, target);
      if (topics.length === 0 && perspectives.length === 0) continue;
      if (!writes(ctx, base.libraryId)) {
        notes.push(`„${base.name}”: tematy i perspektywy przeniesie ktoś, kto pisze w tej bazie wiedzy.`);
        continue;
      }
      const into = targetId === null ? `nowej bibliotece „${newLibraryName(ctx, base.areaId)}”` : `bibliotece „${libraryName(ctx, targetId)}”`;
      for (const t of topics) {
        const twin = twinIn(target, t);
        const published = (t as Entry).publishedAt != null;
        changes.push({
          key: `t:${t.id}`, libraryId: base.libraryId, entryId: t.id, where: `${base.name} · temat „${str(t.data, 'name')}”`,
          what: published ? 'opublikowany — zostaje do kroku 8'
            : twin !== undefined ? `w ${into} jest już temat „${str(twin.data, 'name')}” — połącz je w Cogita (Wpisy → temat → „Połącz z duplikatem”), potem uruchom ponownie`
            : `przechodzi do ${into}${tagsOf(t.data).length > 0 ? ' (jego perspektywy zostają w polu — temat nie ma tematów)' : ''}`,
          ok: !published && twin === undefined
        });
      }
      if (topics.some((t) => Object.keys(t.data).some((k) => LEARNING_KEYS.has(k))) && !hasLearning(store)) {
        changes.push({ key: `l:${base.libraryId}`, libraryId: base.libraryId, where: base.name, what: 'dostaje rozszerzenie „Pola nauki” tematów (odpowiedzi, głębokość, próg …) — dane zostają przy tematach', ok: true });
      }
      if (perspectives.length > 0) {
        changes.push({ key: `p:${base.libraryId}`, libraryId: base.libraryId, where: base.name, what: `oś „${PERSPECTIVES}” w ${into}: ${perspectives.join(', ')}`, ok: true });
        for (const e of target?.all() ?? []) {
          if (tagsOf(e.data).length === 0 || e.kind === 'topic') continue;
          changes.push({ key: `e:${e.id}`, libraryId: target!.libraryId, entryId: e.id, where: `${libraryName(ctx, target!.libraryId)} · ${target!.title(e)}`, what: `dostaje ${plural(tagsOf(e.data).length, 'temat', 'tematy', 'tematów')} z osi „${PERSPECTIVES}”: ${tagsOf(e.data).join(', ')}`, ok: writes(ctx, target!.libraryId) });
        }
        for (const e of store.all()) {
          if (tagsOf(e.data).length === 0 || e.kind === 'topic' || e.kind === 'settings') continue;
          changes.push({ key: `e:${e.id}`, libraryId: base.libraryId, entryId: e.id, where: `${base.name} · wpis`, what: 'ma perspektywy, ale jego rodzaj nie ma tematów — zostają w polu (najpierw „Wiedza → komentarze”)', ok: false });
        }
      }
    }
    if (changes.length === 0 && notes.length === 0) notes.push('W bazach wiedzy, które widzisz, nie ma tematów ani perspektyw do przeniesienia.');
    return { changes, notes };
  },

  async run(plan: RebuildPlan, ctx: RebuildCtx): Promise<readonly string[]> {
    const report: string[] = [];
    const failed: string[] = [];
    const made = new Map<string, LibraryStore>();
    let moved = 0;
    let tagged = 0;
    for (const baseId of [...new Set(plan.changes.filter((c) => c.ok).map((c) => c.libraryId))]) {
      const base = ctx.stores.get(baseId);
      if (base === undefined || libraryKindOf(ctx.libraries.find((l) => l.libraryId === baseId) ?? {}) !== 'knowledge') continue;
      try {
        const target = await libraryFor(ctx, base, made, report);
        await linkSource(ctx, base, target, report);
        const mine = plan.changes.filter((c) => c.ok && (c.libraryId === baseId || c.libraryId === target.libraryId));

        /* Die Erweiterung zuerst: sonst sähe die Baza die Felder des Lernens am umgezogenen Thema nicht mehr. */
        if (mine.some((c) => c.key === `l:${baseId}`) && !hasLearning(base)) {
          const had = base.all().find((e) => e.kind === 'kind' && e.data.builtin === 'topic');
          const fields = Array.isArray(had?.data.fields) ? had!.data.fields.filter(isObject) : [];
          const extra = (kindDoc({ ...baseKind('topic')!, fields: [...TOPIC_LEARNING] }).fields as Record<string, unknown>[]).filter((f) => !fields.some((g) => g.key === f.key));
          await base.save({ ...(had === undefined ? {} : { id: had.id }), kind: 'kind', data: had === undefined ? kindDoc({ ...baseKind('topic')!, fields: [...TOPIC_LEARNING] }) : { ...had.data, fields: [...fields, ...extra] } });
          report.push(`„${libraryName(ctx, baseId)}”: tematy mają rozszerzenie „Pola nauki”.`);
        }

        /* Die Themen ziehen um — Kennung bleibt. */
        for (const change of mine.filter((c) => c.key.startsWith('t:'))) {
          const topic = base.own(change.entryId!);
          if (topic === undefined || topic.kind !== 'topic' || twinIn(target, topic) !== undefined) continue;
          ctx.progress(`Przenoszenie: ${change.where}`);
          await base.moveTo(topic.id, target);
          moved += 1;
        }

        /* Die Achse „Perspektywy" mit ihren Werten, dann die Einträge der Bibliothek mit Perspektiven. */
        if (mine.some((c) => c.key === `p:${baseId}`)) {
          const perspectives = perspectivesOf(base, target);
          let { root, values } = axisIn(target);
          if (root === undefined) root = await target.save({ kind: 'topic', data: { name: PERSPECTIVES, aspect: 'yes', description: 'Perspektywy, z których patrzy się na wpisy (dawniej: perspektywy bazy wiedzy).' } });
          for (const name of perspectives) {
            if (values.has(fold(name))) continue;
            const value = await target.save({ kind: 'topic', data: { name, parent: [root.id] } });
            values = new Map([...values, [fold(name), value.id]]);
          }
          for (const e of target.all()) {
            const tags = tagsOf(e.data);
            if (tags.length === 0 || e.kind === 'topic') continue;
            const add = tags.map((t) => values.get(fold(t))).filter((id): id is string => id !== undefined);
            if (add.length !== tags.length) continue;
            const { tags: _gone, ...rest } = e.data;
            void _gone;
            await target.save({ id: e.id, kind: e.kind, ...(e.key === undefined ? {} : { key: e.key }), data: { ...rest, topics: [...new Set([...ids(e.data, 'topics'), ...add])] } });
            tagged += 1;
          }
          /* Die Liste der Einstellungen ist jetzt die Achse — sie fällt weg. */
          const settings = base.all().find((e) => e.kind === 'settings');
          if (settings !== undefined && tagsOf(settings.data).length > 0) {
            const { tags: _old, ...rest } = settings.data;
            void _old;
            await base.save({ id: settings.id, kind: 'settings', data: rest });
          }
          report.push(`„${libraryName(ctx, target.libraryId)}”: oś „${PERSPECTIVES}” z wartościami: ${perspectives.join(', ')}.`);
        }
      } catch (e) {
        failed.push(`${libraryName(ctx, baseId)}: ${e instanceof Error ? e.message : 'nie udało się'}`);
      }
    }
    report.unshift(`Przeniesiono ${moved} ${plural(moved, 'temat', 'tematy', 'tematów')}; ${tagged} ${plural(tagged, 'wpis dostał', 'wpisy dostały', 'wpisów dostało')} tematy z perspektyw.`);
    if (failed.length > 0) report.push(`Nie udało się (${failed.length}): ${failed.slice(0, 10).join('; ')}`);
    return report;
  }
};
