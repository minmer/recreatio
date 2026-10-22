/**
 * UMBAU 5 — BAZY WIEDZY: STARE PUBLIKACJE (2026-10-22, Schritt 8,
 * Entscheidung 3).
 *
 * Bis hierher stellte eine Baza wiedzy einzelne Bündel hinaus: eine Abschrift
 * in \`data.public\` (im versiegelten Eintrag), daneben beim Dienst eine offene
 * Fassung (\`published_*\`) und offene Kopien der Dateien. Jetzt liest eine
 * Baza, wer ihren Bereich liest — ein öffentlicher (und geöffneter) jeder, als
 * GANZE. Die Kopien sind übrig:
 *
 * <code>
 *   offene Fassung beim Dienst   zurückziehen — der Eintrag bleibt; lag die Baza in
 *                                einem zamkniętym obszarze, lesen ihn danach nur Mitglieder
 *                                (der Plan sagt es; wer ihn öffentlich will, trägt ihn in
 *                                eine Baza eines jawnego obszaru — „Kto widzi → Przenieś")
 *   data.public im Eintrag       herausnehmen — nur, wenn alles, was die Abschrift zeigt,
 *                                noch in der Baza (oder ihren Quellen) steht; sonst bleibt
 *                                sie und der Plan nennt, was fehlt
 *   offene Kopie einer Datei     zurückziehen — die versiegelte Datei bleibt
 *   Baza im jawnym obszarze,     wird NICHT geöffnet: das tut, wer in ihren Einstellungen
 *     noch nicht geöffnet        („Kto czyta") liest, dass dann die ganze Baza öffentlich ist
 * </code>
 *
 * Eine Abschrift kann Inhalt aus einer Quelle in einem anderen Bereich tragen.
 * Darum öffnet „Kto czyta" keine Baza, solange einer ihrer Einträge noch eine
 * trägt (\`hasOldCopies\`) — sonst läse jeder diese Abschrift mit.
 */

import { loadFiles, unpublishFile } from '../../cogita/files';
import { libraryKindOf } from '../library';
import { entryTitle, str, type EntryData, type LibEntry } from '../libraryKinds';
import type { LibraryStore } from '../libraryStore';
import { libraryName, writes, type Change, type Rebuild, type RebuildCtx, type RebuildPlan } from './rebuild';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trägt der Eintrag noch eine Abschrift aus der Zeit des Veröffentlichens? */
export const oldCopyOf = (entry: Pick<LibEntry, 'data'>): Record<string, unknown> | null => (isObject(entry.data.public) ? entry.data.public : null);

/** Trägt die Baza noch Abschriften? Dann öffnet „Kto czyta" sie nicht. */
export const hasOldCopies = (store: Pick<LibraryStore, 'all'>): boolean => store.all().some((e) => oldCopyOf(e) !== null);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Was eine Abschrift zeigt, das es nicht mehr gibt: Kennungen von Einträgen
 * (Erklärungen, Einträge eines Przebiegs, Karten), die weder in der Baza noch
 * in einer geladenen Quelle stehen. Dateien zählen nicht (sie bleiben versiegelt).
 */
export function missingIn(copy: Record<string, unknown>, known: (id: string) => boolean): string[] {
  const wanted = new Set<string>();
  const take = (value: unknown) => { for (const id of JSON.stringify(value ?? null).match(UUID) ?? []) wanted.add(id.toLowerCase()); };
  if (isObject(copy.entity)) take(copy.entity.id);
  if (isObject(copy.explain)) Object.keys(copy.explain).forEach(take);
  if (isObject(copy.entities)) Object.keys(copy.entities).forEach(take);
  if (Array.isArray(copy.cards)) for (const card of copy.cards) if (isObject(card)) { take(card.entity); take(card.question); }
  return [...wanted].filter((id) => !known(id));
}

/** Der Eintrag ohne die Abschrift. */
export function withoutCopy(data: EntryData): EntryData {
  const { public: _gone, ...rest } = data;
  return rest;
}

