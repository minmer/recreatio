/**
 * DIE BIBLIOTHEK ALS JSON (0064) — hinaus, herein, und die Beschreibung
 * daneben (siehe [[json-import-export]]: jede Möglichkeit hat ihr JSON).
 *
 * <code>
 *   { "format": "recreatio/library", "version": 1, "name": "…",
 *     "entries": [ { "id", "kind", "key", "data": { … } } ] }
 * </code>
 *
 * <b>Herein ändert an Ort und Stelle:</b> ein Eintrag mit bekannter Kennung
 * (oder bekanntem Schlüssel derselben Art) wird geändert — nur die Felder,
 * die im Dokument stehen; was fehlt, bleibt. Alles andere entsteht neu.
 * Verweise dürfen Kennungen sein oder `@schlüssel` — so lässt sich eine
 * Bibliothek von Hand oder mit einem Sprachmodell schreiben, ohne eine
 * einzige Kennung zu kennen. Gelöscht wird nie.
 *
 * Die Beschreibung entsteht aus `libraryKinds.ts`; `app-library-check.mjs`
 * prüft, dass jedes Feld beschrieben ist.
 *
 * 2026-10-23 — EIN FORMAT JE TEIL, DIESELBE MASCHINE (`FormatSpec`): die
 * Bibliothek nimmt nur Quellen (`recreatio/library`: work, quote, person);
 * das Skryptorium (`recreatio/scriptorium`) seine Texte, Wygłoszenia,
 * Projekte und Rodzaje tekstów. Eine alte Datei mit anderen Arten wird
 * abgewiesen — mit dem Format, in das sie gehört.
 */

import { newId } from '../core/ids';
import { blockData, blockOf, type CommentBlock, type Run } from './blocks';
import { isUuid } from './library';
import { mapRefTokens } from './libraryMarkup';
import { kindOf, LIBRARY_KINDS, outline, slug, type EntryData, type LibEntry, type LibField, type LibKind, ALIASES, aliasesOf, mapMarkups, shownMarkup, type Lookup } from './libraryKinds';

export const LIBRARY_FORMAT = 'recreatio/library';

/**
 * 3: seit 2026-10-23 — nur Quellen (work, quote, person), ohne Themen. Eine
 * Datei mit Texten, Komentarzen oder Themen wird abgewiesen (sie gehören ins
 * Skryptorium bzw. als eigene Arten nach Nauka).
 */
export const LIBRARY_VERSION = 3;

/** 2026-10-23 — das Format des Skryptorium (`scriptorium/scriptoriumJson.ts` beschreibt es). */
export const SCRIPTORIUM_FORMAT = 'recreatio/scriptorium';

/**
 * WAS EIN FORMAT ANNIMMT (2026-10-23): seine Arten, in welcher Reihenfolge
 * gespeichert wird (wer genannt wird, zuerst), wohin eine fremde Art gehört,
 * und — im Skryptorium — die Felder, die ein Eintrag zusätzlich hat (die
 * seines Rodzaj tekstu).
 */
export interface FormatSpec {
  readonly format: string;
  readonly version: number;
  readonly kinds: readonly LibKind[];
  readonly saveOrder: readonly string[];
  /** Ein Satz, wohin eine Art gehört, die dieses Format nicht nimmt — `null`: einfach unbekannt. */
  readonly elsewhere: (kind: string) => string | null;
  /** Zusätzliche Felder eines Eintrags (im Skryptorium: die seines Rodzaj tekstu), aus seinen Daten und dem Dokument. */
  readonly extraFields?: (kind: string, data: Readonly<Record<string, unknown>>, resolve: (token: string) => string | null) => readonly ExtraField[];
  /** Ein Feld vom Typ `fields` lesen (die Felder eines Rodzaj tekstu). */
  readonly readFields?: (value: unknown, where: string, warn: (line: string) => void) => unknown;
}

/** 2026-10-23 — ein zusätzliches Feld: sein Schlüssel und wie ein Wert aus dem Dokument gelesen wird (`undefined`: weglassen). */
export interface ExtraField {
  readonly key: string;
  readonly read: (value: unknown, where: string, ctx: { readonly resolve: (token: string, where: string) => string | null; readonly warn: (line: string) => void }) => unknown;
}

const WRITING_KINDS_NAMED: Readonly<Record<string, string>> = { text: 'teksty', delivery: 'wygłoszenia', project: 'projekty', texttype: 'rodzaje tekstów' };

