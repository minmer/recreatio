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
import { t, texts } from '../core/i18n';
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

const WRITING_KINDS_NAMED: Readonly<Record<string, string>> = texts({ text: 'libraryData.writingKinds.text', delivery: 'libraryData.writingKinds.delivery', project: 'libraryData.writingKinds.project', texttype: 'libraryData.writingKinds.texttype' });

export const LIBRARY_SPEC: FormatSpec = {
  format: LIBRARY_FORMAT,
  version: LIBRARY_VERSION,
  kinds: LIBRARY_KINDS,
  saveOrder: ['person', 'work', 'quote'],
  elsewhere: (kind) => WRITING_KINDS_NAMED[kind] !== undefined
    ? t('libraryData.import.inScriptorium', { kinds: WRITING_KINDS_NAMED[kind]!, format: SCRIPTORIUM_FORMAT })
    : kind === 'comment' ? t('libraryData.import.commentsElsewhere')
    : kind === 'topic' ? t('libraryData.import.topicsGone')
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
    return { error: t('libraryData.import.quotesFormat', { format: QUOTES_FORMAT }) };
  }
  /* 2026-10-24 — ein Text eines Werks (mit oder ohne neues Werk) hat seinen eigenen Import. */
  if (root.format === 'recreatio/source-text') {
    return { error: t('libraryData.import.sourceText') };
  }
  if (list.length === 0) return { error: t('libraryData.import.notFormat', { format: spec.format }) };
  if (root.format !== undefined && root.format !== spec.format) {
    const where = root.format === LIBRARY_FORMAT ? t('libraryData.import.inLibrary') : root.format === SCRIPTORIUM_FORMAT ? t('libraryData.import.inScriptoriumWhere') : String(root.format).startsWith('recreatio.cogita') ? t('libraryData.import.inKnowledge') : '';
    return { error: t(where === '' ? 'libraryData.import.otherFormat' : 'libraryData.import.otherFormatWhere', { given: String(root.format), where, format: spec.format }) };
  }
  const allowed = new Set(spec.kinds.map((k) => k.kind));
  /* 2026-10-23 — Arten, die dieses Format nicht nimmt, aber ein anderer Teil: die Datei gehört dorthin. */
  const foreign = new Map<string, number>();
  for (const one of list) {
    const kind = typeof asRecord(one).kind === 'string' ? String(asRecord(one).kind) : '';
    if (!allowed.has(kind) && spec.elsewhere(kind) !== null) foreign.set(kind, (foreign.get(kind) ?? 0) + 1);
  }
  if (foreign.size > 0) {
    return { error: t('libraryData.import.foreign', { list: [...foreign].map(([kind, n]) => `${kind} (${n})`).join(', '), where: [...new Set([...foreign.keys()].map(spec.elsewhere))].join('; ') }) };
  }

  const warnings: string[] = [];

  /* 1. Wer ist wer: bekannt (Kennung oder Schlüssel derselben Art) oder neu. */
  const placed: { raw: Record<string, unknown>; id: string; kind: string; key?: string; existing: LibEntry | undefined }[] = [];
  const keyToId = new Map<string, string>();
  const usedIds = new Set<string>();

  list.forEach((one, index) => {
    const raw = asRecord(one);
    const kind = typeof raw.kind === 'string' ? raw.kind : '';
    if (kindOf(kind) === undefined || !allowed.has(kind)) { warnings.push(t('libraryData.import.unknownKind', { n: index + 1, kind })); return; }
    const givenId = typeof raw.id === 'string' ? raw.id.trim() : '';
    const givenKey = typeof raw.key === 'string' && raw.key.trim() !== '' ? raw.key.trim().replace(/^@/, '') : undefined;

    let existing = isUuid(givenId) ? base.get(givenId) : undefined;
    if (existing !== undefined && existing.kind !== kind) { warnings.push(t('libraryData.import.idOtherKind', { n: index + 1 })); existing = undefined; }
    if (existing === undefined && givenKey !== undefined) {
      const byKey = base.byKey(givenKey);
      if (byKey !== undefined && byKey.kind === kind) existing = byKey;
    }
    let id = existing?.id ?? (isUuid(givenId) && base.get(givenId) === undefined ? givenId : newId());
    if (usedIds.has(id)) { warnings.push(t('libraryData.import.repeated', { n: index + 1 })); return; }
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
    if (id === undefined) warnings.push(t('libraryData.import.refNotFound', { where, ref: v }));
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
        if (n === null) { warnings.push(t('libraryData.import.notNumber', { where, value: String(value) })); return null; }
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
        if (unknown.size > 0) warnings.push(t('libraryData.import.unknownItemFields', { where, list: [...unknown].join(', ') }));
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
          if (block === null) { warnings.push(t('libraryData.import.blockEmpty', { where, n: index + 1 })); continue; }
          const runs = (cell: readonly Run[]): Run[] => cell.flatMap((run): Run[] => {
            if (!('ref' in run)) return [run];
            const id = resolve(run.ref, `${where} · ${t('librarySource.import.block', { n: index + 1 })}`);
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
          warnings.push(t('libraryData.import.notFile', { where }));
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
        warnings.push(t('libraryData.import.unknownValue', { where, value: s }));
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
      if (field === undefined) { warnings.push(t('libraryData.import.unknownField', { where })); continue; }
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
    for (const token of lost) warnings.push(t('libraryData.import.lostRef', { kind: def.label, title: String(given.title ?? given.name ?? one.key ?? '').slice(0, 40), token }));

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
    t('libraryData.import.counts', { created, updated, unchanged }),
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
  if (root.format !== undefined && root.format !== spec.format) return { error: t('libraryData.patch.otherFormat', { given: String(root.format), format: spec.format }) };
  const records = list.map(asRecord);
  const mine = records.find((one) => one.id === target.id) ?? (records.filter((one) => one.kind === target.kind || one.kind === undefined).length === 1
    ? records.find((one) => one.kind === target.kind || one.kind === undefined) : undefined);
  if (mine === undefined) return { error: records.length === 0 ? t('libraryData.patch.noEntry') : t('libraryData.patch.notForForm') };
  const given = asRecord(mine.data);
  if (Object.keys(given).length === 0) return { error: t('libraryData.patch.noData') };
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
    lines: [t('libraryData.patch.fields', { list: Object.keys(patch).join(', ') || t('libraryData.patch.none') })],
    warnings: [...planned.warnings, ...(others > 0 ? [t('libraryData.patch.others', { n: others })] : [])]
  };
}

/* -- Die Beschreibung --------------------------------------------------------------------------- */

const TYPE_SAYS = (type: LibField['type']): string => t(`libraryData.typeSays.${type}`);

/** Ein Feld in der Beschreibung — bei `items` darunter seine Unterfelder. */
function fieldDoc(f: LibField, indent: string): string {
  const head = `${indent}"${f.key}" — ${f.label}: ${f.says} (${TYPE_SAYS(f.type)})`;
  if (f.type !== 'items') return head;
  return [head, ...(f.item ?? []).map((sub) => fieldDoc(sub, `${indent}    `))].join('\n');
}

/** 2026-11-05 — dieselben Beschreibungen in der Sprache der App. */
export const bibleDoc = (): string => t('libraryData.describe.bible');
export const markupDoc = (): string => t('libraryData.describe.markup', { bible: bibleDoc() });


/** Die Arten eines Formats in der Beschreibung — Felder und ein ausgefülltes Beispiel. */
export function kindsDoc(kinds: readonly LibKind[]): string {
  return kinds.map((def) => {
    const fields = def.fields.map((f) => fieldDoc(f, '  ')).join('\n');
    const example = { kind: def.kind, ...(def.example.key === undefined ? {} : { key: def.example.key }), data: def.example.data };
    /* 2026-10-26 — weitere Beispiele (ein Werk der Musik, sein Komponist und Chor). */
    const more = (def.more ?? []).map((one) => `\n${t('libraryData.kindsDoc.exampleOf', { label: one.label })}\n${JSON.stringify({ kind: def.kind, ...(one.key === undefined ? {} : { key: one.key }), data: one.data }, null, 2)}`).join('');
    return `### "${def.kind}" — ${def.label}\n${def.says}${def.keyed ? t('libraryData.kindsDoc.keyed') : ''}\n"data":\n${fields}\n${t('libraryData.kindsDoc.example')}\n${JSON.stringify(example, null, 2)}${more}`;
  }).join('\n\n');
}

/**
 * 2026-10-30 — am Ende „Jak aplikacja używa tych danych": wo die Einträge danach stehen und wer sie liest
 * (Skryptorium, Bazy wiedzy, Seiten, Czytnik, Dostęp dla AI) — nur, was der Code tut.
 */
export function libraryDescription(): string {
  const kinds = kindsDoc(LIBRARY_KINDS);

  return `${t('libraryData.describe.head', { format: LIBRARY_FORMAT, version: LIBRARY_VERSION, scriptorium: SCRIPTORIUM_FORMAT, quotes: QUOTES_FORMAT })}
${kinds}

${t('libraryData.describe.placeHead')}
${bibleDoc()}
${t('libraryData.describe.places')}

${t('libraryData.describe.use')}
`;
}
