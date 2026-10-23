/**
 * WAS MAN MIT EINEM WIDOK TUT (2026-10-22, Schritt 10) — im Arbeitsbereich,
 * mit Schreibrecht:
 *
 * <code>
 *   createHere     ein neuer Eintrag mit dem Zusammenhang des Feldes: die Themen der Achsen,
 *                  die Werte der Felder (ein Komentarz in Tajemnica × Perspektywa trägt beide)
 *   addToPlan      die Einträge als Punkte an den Plan eines Kazanie hängen (ein Link, ein Zitat)
 *   learn          eine Powtórka aus dem Widok (dieselben Schritte als Knoten, \`viewToRevision\`)
 * </code>
 *
 * Ein Eintrag der Bibliothek (Komentarz, Tekst, Cytat …) entsteht in der
 * Bibliothek — der, aus der der Widok schöpft, oder der, die das Thema hält.
 */

import { itemsOf, type EntryData } from '../library/libraryKinds';
import type { LibraryStore } from '../library/libraryStore';
import { newPointId } from '../scriptorium/sermon';
import type { Group, Grouping } from './selection';
import { BOOK_KINDS, type CogitaLibrary } from './store';
import { viewToRevision, type ViewDoc } from './views';

/** Was ein Feld (eine Gruppe) über einen neuen Eintrag sagt. */
export interface HereContext {
  readonly topics: readonly string[];
  readonly fields: Readonly<Record<string, unknown>>;
  readonly kind: string | null;
  /** In Worten — für die Frage vor dem Anlegen. */
  readonly words: readonly string[];
}

/** Der Zusammenhang aus den Gruppierungen und den gewählten Gruppen (Zeile, Spalte). */
export function contextOf(pairs: readonly { readonly grouping: Grouping; readonly group: Group }[]): HereContext {
  const topics: string[] = [];
  const fields: Record<string, unknown> = {};
  const words: string[] = [];
  let kind: string | null = null;
  for (const { grouping, group } of pairs) {
    if (group.key === '') continue;
    words.push(group.label);
    if (grouping.by === 'topic') topics.push(group.key);
    else if (grouping.by === 'kind') kind = group.key;
    else fields[grouping.field] = group.key.startsWith('t:') ? group.label : group.key;
  }
  return { topics, fields, kind, words };
}

/** Die Art, die ein Widok wählt (seine erste Quelle „Rodzaj") — `null`: keine eindeutige. */
export function kindOfView(view: ViewDoc): string | null {
  const first = view.steps.find((s) => s.type === 'source.kind');
  return first !== undefined && typeof first.config.kind === 'string' && first.config.kind !== '' ? first.config.kind : null;
}

/** Der Speicher einer Bibliothek, aus der die Baza schöpft (oder der Baza selbst). */
const storeIn = (lib: CogitaLibrary, libraryId: string | undefined): LibraryStore | undefined =>
  libraryId === undefined ? undefined : libraryId === lib.libraryId ? lib.store : lib.sourceList().find((s) => s.store.libraryId === libraryId)?.store;

/**
 * EIN NEUER EINTRAG MIT ZUSAMMENHANG. Eine Art der Baza: hier, die Themen im
 * ersten Verweisfeld auf Tematy. Eine Art der Bibliothek: in der Bibliothek der
 * Quelle („Skąd"), sonst in der, die das erste Thema hält, sonst in der ersten.
 */
export async function createHere(lib: CogitaLibrary, view: ViewDoc, here: HereContext): Promise<{ libraryId: string; id: string; inLibrary: boolean }> {
  const kindId = here.kind ?? kindOfView(view);
  if (kindId === null) throw new Error('Ten widok nie ma jednego rodzaju — wybierz rodzaj w „Wybór i grupy".');
  if (BOOK_KINDS.has(kindId)) {
    const from = view.steps.find((s) => s.type === 'source.kind' && s.config.kind === kindId)?.config.from;
    const books = lib.sourceList().filter((s) => s.kind === 'books');
    const target = typeof from === 'string' && from !== '' ? from
      : here.topics.map((t) => lib.origin(t)?.libraryId).find((id) => books.some((b) => b.store.libraryId === id)) ?? books[0]?.store.libraryId;
    const store = storeIn(lib, target);
    if (store === undefined || target === undefined) throw new Error('Ta baza nie korzysta z żadnej biblioteki — dodaj ją w Ustawieniach (Źródła).');
    const data: EntryData = kindId === 'comment' ? { blocks: [], subjects: [], topics: [...here.topics], ...here.fields }
      : kindId === 'text' ? { title: 'Nowy tekst', topics: [...here.topics], ...here.fields }
      : { topics: [...here.topics], ...here.fields };
    const saved = await store.save({ kind: kindId, data });
    return { libraryId: target, id: saved.id, inLibrary: true };
  }
  const kind = lib.kind(kindId);
  const topicField = kind?.fields.find((f) => f.type === 'ref' && (f.to ?? []).includes('topic'));
  const data: Record<string, unknown> = { ...here.fields };
  if (topicField !== undefined && here.topics.length > 0) data[topicField.key] = topicField.multi === true ? [...here.topics] : here.topics[0];
  const saved = await lib.saveEntity({ kinds: [kindId], data });
  return { libraryId: lib.libraryId, id: saved.id, inLibrary: false };
}

/** Wie ein Eintrag als Punkt eines Plans steht: ein Cytat eingebettet, alles andere als Link mit seinem Namen. */
export function pointFor(kind: string | undefined, id: string, label: string): { text: string; kind: string } {
  if (kind === 'quote') return { text: `![@${id}]`, kind: 'quote' };
  const words = label.replace(/[[\]|]/g, ' ').replace(/\s+/g, ' ').trim() || 'wpis';
  return { text: `[[${words}|@${id}]]`, kind: kind === 'question' ? 'question' : 'thought' };
}

/** Die Einträge als neue Punkte ans Ende des Plans eines Kazanie (Tekst) hängen. Gibt zurück, wie viele. */
export async function addToPlan(lib: CogitaLibrary, textId: string, ids: readonly string[]): Promise<number> {
  const store = storeIn(lib, lib.origin(textId)?.libraryId);
  const text = store?.get(textId);
  if (store === undefined || text === undefined || text.kind !== 'text') throw new Error('Nie ma takiego tekstu w bibliotekach tej bazy.');
  const plan = itemsOf(text.data, 'plan');
  const taken = new Set(plan.map((p) => String(p.id ?? '')));
  const points = ids.map((id) => {
    const entity = lib.entity(id);
    const point = pointFor(lib.entry(id)?.kind, id, entity === undefined ? '' : lib.label(entity));
    const pid = newPointId((x) => taken.has(x));
    taken.add(pid);
    return { id: pid, text: point.text, depth: 0, kind: point.kind };
  });
  await store.save({ id: text.id, kind: text.kind, ...(text.key === undefined ? {} : { key: text.key }), data: { ...text.data, plan: [...plan, ...points] } });
  return points.length;
}

/** Eine Powtórka aus dem Widok — oder aus einer Auswahl daraus (ein Feld, eine Gruppe). */
export async function learn(lib: CogitaLibrary, view: ViewDoc, ids?: readonly string[], name?: string): Promise<string> {
  const chosen = ids === undefined ? view : { ...view, name: name ?? view.name, steps: [{ type: 'source.list' as const, config: { ids: [...ids] } }] };
  const saved = await lib.saveDoc('revision', viewToRevision(chosen));
  return saved.id;
}