export const LIBRARY_SPEC: FormatSpec = {
  format: LIBRARY_FORMAT,
  version: LIBRARY_VERSION,
  kinds: LIBRARY_KINDS,
  saveOrder: ['person', 'work', 'quote'],
  elsewhere: (kind) => WRITING_KINDS_NAMED[kind] !== undefined
    ? `${WRITING_KINDS_NAMED[kind]} są teraz w Skryptorium — importuje się je tam (format "${SCRIPTORIUM_FORMAT}")`
    : kind === 'comment' ? 'komentarze są teraz własnym rodzajem w Wiedzy — gotowy schemat: plik templates/cogita/komentarz.json, a komentarze w JSON bazy wiedzy'
    : kind === 'topic' ? 'tematów już nie ma — porządek dają własne rodzaje w Wiedzy (np. „Tajemnica”, „Obszar”), połączone polami-odwołaniami'
    : null
};

/** Die Zitate EINES Buches (`libraryQuotes.ts`) — sie gehören auf die Seite dieses Buches. */
const QUOTES_FORMAT = 'recreatio/quotes';

/**
 * Eine Zahl, wie sie Menschen und Kataloge schreiben: „384", „384 s.",
 * „20,5 cm". Was mehr ist als eine Zahl mit Einheit („24 x 17 cm"), ist
 * keine — lieber eine Warnung als eine falsche Höhe.
 */
export function readAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*[^\d\s]*\.?\s*$/u.exec(String(value));
  return m === null ? null : Number(m[1]!.replace(',', '.'));
}

export interface ExportEntry {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
}

/** Was eine Bibliothek (oder ein Ausschnitt) als Dokument ist. */
/**
 * Hinaus — mit `look` stehen im Zapis die Schlüssel (`[@ratzinger2007]`), wie
 * man sie tippt und wie eine KI sie schreibt; gespeichert sind Kennungen
 * (2026-10-22). Wo ein Schlüssel von hier aus nicht eindeutig ist, bleibt die
 * Kennung stehen; der Import nimmt beides.
 */
export function exportLibrary(name: string, entries: readonly LibEntry[], look?: Lookup, spec: FormatSpec = LIBRARY_SPEC): Record<string, unknown> {
  const order = new Map(spec.kinds.map((k, i) => [k.kind, i]));
  const sorted = [...entries].filter((e) => order.has(e.kind)).sort((a, b) => (order.get(a.kind) ?? 99) - (order.get(b.kind) ?? 99));
  return {
    format: spec.format,
    version: spec.version,
    name,
    entries: sorted.map((e): ExportEntry => ({
      id: e.id, kind: e.kind, ...(e.key === undefined ? {} : { key: e.key }),
      data: look === undefined ? e.data : shownMarkup(e.kind, e.data, look)
    }))
  };
}

/* -- Herein ----------------------------------------------------------------------------------- */

export interface ImportDraft {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
  readonly existing: boolean;
}

