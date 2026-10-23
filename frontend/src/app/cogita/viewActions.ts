/**
 * WAS MAN MIT EINEM WIDOK TUT (2026-10-22, Schritt 10) — im Arbeitsbereich,
 * mit Schreibrecht:
 *
 * <code>
 *   createHere     ein neuer Eintrag mit dem Zusammenhang des Feldes: die Werte der Achsen
 *                  in seinen Verweisfeldern, die Werte der Felder (ein Komentarz in
 *                  Tajemnica × Obszar zeigt auf beide; ein Kazanie trägt sie in den Feldern
 *                  seines Rodzaj tekstu)
 *   addToPlan      die Einträge als Punkte an den Plan eines Kazanie hängen (ein Link, ein Zitat)
 *   learn          eine Powtórka aus dem Widok (dieselben Schritte als Knoten, \`viewToRevision\`)
 * </code>
 *
 * Ein Eintrag der Bibliothek oder des Skryptorium (Cytat, Tekst …) entsteht
 * dort — in dem, aus dem der Widok schöpft (ein Text eines Rodzaj tekstu: in
 * dem Skryptorium, das den Rodzaj hält).
 */

import { itemsOf, WRITING_KINDS, type EntryData } from '../library/libraryKinds';
import type { FieldDef } from './schema';
import type { LibraryStore } from '../library/libraryStore';
import { newPointId } from '../scriptorium/sermon';
import type { Group, Grouping } from './selection';
import { BOOK_KINDS, type CogitaLibrary } from './store';
import { viewToRevision, type ViewDoc } from './views';

/** Was ein Feld (eine Gruppe) über einen neuen Eintrag sagt. */
export interface HereContext {
  /** 2026-10-23 (Schritt 5) — die Werte der Achsen: der Wert und die Felder, über die man zu ihm gehört (leer: irgendeines). */
  readonly links: readonly { readonly id: string; readonly via: readonly string[] }[];
  readonly fields: Readonly<Record<string, unknown>>;
  readonly kind: string | null;
  /** In Worten — für die Frage vor dem Anlegen. */
  readonly words: readonly string[];
}

/** Der Zusammenhang aus den Gruppierungen und den gewählten Gruppen (Zeile, Spalte). */
export function contextOf(pairs: readonly { readonly grouping: Grouping; readonly group: Group }[]): HereContext {
  const links: { id: string; via: readonly string[] }[] = [];
  const fields: Record<string, unknown> = {};
  const words: string[] = [];
  let kind: string | null = null;
  for (const { grouping, group } of pairs) {
    if (group.key === '') continue;
    words.push(group.label);
    if (grouping.by === 'axis') links.push({ id: group.key, via: grouping.via });
    else if (grouping.by === 'kind') kind = group.key;
    else fields[grouping.field] = group.key.startsWith('t:') ? group.label : group.key;
  }
  return { links, fields, kind, words };
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
 * Die Werte der Achsen in die Verweisfelder eines Rodzaj: zuerst ein genanntes
 * Feld (`via`), sonst eines, das auf den Rodzaj des Wertes zeigt, sonst eines,
 * das auf jeden zeigt („O czym"); ein Feld für mehrere nimmt alle.
 */
export function placeLinks(lib: CogitaLibrary, fields: readonly FieldDef[], links: HereContext['links']): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const link of links) {
    const kinds = lib.entity(link.id)?.kinds ?? [];
    const fits = (f: FieldDef) => f.type === 'ref' && ((f.to ?? []).length === 0 || (f.to ?? []).some((k) => kinds.includes(k)));
    const field = fields.find((f) => link.via.includes(f.key) && fits(f)) ?? fields.find((f) => fits(f) && (f.to ?? []).length > 0) ?? fields.find(fits);
    if (field === undefined) continue;
    if (field.multi) data[field.key] = [...(Array.isArray(data[field.key]) ? data[field.key] as unknown[] : []), link.id];
    else if (data[field.key] === undefined) data[field.key] = link.id;
  }
  return data;
}

/**
 * EIN NEUER EINTRAG MIT ZUSAMMENHANG. Eine Art der Baza: hier, die Werte der
 * Achsen in ihren Verweisfeldern. Eine Art der Bibliothek (Quellen) oder des
 * Skryptorium (Texte, ein Rodzaj tekstu): dort — in der Quelle des Widoku
 * („Skąd"), beim Rodzaj tekstu in dem Skryptorium, das ihn hält, sonst in der
 * ersten dieser Art. 2026-10-23: ein Komentarz ist ein Rodzaj dieser Baza.
 */
export async function createHere(lib: CogitaLibrary, view: ViewDoc, here: HereContext): Promise<{ libraryId: string; id: string; inLibrary: boolean }> {
  const kindId = here.kind ?? kindOfView(view);
  if (kindId === null) throw new Error('Ten widok nie ma jednego rodzaju — wybierz rodzaj w „Wybór i grupy".');
  if (lib.isForeignKind(kindId)) {
    /* Ein Rodzaj tekstu: ein Text mit diesem Rodzaj; sonst eine Art der Bibliothek oder des Skryptorium. */
    const type = BOOK_KINDS.has(kindId) ? undefined : lib.kind(kindId);
    const plain = type === undefined ? kindId : 'text';
    const from = view.steps.find((s) => s.type === 'source.kind' && s.config.kind === kindId)?.config.from;
    const home = WRITING_KINDS.some((k) => k.kind === plain) ? 'writing' : 'books';
    const stores = lib.sourceList().filter((s) => s.kind === home);
    const target = typeof from === 'string' && from !== '' ? from
      : (type === undefined ? undefined : lib.origin(kindId)?.libraryId) ?? stores[0]?.store.libraryId;
    const store = storeIn(lib, target);
    if (store === undefined || target === undefined) throw new Error(home === 'writing' ? 'Ta baza nie korzysta z żadnego skryptorium — dodaj je w Ustawieniach (Źródła).' : 'Ta baza nie korzysta z żadnej biblioteki — dodaj ją w Ustawieniach (Źródła).');
    const placed = type === undefined ? {} : placeLinks(lib, type.fields, here.links);
    const data: EntryData = plain === 'text' ? { title: 'Nowy tekst', ...(type === undefined ? {} : { textType: kindId }), ...placed, ...here.fields } : { ...placed, ...here.fields };
    const saved = await store.save({ kind: plain, data });
    return { libraryId: target, id: saved.id, inLibrary: true };
  }
  const kind = lib.kind(kindId);
  const data: Record<string, unknown> = { ...placeLinks(lib, kind?.fields ?? [], here.links), ...here.fields };
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
  if (store === undefined || text === undefined || text.kind !== 'text') throw new Error('Nie ma takiego tekstu w skryptoriach tej bazy.');
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