export const baseVisibility: Rebuild = {
  id: 'bazy-publikacje',
  title: 'Bazy wiedzy: stare publikacje',
  says: 'Baza wiedzy nie publikuje już pojedynczych wpisów — czyta ją ten, kto czyta jej obszar (obszar jawny: każdy, cała baza). Ten krok wycofuje stare kopie publiczne i usuwa kopie zapisane we wpisach; samych baz nie otwiera.',

  async plan(ctx: RebuildCtx): Promise<RebuildPlan> {
    const changes: Change[] = [];
    const notes: string[] = [];
    const bases = ctx.libraries.filter((l) => libraryKindOf(l) === 'knowledge');
    const everything = [...ctx.stores.values()];
    const known = (id: string) => everything.some((s) => s.get(id) !== undefined);

    for (const base of bases) {
      const store = ctx.stores.get(base.libraryId);
      if (store === undefined) continue;
      const name = libraryName(ctx, base.libraryId);
      const mine = writes(ctx, base.libraryId);
      const closed = base.areaPublic !== true;
      const where = (e: LibEntry) => `Baza „${name}” · ${str(e.data, 'name') || str(e.data, 'title') || str(e.data, 'text').slice(0, 60) || entryTitle(e, store)}`;

      const published = store.all().filter((e) => e.publishedAs !== null);
      const copies = store.all().filter((e) => oldCopyOf(e) !== null);
      let files: readonly { fileId: string; publicAt: string | null }[] = [];
      if (mine) files = (await loadFiles(base.libraryId).catch(() => ({ files: [] }))).files.filter((f) => f.publicAt !== null);

      if (!mine && (published.length > 0 || copies.length > 0)) {
        notes.push(`„${name}”: stare publikacje (${published.length + copies.length}) — tę bazę możesz tylko czytać; wycofa je ktoś, kto w niej pisze.`);
        continue;
      }
      for (const e of published) {
        changes.push({
          key: `withdraw:${e.id}`, libraryId: base.libraryId, entryId: e.id, where: where(e), ok: true,
          what: closed
            ? 'stara kopia publiczna zostanie wycofana. Baza leży w obszarze zamkniętym: potem czytają ten wpis tylko członkowie — żeby był publiczny, przenieś go do bazy w obszarze jawnym (wpis → Kto widzi → Przenieś).'
            : 'stara kopia publiczna zostanie wycofana (wpis zostaje).'
        });
      }
      for (const e of copies) {
        const missing = missingIn(oldCopyOf(e)!, known);
        changes.push(missing.length === 0
          ? { key: `strip:${e.id}`, libraryId: base.libraryId, entryId: e.id, where: where(e), ok: true, what: 'kopia publikacji zapisana we wpisie zostanie usunięta — wszystko, co pokazywała, jest w bazie.' }
          : { key: `strip:${e.id}`, libraryId: base.libraryId, entryId: e.id, where: where(e), ok: false, what: `kopia zostaje: pokazuje ${missing.length} wpisów, których w bazie już nie ma (przywróć je z historii wpisu albo zachowaj kopię). Dopóki jest, tej bazy nie da się otworzyć dla wszystkich.` });
      }
      for (const f of files) {
        changes.push({ key: `file:${base.libraryId}:${f.fileId}`, libraryId: base.libraryId, where: `Baza „${name}” · plik ${f.fileId.slice(0, 8)}`, ok: true, what: 'stara otwarta kopia pliku zostanie wycofana (zaszyfrowany plik zostaje).' });
      }
      if (base.areaPublic === true && base.areaRuleAt == null) {
        notes.push(`„${name}” leży w obszarze jawnym, ale nie jest otwarta — czytają ją tylko członkowie. Otworzyć ją (całą, z odpowiedziami i szkicami) można w jej ustawieniach: Kto czyta.`);
      }
    }
    return { changes, notes };
  },

  async run(plan: RebuildPlan, ctx: RebuildCtx): Promise<readonly string[]> {
    const report: string[] = [];
    let withdrawn = 0;
    let stripped = 0;
    let files = 0;
    const withdraw = new Map<string, string[]>();
    for (const c of plan.changes) {
      if (!c.ok) continue;
      if (c.key.startsWith('withdraw:') && c.entryId !== undefined) withdraw.set(c.libraryId, [...(withdraw.get(c.libraryId) ?? []), c.entryId]);
    }
    for (const [libraryId, ids] of withdraw) {
      const store = ctx.stores.get(libraryId);
      if (store === undefined) continue;
      ctx.progress(`Wycofywanie starych kopii: „${libraryName(ctx, libraryId)}”…`);
      await store.withdraw(ids);
      withdrawn += ids.length;
    }
    for (const c of plan.changes) {
      if (!c.ok) continue;
      if (c.key.startsWith('strip:') && c.entryId !== undefined) {
        const store = ctx.stores.get(c.libraryId);
        const entry = store?.get(c.entryId);
        if (store === undefined || entry === undefined || oldCopyOf(entry) === null) continue;
        ctx.progress(`Kopia we wpisie: ${c.where}…`);
        await store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: withoutCopy(entry.data) });
        stripped += 1;
      } else if (c.key.startsWith('file:')) {
        const fileId = c.key.split(':')[2];
        ctx.progress(`Plik ${fileId.slice(0, 8)}…`);
        if ((await unpublishFile(c.libraryId, fileId).catch(() => ({ unpublished: false }))).unpublished) files += 1;
        else report.push(`Pliku ${fileId.slice(0, 8)} („${libraryName(ctx, c.libraryId)}”) nie udało się wycofać — spróbuj jeszcze raz.`);
      }
    }
    report.unshift(`Wycofane stare kopie publiczne: ${withdrawn}. Usunięte kopie we wpisach: ${stripped}. Wycofane kopie plików: ${files}.`);
    const left = plan.changes.filter((c) => !c.ok).length;
    if (left > 0) report.push(`Nie zmieniono: ${left} (powód w planie).`);
    return report;
  }
};