export interface LibraryImportPlan {
  readonly drafts: readonly ImportDraft[];
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/** Was der Plan vom Bestand wissen muss. */
export interface ImportBase {
  get(id: string): LibEntry | undefined;
  byKey(key: string): LibEntry | undefined;
}

/** Eine Kennung für einen Punkt einer Liste — „p" und fünf Zeichen, eindeutig in der Liste. */
function itemId(taken: Set<string>): string {
  for (;;) {
    const id = `p${newId().replace(/-/g, '').slice(-5)}`;
    if (!taken.has(id)) return id;
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function planLibraryImport(doc: unknown, base: ImportBase, spec: FormatSpec = LIBRARY_SPEC): LibraryImportPlan | { error: string } {
  const root = asRecord(doc);
  const list: unknown[] = Array.isArray(doc) ? doc
    : Array.isArray(root.entries) ? root.entries
    : typeof root.kind === 'string' && typeof root.data === 'object' ? [root]
    : [];
  if (root.format === QUOTES_FORMAT) {
    return { error: `To są cytaty jednej książki ("${QUOTES_FORMAT}") — importuje się je na stronie tej książki: Źródła → książka → „Cytaty z tej książki”.` };
  }
  /* 2026-10-24 — ein Text eines Werks (mit oder ohne neues Werk) hat seinen eigenen Import. */
  if (root.format === 'recreatio/source-text') {
    return { error: 'To jest tekst źródła ("recreatio/source-text") — z nowym dziełem importuje się go w Źródłach: „Dzieło z tekstem (JSON)”; do dzieła, które już jest — na jego stronie, w ramce „Tekst źródła”.' };
  }
  if (list.length === 0) return { error: `To nie jest dokument w formacie "${spec.format}" — brakuje "entries" (albo "kind" i "data").` };
  if (root.format !== undefined && root.format !== spec.format) {
    const where = root.format === LIBRARY_FORMAT ? 'w Bibliotece' : root.format === SCRIPTORIUM_FORMAT ? 'w Skryptorium' : String(root.format).startsWith('recreatio.cogita') ? 'w Wiedzy (baza wiedzy → Więcej → Import i eksport)' : '';
    return { error: `Inny format: „${String(root.format)}”${where === '' ? '' : ` — ten importuje się ${where}`}; tu przyjmowany jest "${spec.format}".` };
  }
  const allowed = new Set(spec.kinds.map((k) => k.kind));
  /* 2026-10-23 — Arten, die dieses Format nicht nimmt, aber ein anderer Teil: die Datei gehört dorthin. */
  const foreign = new Map<string, number>();
  for (const one of list) {
    const kind = typeof asRecord(one).kind === 'string' ? String(asRecord(one).kind) : '';
    if (!allowed.has(kind) && spec.elsewhere(kind) !== null) foreign.set(kind, (foreign.get(kind) ?? 0) + 1);
  }
  if (foreign.size > 0) {
    return { error: `Ten plik ma wpisy, których tu się nie prowadzi: ${[...foreign].map(([kind, n]) => `${kind} (${n})`).join(', ')}. ${[...new Set([...foreign.keys()].map(spec.elsewhere))].join('; ')}.` };
  }

  const warnings: string[] = [];

  /* 1. Wer ist wer: bekannt (Kennung oder Schlüssel derselben Art) oder neu. */
  const placed: { raw: Record<string, unknown>; id: string; kind: string; key?: string; existing: LibEntry | undefined }[] = [];
  const keyToId = new Map<string, string>();
  const usedIds = new Set<string>();

  list.forEach((one, index) => {
    const raw = asRecord(one);
    const kind = typeof raw.kind === 'string' ? raw.kind : '';
    if (kindOf(kind) === undefined || !allowed.has(kind)) { warnings.push(`Wpis ${index + 1}: nieznany rodzaj „${kind}” — pominięty.`); return; }
    const givenId = typeof raw.id === 'string' ? raw.id.trim() : '';
    const givenKey = typeof raw.key === 'string' && raw.key.trim() !== '' ? raw.key.trim().replace(/^@/, '') : undefined;

    let existing = isUuid(givenId) ? base.get(givenId) : undefined;
    if (existing !== undefined && existing.kind !== kind) { warnings.push(`Wpis ${index + 1}: kennung należy do wpisu innego rodzaju — powstanie nowy.`); existing = undefined; }
    if (existing === undefined && givenKey !== undefined) {
      const byKey = base.byKey(givenKey);
      if (byKey !== undefined && byKey.kind === kind) existing = byKey;
    }
    let id = existing?.id ?? (isUuid(givenId) && base.get(givenId) === undefined ? givenId : newId());
    if (usedIds.has(id)) { warnings.push(`Wpis ${index + 1} powtarza wpis z tego samego dokumentu — pominięty.`); return; }
    usedIds.add(id);
    if (givenKey !== undefined) keyToId.set(givenKey.toLowerCase(), id);
    placed.push({ raw, id, kind, ...(givenKey === undefined ? {} : { key: givenKey }), existing });
  });

  /* 2. Verweise: Kennung, `@schlüssel` oder blosser Schlüssel. */
  const resolve = (value: unknown, where: string): string | null => {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const v = value.trim();
    if (isUuid(v) && (usedIds.has(v) || base.get(v) !== undefined)) return v;
    const key = v.replace(/^@/, '').toLowerCase();
    const id = keyToId.get(key) ?? base.byKey(key)?.id;
    if (id === undefined) warnings.push(`${where}: nie znaleziono „${v}” — odwołanie pominięte.`);
    return id ?? null;
  };

  const coerce = (field: LibField, value: unknown, where: string): unknown => {
    if (value === null) return null;
    switch (field.type) {
      case 'ref': {
        const one = Array.isArray(value) ? value[0] : value;
        return resolve(one, where);
      }
      case 'refs':
        return (Array.isArray(value) ? value : [value]).map((one) => resolve(one, where)).filter((id): id is string => id !== null);
      case 'outline':
        return (Array.isArray(value) ? value : []).map((item) => {
          const o = asRecord(item);
          if (typeof o.heading === 'string') return { heading: o.heading };
          const id = resolve(o.text, where);
          return id === null ? null : { text: id };
        }).filter((x) => x !== null);
      case 'number': {
        const n = readAmount(value);
        if (n === null) { warnings.push(`${where}: „${String(value)}” to nie liczba — pominięte.`); return null; }
        return n;
      }
      case 'items': {
        /*
         * 2026-10-21 — eine Liste von Objekten (die Punkte eines Plans): jedes
         * Feld nach seiner Art, Unbekanntes mit einer Warnung; ein Punkt ohne
         * (oder mit doppelter) Kennung bekommt eine neue.
         */
        const subs = field.item ?? [];
        const out: Record<string, unknown>[] = [];
        const unknown = new Set<string>();
        for (const raw of Array.isArray(value) ? value : []) {
          const given = typeof raw === 'string' ? { [subs.find((s) => s.type === 'markup')?.key ?? 'text']: raw } : asRecord(raw);
          const item: Record<string, unknown> = {};
          for (const [name, one] of Object.entries(given)) {
            const sub = subs.find((s) => s.key === name);
            if (sub === undefined) { unknown.add(name); continue; }
            const next = coerce(sub, one, `${where} · ${name}`);
            if (next !== null && next !== '' && !(Array.isArray(next) && next.length === 0)) item[name] = next;
          }
          if (Object.keys(item).length > 0) out.push(item);
        }
        if (unknown.size > 0) warnings.push(`${where}: nieznane pola punktów (${[...unknown].join(', ')}) — pominięte.`);
        if (subs.some((s) => s.key === 'id')) {
          const taken = new Set<string>();
          for (const item of out) {
            const id = typeof item.id === 'string' ? item.id.trim() : '';
            item.id = id === '' || taken.has(id) ? itemId(taken) : id;
            taken.add(item.id as string);
          }
        }
        return out;
      }
      case 'blocks': {
        const out: Record<string, unknown>[] = [];
        for (const [index, raw] of (Array.isArray(value) ? value : []).entries()) {
          const block = blockOf(raw);
          if (block === null) { warnings.push(`${where}: blok ${index + 1} nie ma rozpoznawalnej treści — pominięty.`); continue; }
          const runs = (cell: readonly Run[]): Run[] => cell.flatMap((run): Run[] => {
            if (!('ref' in run)) return [run];
            const id = resolve(run.ref, `${where} · blok ${index + 1}`);
            return id === null ? [] : [{ ref: id, ...(run.locator === undefined ? {} : { locator: run.locator }) }];
          });
          const fixed: CommentBlock = block.type === 'paragraph' ? block
            : block.type === 'table' ? { ...block, rows: block.rows.map((row) => row.map(runs)) }
            : { ...block, items: block.items.map(runs) };
          out.push(blockData(fixed));
        }
        return out;
      }
      case 'fields':
        return spec.readFields !== undefined ? spec.readFields(value, where, (line) => warnings.push(line)) : (Array.isArray(value) ? value : null);
      case 'media': {
        /*
         * 2026-10-26 — eine Datei, wie der Export sie schreibt (die Dateien der Musik). Hochgeladen wird in
         * der App; ein Dokument trägt nur den Verweis auf eine Datei, die schon liegt — in derselben Reihenfolge
         * der Felder wie gespeichert, damit ein Rücklauf nichts ändert.
         */
        const o = asRecord(value);
        if (typeof o.file !== 'string' || !isUuid(o.file)) {
          warnings.push(`${where}: to nie jest plik z eksportu (brak "file") — pominięte. Pliki wgrywa się w aplikacji.`);
          return null;
        }
        const type = o.type === 'image' || o.type === 'audio' || o.type === 'video' ? o.type : 'document';
        return {
          file: o.file, type,
          ...(typeof o.name === 'string' && o.name.trim() !== '' ? { name: o.name.slice(0, 200) } : {}),
          ...(typeof o.mime === 'string' && o.mime.trim() !== '' ? { mime: o.mime } : {}),
          ...(typeof o.library === 'string' && isUuid(o.library) ? { library: o.library } : {})
        };
      }
      case 'select': {
        const s = String(value);
        if (field.options === undefined || field.options.some((o) => o.value === s)) return s;
        /* „miękka" statt "soft": wer die Bezeichnung schreibt, meint den Wert. */
        const byLabel = field.options.find((o) => slug(o.label) === slug(s));
        if (byLabel !== undefined) return byLabel.value;
        warnings.push(`${where}: nieznana wartość „${s}”.`);
        return s;
      }
      default:
        return Array.isArray(value) ? value.map(String).join('\n') : typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  };

  /* 3. Die Felder — was im Dokument steht, ersetzt; was fehlt, bleibt. */
  const drafts: ImportDraft[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const one of placed) {
    const def = kindOf(one.kind)!;
    const given = { ...asRecord(one.raw.data) };
    const data: EntryData = { ...(one.existing?.data ?? {}) };

    /* 2026-10-23 — die Felder der Art und (im Skryptorium) die ihres Rodzaj tekstu. */
    const extra = spec.extraFields?.(one.kind, { ...data, ...given }, (token) => resolve(token, def.label)) ?? [];
    for (const [name, value] of Object.entries(given)) {
      const field = def.fields.find((f) => f.key === name);
      const where = `${def.label} „${String(given.title ?? given.name ?? given.text ?? one.key ?? '').slice(0, 40)}” · ${name}`;
      /* 2026-10-22 — alte Schlüssel (`_aliases`) reisen mit, ohne Warnung. */
      if (field === undefined && name === ALIASES) { const aliases = aliasesOf(given); if (aliases.length > 0) data[name] = aliases; else delete data[name]; continue; }
      /* 2026-10-23 — ein Feld seines Rodzaj tekstu: gelesen, wie der Rodzaj es sagt. */
      const more = field === undefined ? extra.find((f) => f.key === name) : undefined;
      if (more !== undefined) {
        const next = value === null ? undefined : more.read(value, where, { resolve: (token, at) => resolve(token, at), warn: (line) => warnings.push(line) });
        if (next === undefined || next === null || next === '' || (Array.isArray(next) && next.length === 0)) delete data[name];
        else data[name] = next;
        continue;
      }
      if (field === undefined) { warnings.push(`${where}: nieznane pole — pominięte.`); continue; }
      const next = coerce(field, value, where);
      if (next === null || next === '' || (Array.isArray(next) && next.length === 0 && field.type !== 'outline')) delete data[name];
      else data[name] = next;
    }
    if (one.kind === 'project' && Array.isArray(data.outline)) data.outline = outline(data);

    /*
     * 2026-10-22 — IM ZAPIS STEHEN IM SPEICHER KENNUNGEN. Ein Schlüssel aus dem
     * Dokument (oder des Bestands) wird hier zu seiner Kennung; was nicht
     * aufgeht, bleibt, wie es geschrieben ist — mit einer Warnung.
     */
    const lost = new Set<string>();
    const pinned = mapMarkups(one.kind, data, (text) => mapRefTokens(text, (token) => {
      if (isUuid(token) && (usedIds.has(token) || base.get(token) !== undefined)) return token;
      const id = keyToId.get(token.toLowerCase()) ?? base.byKey(token)?.id;
      if (id === undefined) { lost.add(token); return token; }
      return id;
    }));
    for (const [name, value] of Object.entries(pinned)) data[name] = value;
    for (const token of lost) warnings.push(`${def.label} „${String(given.title ?? given.name ?? one.key ?? '').slice(0, 40)}”: w tekście „@${token}” nie wskazuje żadnego wpisu — zostaje, jak jest.`);

    const key = one.key ?? one.existing?.key;
    if (one.existing !== undefined && JSON.stringify(one.existing.data) === JSON.stringify(data) && (one.existing.key ?? '') === (key ?? '')) {
      unchanged += 1;
      continue;
    }
    drafts.push({ id: one.id, kind: one.kind, ...(key === undefined ? {} : { key }), data, existing: one.existing !== undefined });
    if (one.existing === undefined) created += 1; else updated += 1;
  }

  drafts.sort((a, b) => spec.saveOrder.indexOf(a.kind) - spec.saveOrder.indexOf(b.kind));

  const byKind = spec.kinds.map((k) => [k.plural, drafts.filter((d) => d.kind === k.kind).length] as const).filter(([, n]) => n > 0);
  const lines = [
    `Nowe: ${created}, zmienione: ${updated}, bez zmian: ${unchanged}.`,
    ...(byKind.length === 0 ? [] : [byKind.map(([label, n]) => `${label}: ${n}`).join(' · ')])
  ];
  return { drafts, created, updated, unchanged, lines, warnings };
}

/**
 * 2026-10-21 — EIN EINTRAG AUS EINEM DOKUMENT, FÜR EIN OFFENES FORMULAR: was
 * ein Sprachmodell für dieses Wygłoszenie (diesen Plan) geschrieben hat, geht
 * in das Formular, nicht am Formular vorbei in den Speicher — sonst stiesse
 * das Speichern des Formulars danach auf eine neuere Fassung. Geprüft wird
 * wie beim Import (`planLibraryImport`); heraus kommen nur die Felder, die
 * das Dokument nennt (`null`: leeren).
 */
export function patchFromDoc(doc: unknown, target: { readonly id: string; readonly kind: string }, base: ImportBase, spec: FormatSpec = LIBRARY_SPEC):
  { patch: EntryData; lines: readonly string[]; warnings: readonly string[] } | { error: string } {
  const root = asRecord(doc);
  const list: unknown[] = Array.isArray(doc) ? doc : Array.isArray(root.entries) ? root.entries : typeof root.kind === 'string' || typeof root.data === 'object' ? [root] : [];
  if (root.format !== undefined && root.format !== spec.format) return { error: `Inny format: „${String(root.format)}”, a tu przyjmowany jest "${spec.format}".` };
  const records = list.map(asRecord);
  const mine = records.find((one) => one.id === target.id) ?? (records.filter((one) => one.kind === target.kind || one.kind === undefined).length === 1
    ? records.find((one) => one.kind === target.kind || one.kind === undefined) : undefined);
  if (mine === undefined) return { error: records.length === 0 ? 'Brak wpisu — dokument powinien mieć "entries" z jednym wpisem.' : 'Nie ma tu wpisu dla tego formularza (sprawdź "id" i "kind").' };
  const given = asRecord(mine.data);
  if (Object.keys(given).length === 0) return { error: 'Wpis nie ma pól ("data").' };
  const planned = planLibraryImport({ format: spec.format, entries: [{ id: target.id, kind: target.kind, data: given }] }, base, spec);
  if ('error' in planned) return planned;
  const draft = planned.drafts[0];
  const patch: EntryData = {};
  for (const key of Object.keys(given)) {
    if (kindOf(target.kind)?.fields.some((f) => f.key === key) !== true) continue;
    patch[key] = draft === undefined ? (base.get(target.id)?.data[key] ?? null) : (draft.data[key] ?? null);
  }
  const others = records.length - 1;
  return {
    patch,
    lines: [`Pola do wpisania w formularz: ${Object.keys(patch).join(', ') || 'żadne'}.`],
    warnings: [...planned.warnings, ...(others > 0 ? [`Pozostałe wpisy w dokumencie (${others}) są tu pomijane.`] : [])]
  };
}

/* -- Die Beschreibung --------------------------------------------------------------------------- */

const TYPE_SAYS: Record<LibField['type'], string> = {
  line: 'tekst', text: 'tekst (może mieć wiele wierszy)', markup: 'tekst w zapisie treści (niżej)', number: 'liczba',
  date: 'data RRRR-MM-DD', select: 'jedna z wartości', url: 'adres https://…', ref: 'odwołanie: kennung albo "@klucz"',
  refs: 'lista odwołań: kennungi albo "@klucze"', outline: 'lista punktów planu', items: 'lista obiektów o polach:',
  blocks: 'lista bloków (niżej: „Komentarz”)',
  fields: 'lista pól — jak pola rodzaju w Wiedzy',
  media: 'plik wgrany w aplikacji: { "file": kennunga pliku, "type": "audio" | "image" | "video" | "document", "name", "mime" } — taki, jaki daje eksport; nowych plików JSON nie wgrywa'
};

/** Ein Feld in der Beschreibung — bei `items` darunter seine Unterfelder. */
function fieldDoc(f: LibField, indent: string): string {
  const head = `${indent}"${f.key}" — ${f.label}: ${f.says} (${TYPE_SAYS[f.type]})`;
  if (f.type !== 'items') return head;
  return [head, ...(f.item ?? []).map((sub) => fieldDoc(sub, `${indent}    `))].join('\n');
}

/** 2026-10-23 — wie man eine Stelle der Schrift schreibt: im "locator" eines Zitats, in einem Przypis, im Feld z miejscem w Nauce. */
export const BIBLE_DOC = `Miejsce w Piśmie Świętym (odwołanie do dzieła z "workType": "bible" — w "locator" cytatu, w przypisie tekstu, w polu z miejscem w Wiedzy) pisz razem z księgą: Dz 1,14 · Dz 1,14-16 · Łk 1,26–2,5 · Dz 1,8.14 · Ps 23 · Mt 5,3-12; 6,1. Księgi mogą być po polsku (BT), łacinie (Nova Vulgata) albo angielsku (Acts 1:14) — aplikacja je rozpoznaje, porządkuje cytaty w kolejności Biblii i znajduje wszystko, co wskazuje na dany werset, we wszystkich przekładach.`;

export const MARKUP_DOC = `## Zapis treści (pola "body" i "further" tekstu, punkty planu "plan[].text", "transcript" i "added[].text" wygłoszenia)
  ## Śródtytuł            (# albo ## — śródtytuł, ### — mniejszy)
  Akapity oddziela pusta linia; pojedyncze przejście do nowej linii zostaje (psalmy, pieśni).
  **pogrubienie**  *kursywa*  [opis linku](https://…)
  [@klucz]                 odwołanie do źródła (dzieło, cytat, osoba) — staje się przypisem
  [@klucz, s. 23]          z miejscem w źródle
  [@bt, J 6,35; @klucz2]   kilka odwołań w jednym przypisie
  [@klucz-tekstu]          odwołanie do WŁASNEGO wpisu (tekst, projekt, wpis bazy wiedzy — np. komentarz) — nigdy przypis: w tekście staje się linkiem „(zob. jego tytuł)”
  [[te słowa|@klucz]]      link do wpisu z własnymi słowami (np. [[kazaniu o chlebie|@kazanie-chleb]]) — też nigdy przypis
  ^[treść przypisu]        własny przypis, bez źródła
  ![@klucz-cytatu]         cytat z biblioteki jako osobny blok, z podpisem skąd pochodzi
  ![@id-wpisu]             wpis bazy wiedzy z treścią w blokach (np. komentarz) jako osobny blok — cały, z tabelami
  [[house|@id-słowa]]      link do wpisu bazy wiedzy (np. słowa ze słownika) — czytelnik widzi go, jeśli może czytać tę bazę
  ![@id-widoku]            widok bazy wiedzy jako osobny blok (np. w punkcie planu): lista, która zmienia się razem z danymi — np. „psalmy jutrzni niedzielnej" z psałterza
  > tekst                  wcięty cytat
  - punkt   ·   1. punkt
  ---                      linia oddzielająca
  \\znak                    znak bez znaczenia (np. \\* zamiast kursywy)
Przypisy liczą się same; pierwszy raz źródło jest podane w całości, potem skrótem z „dz. cyt.”, a tuż po sobie — „Tamże”. Pod tekstem pojawia się bibliografia.
${BIBLE_DOC}
Źródło (to, co przyszło z zewnątrz) się cytuje, własne wpisy się linkuje: [@ratzinger2007, s. 183; @kazanie-chleb] daje przypis do książki i w tekście link „(zob. Chleb życia)”. Czego czytelnik nie może otworzyć, pokazuje się jako „[odwołanie niedostępne]” (albo same słowa z [[…|@…]]) — bez tytułu i bez klucza.
Klucz to pomoc przy pisaniu: aplikacja zapamiętuje stały odnośnik do wpisu (jego kennungę), więc późniejsza zmiana klucza nie psuje tekstu. Zamiast klucza można też podać kennungę wpisu: [@01a1…-…, s. 3]. Klucz, którego nie ma, zostaje w tekście, jak jest (z ostrzeżeniem przy imporcie).`;

/** Die Arten eines Formats in der Beschreibung — Felder und ein ausgefülltes Beispiel. */
export function kindsDoc(kinds: readonly LibKind[]): string {
  return kinds.map((def) => {
    const fields = def.fields.map((f) => fieldDoc(f, '  ')).join('\n');
    const example = { kind: def.kind, ...(def.example.key === undefined ? {} : { key: def.example.key }), data: def.example.data };
    /* 2026-10-26 — weitere Beispiele (ein Werk der Musik, sein Komponist und Chor). */
    const more = (def.more ?? []).map((one) => `\nPrzykład (${one.label}):\n${JSON.stringify({ kind: def.kind, ...(one.key === undefined ? {} : { key: one.key }), data: one.data }, null, 2)}`).join('');
    return `### "${def.kind}" — ${def.label}\n${def.says}${def.keyed ? ' Ma klucz cytowania.' : ''}\n"data":\n${fields}\nPrzykład:\n${JSON.stringify(example, null, 2)}${more}`;
  }).join('\n\n');
}

export function libraryDescription(): string {
  const kinds = kindsDoc(LIBRARY_KINDS);

  return `# Biblioteka jako JSON ("${LIBRARY_FORMAT}", wersja ${LIBRARY_VERSION})

Co robi import:
Biblioteka to kręgosłup cytowania: trzyma TYLKO źródła — dzieła ("work"), cytaty ("quote") i osoby jako autorów ("person"); wpis biblioteki wskazuje tylko inne wpisy biblioteki (cytat → swoje dzieło, dzieło → autorzy, tłumacze, książka albo czasopismo, w którym jest). Własne teksty (kazania, konferencje, artykuły) są w Skryptorium (format "${SCRIPTORIUM_FORMAT}"), a wiedza — komentarze, postacie, miejsca, wydarzenia — w Wiedzy (Cogita), jako własne rodzaje; oba te miejsca cytują stąd. Tematów nie ma.
- Każdy wpis to { "id", "kind", "key", "data" }. Wpis z kennung z eksportu (albo z kluczem istniejącego wpisu tego samego rodzaju) jest ZMIENIANY — tylko pola podane w "data"; pola, których nie ma, zostają. Żeby wyczyścić pole, podaj null.
- Wpis bez kennung (albo z nieznaną) powstaje nowy. Import niczego nie usuwa.
- Odwołania ("authors", "editors", "translators", "container", "work"; przy muzyce "composers", "lyricists", "arrangers", "performers", "piece", "album") mogą być kennungami albo kluczami: "@ratzinger2007". Klucze z tego samego dokumentu też działają — można opisać całą bibliotekę, nie znając żadnej kennung.
- Muzyka to też dzieła ("work"), z innym rodzajem: "piece" (utwór), "score" (nuty), "recording" (nagranie), "album" (płyta). Rodzaj decyduje, które pola dzieło ma. Nuty i nagranie wskazują swój utwór ("piece"), nagranie — swoją płytę ("album"). Pliki (strony nut, ścieżki nagrania: osobne głosy i instrumenty albo całość) wgrywa się w aplikacji; JSON opisuje je bez plików albo przenosi z eksportu. Miejsce w nagraniu to czas: "1:23", "1:23–1:45".
- Plik z innymi rodzajami (teksty, wygłoszenia, projekty, komentarze, tematy) zostanie odrzucony — z informacją, gdzie go zaimportować.
- "key" to klucz cytowania: krótki, bez spacji (np. "ratzinger2007"); w tekstach odwołuje się do niego [@ratzinger2007, s. 23]. Pominięty — zostanie zaproponowany sam.
- Liczby mogą mieć jednostkę ("384 s.", "20,5 cm"); pole wyboru przyjmuje wartość ("hard") albo jej nazwę ("Twarda").
- Cytaty z jednej książki (np. odczytane przez AI ze zdjęć) mają własny format "${QUOTES_FORMAT}" — importuje się je na stronie tej książki.
- Kto widzi wpis, decyduje wyłącznie obszar jego biblioteki: członkowie obszaru, a gdy obszar jest publiczny — wszyscy. Nie ma pól prywatnych ani publikowania pojedynczych wpisów; to, co ma zostać prywatne, idzie do biblioteki prywatnego obszaru.
Zwróć JEDEN obiekt JSON, bez komentarzy.

{
  "format": "${LIBRARY_FORMAT}",
  "version": ${LIBRARY_VERSION},
  "name": "Moja biblioteka",
  "entries": [ { "kind": "person", "key": "ratzinger", "data": { … } }, … ]
}

## Rodzaje wpisów
${kinds}

## Miejsce w źródle
${BIBLE_DOC}
Inne miejsca: "s. 23", "nr 24", "rozdz. 4"; w nagraniu — czas: "1:23", "1:23–1:45", "1:02:03".
`;
}
