/**
 * DOSTĘP DLA AI — DIE ABSCHRIFT EINES BEHÄLTERS (0126).
 *
 * Ein Assistent kann keine Hülle öffnen; er liest JSON über den Link
 * (`/ai/{link}`, `backend/Api/Library/AiAccess.Read.cs`). Was er liest, baut
 * dieser Browser: je Behälter (Bibliothek, Skryptorium, Baza wiedzy) ein
 * lesbares Dokument — Titel, Art, Felder, worauf ein Eintrag zeigt — aus
 * DEMSELBEN Code, der die Einträge in der App zeigt (`entryTitle`,
 * `labelOf`, die Arten mit ihren Feldern und deren Bedeutung, die
 * Beschreibung der Auszeichnung). So läuft die Beschreibung nie auseinander.
 *
 * <b>Nur innerhalb des Links.</b> Titel, Schlüssel und Verweise werden allein
 * über die Behälter dieses Links aufgelöst. Was ausserhalb liegt (ein anderer
 * Behälter des Bereichs, ein anderer Bereich), bleibt eine nackte Kennung —
 * kein Titel, kein Schlüssel verrät es.
 *
 * Format 1:
 * <code>
 *   { v: 1, library, part: books|writing|knowledge, name, madeAt, notes,
 *     kinds:   [{ id, name, says?, label?, fields: [{ key, label, type, says?, … }] }],
 *     entries: [{ id, kind, kinds?, kindName, typeName?, title, tell?, key?, updatedAt?, refs?, data }],
 *     texts?:  [{ id, work, workTitle?, workKey?, scheme, edition, parts: [{ key, label, order, first?, last?, pages?,
 *                 blocks: [{ type, level?, loc?, at?, pages?, text }] }] }] }
 * </code>
 *
 * 2026-10-24 — `texts`: die vollständigen Texte der Werke (`library/sourceText.ts`), die IN diesem
 * Behälter liegen — wer den Behälter liest, liest auch sie; ein Text in einem anderen (privaten)
 * Behälter kommt nur über ihn. Je Block: seine Stelle, wie sie dasteht (`loc`), die Stelle, zu der
 * er gehört, einheitlich geschrieben (`at`, auch geerbt), seine Seiten und sein Text — lesbar
 * gemacht ([s. 46] für einen Seitenwechsel, [^3] für einen Przypis, [?] für Unsicheres).
 */

import { CogitaLibrary } from '../cogita/store';
import { fieldData, textTypeKind } from '../cogita/kinds';
import { FIELD_TYPE_LABEL, FIELD_TYPES, labelOf, tellOf, VALUE_STATE_LABEL, VALUE_STATES, type KindDef } from '../cogita/schema';
import type { LibraryKind } from '../library/library';
import { BIBLE_DOC, MARKUP_DOC } from '../library/libraryJson';
import {
  entryTitle, ids, kindOf, LIBRARY_KINDS, refTarget, shownMarkup, textTypeName, WRITING_KINDS,
  type LibEntry, type LibField, type LibKind, type Lookup
} from '../library/libraryKinds';
import { citedKeys } from '../library/libraryMarkup';
import { blockPages, pieces, placeLabel, readManifest, readPart, type SourceBlock } from '../library/sourceText';
import type { LibraryStore } from '../library/libraryStore';

export const SNAPSHOT_VERSION = 1;

/** Ein Behälter des Links: sein Speicher, seine Art, sein Name — und (2026-10-24) die Texte, die in ihm liegen, geöffnet. */
export interface ScopePart {
  readonly store: LibraryStore;
  readonly kind: LibraryKind;
  readonly name: string;
  readonly texts?: readonly ScopeText[];
}

/** Ein Text eines Werks: sein Verzeichnis und seine Teile (die schweren Einträge, vorher geholt — `aiAccess.ts`). */
export interface ScopeText {
  readonly entry: LibEntry;
  readonly parts: readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[];
}

export interface SnapshotBlock {
  readonly type: string;
  readonly level?: number;
  readonly loc?: string;
  readonly at?: string;
  readonly pages?: readonly [number, number];
  readonly text: string;
}

export interface SnapshotText {
  readonly id: string;
  readonly work: string;
  readonly workTitle?: string;
  readonly workKey?: string;
  readonly scheme: string;
  readonly edition?: Readonly<Record<string, unknown>>;
  readonly parts: readonly { readonly key: string; readonly label: string; readonly order: number; readonly first?: string; readonly last?: string; readonly pages?: readonly [number, number]; readonly blocks: readonly SnapshotBlock[] }[];
}

export interface SnapshotEntry {
  readonly id: string;
  readonly kind: string;
  /** Mehrere Arten: ein Eintrag einer Baza wiedzy, ein Text mit seinem Rodzaj tekstu. */
  readonly kinds?: readonly string[];
  readonly kindName: string;
  readonly typeName?: string;
  readonly title: string;
  readonly tell?: string;
  readonly key?: string;
  readonly updatedAt?: string;
  /** Worauf er zeigt — nur Kennungen von Einträgen dieses Links. */
  readonly refs?: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

export interface SnapshotKind {
  readonly id: string;
  readonly name: string;
  readonly says?: string;
  readonly label?: string;
  readonly fields: readonly Readonly<Record<string, unknown>>[];
}

export interface SnapshotDoc {
  readonly v: typeof SNAPSHOT_VERSION;
  readonly library: string;
  readonly part: LibraryKind;
  readonly name: string;
  readonly madeAt: string;
  readonly notes: string;
  readonly kinds: readonly SnapshotKind[];
  readonly entries: readonly SnapshotEntry[];
  readonly texts?: readonly SnapshotText[];
  /** Die Texte waren zu gross für eine Abschrift und fehlen (die Einträge sind da). */
  readonly textsOmitted?: true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -- Was die Felder und die Auszeichnung bedeuten — aus dem Code, nicht daneben ----------- */

/** Für eine Baza wiedzy: wie Werte aussehen (die Typen und Stände aus `cogita/schema.ts`). */
const BASE_NOTES = (): string => `## Wpisy bazy wiedzy (Cogita)
Wpis ma rodzaje ("kinds" — pierwszy daje nazwę) i pola w "data" według swoich rodzajów; co znaczy każde pole — w "kinds" tego zbioru.
Typy pól: ${FIELD_TYPES.map((t) => `"${t}" (${FIELD_TYPE_LABEL[t]})`).join(', ')}.
Wartość bywa niepewna: {"value", "state", "source": {"work": id dzieła, "locator": "s. 23"}, "note"}; stany: ${VALUE_STATES.map((s) => `"${s}" (${VALUE_STATE_LABEL[s]})`).join(', ')}.
Odwołanie to id innego wpisu (z tytułem w "refs" wpisu); odwołanie z miejscem: {"value": id, "locator": "Ps 110"}.
Pole "blocks" to wypowiedź: akapity {"type": "paragraph", "text"}, listy {"type": "ordered"|"unordered", "items"}, tabele {"type": "table", "columns", "rows"}; komórka to lista kawałków {"text"} albo {"ref": id, "locator"}. Teza = pierwsze zdanie pierwszego akapitu.
Pytanie (rodzaj "question"): "form", "prompt", "answers", "options", "correct".
Daty: "1999", "1999-05", "1999-05-03", "-1000" (przed Chr.); zakres: {"segments": [{"from", "to"}]}.
Struktura (np. wywód artykułu): pole odwołania z "structure": "up" — ten wpis leży POD tym, na co wskazuje (krok pod pytaniem, odpowiedź na zarzut pod zarzutem); "structure": "down" — wskazane wpisy leżą pod nim. Korzeń (bez wartości w polu "up") to zwykle pytanie wiodące. Jego drzewo: przez MCP get_related(id korzenia, direction "in", fields: [klucz pola "up"], depth 3), potem znowu od każdego wpisu z głębokości 3 (najwyżej 60 wpisów na wywołanie; przy "truncated" krawędzie nazywają też te, które się nie zmieściły — od nich dalej); przez REST /entry/{id}: wpisy w "linkedFrom" z tym polem leżą bezpośrednio niżej — i tak dalej od każdego z nich (albo, przeglądając wszystkie wpisy: pod wpisem X leżą te, których pole "up" ma wartość X). Kolejność kroków to kolejność ich miejsc w dziele (pole odwołania z miejscem do dzieła z biblioteki). Wpisy wskazujące krok polem bez "structure" (np. komentarz: "O czym") nie należą do rekonstrukcji — to cudze lub własne uwagi.

${MARKUP_DOC}`;

const NOTES: Readonly<Record<LibraryKind, () => string>> = {
  books: () => `## Biblioteka — źródła
Dzieła ("work"), cytaty ("quote") i osoby ("person"); cytat wskazuje swoje dzieło, dzieło — autorów, tłumaczy, książkę albo czasopismo, w którym jest. "key" to klucz cytowania: w tekstach [@klucz, s. 23].
${BIBLE_DOC}`,
  writing: () => `## Skryptorium — własne teksty
Teksty ("text": tytuł, plan, treść, dalsze informacje; rodzaj tekstu dodaje swoje pola), ich wygłoszenia ("delivery": kiedy, gdzie, co z planu powiedziano, co pominięto), projekty ("project") i rodzaje tekstów ("texttype").

${MARKUP_DOC}`,
  knowledge: BASE_NOTES
};

const libField = (f: LibField): Record<string, unknown> => ({
  key: f.key, label: f.label, type: f.type, says: f.says,
  ...(f.hint === undefined ? {} : { hint: f.hint }),
  ...(f.to === undefined ? {} : { to: f.to }),
  ...(f.options === undefined ? {} : { options: f.options }),
  ...(f.item === undefined ? {} : { item: f.item.map(libField) })
});

const libKind = (def: LibKind): SnapshotKind => ({ id: def.kind, name: def.label, says: def.says, fields: def.fields.map(libField) });

/** Eine Art von Nauka (auch ein Rodzaj tekstu) — reine Daten, ohne leere Angaben. */
const cogitaKind = (kind: KindDef, name?: string): SnapshotKind => ({
  id: kind.id,
  name: name ?? kind.name,
  ...(kind.label === '' ? {} : { label: kind.label }),
  fields: kind.fields.map((f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== false && !(Array.isArray(v) && v.length === 0))))
});

/* -- Nachschlagen nur innerhalb des Links -------------------------------------------------- */

/**
 * Ein Lookup über alle Behälter des Links — für Titel (ein Zitat nennt sein
 * Werk), Schlüssel im Zapis und Verweise. Einträge einer Baza wiedzy heissen
 * mit ihrem Etikett aus Nauka.
 */
function scopeLookup(parts: readonly ScopePart[], bases: ReadonlyMap<string, CogitaLibrary>): Lookup {
  const byId = new Map<string, LibEntry>();
  const byKey = new Map<string, LibEntry>();
  const home = new Map<string, string>();
  const ordered = [...parts].sort((a, b) => order(a.kind) - order(b.kind));
  for (const part of ordered) {
    for (const entry of part.store.all()) {
      if (!byId.has(entry.id)) { byId.set(entry.id, entry); home.set(entry.id, part.store.libraryId); }
      const key = entry.key?.toLowerCase();
      if (key !== undefined && key !== '' && !byKey.has(key)) byKey.set(key, entry);
    }
  }
  const look: Lookup = {
    get: (id) => byId.get(id),
    byKey: (key) => byKey.get(key.toLowerCase()),
    readable: () => [...byId.values()],
    title: (entry) => {
      const lib = bases.get(home.get(entry.id) ?? '');
      const entity = lib?.entity(entry.id);
      return lib !== undefined && entity !== undefined ? labelOf(entity, lib.look) : entryTitle(entry, look);
    }
  };
  return look;
}

const order = (kind: LibraryKind): number => (kind === 'books' ? 0 : kind === 'writing' ? 1 : 2);

/**
 * WORAUF EIN EINTRAG ZEIGT — überall in seinen Daten: Kennungen in Feldern
 * (auch in Hüllen `{value}` und Zellen `{ref}`) und Verweise im Zapis
 * (`[@schlüssel]`, `[[…|@…]]`, `![@…]`). Nur, was dieser Link enthält.
 */
export function refsOf(entry: { readonly id: string; readonly data: Readonly<Record<string, unknown>> }, look: Lookup): string[] {
  const out = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > 12) return;
    if (typeof value === 'string') {
      const text = value.trim();
      if (UUID.test(text)) { if (look.get(text.toLowerCase()) !== undefined) out.add(text.toLowerCase()); return; }
      if (text.includes('@')) for (const token of citedKeys(text)) { const target = refTarget(look, token); if (target !== undefined) out.add(target.id); }
      return;
    }
    if (Array.isArray(value)) { for (const one of value) walk(one, depth + 1); return; }
    if (typeof value === 'object' && value !== null) for (const [key, one] of Object.entries(value)) if (!key.startsWith('_')) walk(one, depth + 1);
  };
  walk(entry.data, 0);
  out.delete(entry.id);
  return [...out];
}

/* -- Die Abschrift -------------------------------------------------------------------------- */

/** Bibliothek oder Skryptorium: die Einträge der Arten dieses Teils (alte Arten bleiben unter „Stare wpisy", nicht hier). */
function sourceEntries(part: ScopePart, look: Lookup): SnapshotEntry[] {
  const own = new Set((part.kind === 'books' ? LIBRARY_KINDS : WRITING_KINDS).map((k) => k.kind));
  const out: SnapshotEntry[] = [];
  for (const entry of part.store.all()) {
    const def = kindOf(entry.kind);
    if (def === undefined || !own.has(entry.kind)) continue;
    const typeId = entry.kind === 'text' ? ids(entry.data, 'textType')[0] : undefined;
    const typed = typeId !== undefined && look.get(typeId)?.kind === 'texttype';
    const typeName = typed ? textTypeName(entry.data, look) : '';
    const refs = refsOf(entry, look);
    out.push({
      id: entry.id,
      kind: entry.kind,
      ...(typed ? { kinds: [entry.kind, typeId] } : {}),
      kindName: def.label,
      ...(typeName === '' ? {} : { typeName }),
      title: entryTitle(entry, look),
      ...(entry.key === undefined || entry.key === '' ? {} : { key: entry.key }),
      ...(updatedOf(entry) === undefined ? {} : { updatedAt: updatedOf(entry) }),
      ...(refs.length === 0 ? {} : { refs }),
      data: fieldData(shownMarkup(entry.kind, entry.data, look))
    });
  }
  return out;
}

const updatedOf = (entry: LibEntry): string | undefined => {
  const at = (entry as { readonly updatedAt?: unknown }).updatedAt;
  return typeof at === 'string' && at !== '' ? at : undefined;
};

/** Baza wiedzy: ihre eigenen Einträge (Entitäten ihrer Arten, Pytania) — keine Werkzeuge (Szablony, Widoki, Powtórki …). */
function baseEntries(part: ScopePart, lib: CogitaLibrary, look: Lookup): SnapshotEntry[] {
  const out: SnapshotEntry[] = [];
  for (const entity of lib.entities()) {
    if (!lib.isOwn(entity.id)) continue;
    const entry = part.store.get(entity.id);
    const first = entity.kinds[0] ?? 'entity';
    const tell = tellOf(entity, lib.look);
    const refs = refsOf(entity, look);
    out.push({
      id: entity.id,
      kind: first,
      kinds: entity.kinds,
      kindName: lib.kind(first)?.name ?? first,
      title: labelOf(entity, lib.look),
      ...(tell === '' ? {} : { tell }),
      ...(entry?.key === undefined || entry.key === '' ? {} : { key: entry.key }),
      ...(entry === undefined || updatedOf(entry) === undefined ? {} : { updatedAt: updatedOf(entry) }),
      ...(refs.length === 0 ? {} : { refs }),
      data: fieldData(entity.data)
    });
  }
  return out;
}

/* -- 2026-10-24: die vollständigen Texte der Werke ----------------------------------------------------- */

/** Ein Text mit seinen Zeichen, lesbar: [s. 46] ein Seitenwechsel, [^3] ein Przypis, wyraz[?] unsicher, […] eine Lücke. */
function readable(text: string): string {
  return pieces(text).map((p) => (p.t === 'text' ? p.v : p.t === 'page' ? `[s. ${p.page}]` : p.t === 'note' ? `[^${p.id}]` : p.t === 'unsure' ? `${p.v}[?]` : '[…]')).join('');
}

function blockText(b: SourceBlock): string {
  switch (b.type) {
    case 'list': return (b.items ?? []).map((item, i) => `${b.ordered === true ? `${i + 1}.` : '-'} ${readable(item)}`).join('\n');
    case 'table': return [...((b.columns ?? []).length > 0 ? [(b.columns ?? []).map(readable).join(' | ')] : []), ...(b.rows ?? []).map((row) => row.map(readable).join(' | '))].join('\n');
    case 'note': return `[^${b.id ?? ''}] ${readable(b.text ?? '')}`;
    case 'page': return `[s. ${b.page ?? ''}${b.pdf === undefined ? '' : ` · PDF ${b.pdf}`}]`;
    default: return readable(b.text ?? '');
  }
}

/**
 * DIE TEXTE EINES BEHÄLTERS für die Abschrift: je Text sein Werk (Titel und Schlüssel nur, wenn
 * das Werk im Link ist), seine Regel der Stellen und seine Teile Block für Block. `at` ist die
 * Stelle, zu der ein Block gehört — auch geerbt —, so geschrieben, wie die App sie schreibt.
 */
export function snapshotTexts(texts: readonly ScopeText[], look: Lookup): SnapshotText[] {
  const out: SnapshotText[] = [];
  for (const text of texts) {
    const manifest = readManifest(text.entry.data);
    const work = look.get(manifest.work);
    const parts = manifest.parts.map((p) => {
      const found = text.parts.find((x) => x.id === p.id);
      const blocks = found === undefined ? [] : readPart(found.data).blocks;
      const pages = blockPages(blocks);
      let current = '';
      return {
        key: p.key, label: p.label, order: p.order,
        ...(p.first === undefined ? {} : { first: p.first }), ...(p.last === undefined ? {} : { last: p.last }), ...(p.pages === undefined ? {} : { pages: p.pages }),
        blocks: blocks.map((b, i): SnapshotBlock => {
          const own = b.loc !== undefined && b.loc.trim() !== '' ? b.loc.trim() : undefined;
          if (own !== undefined && b.type !== 'note' && b.type !== 'page') current = own;
          const at = own ?? (b.type === 'note' || b.type === 'page' ? '' : current);
          const range = pages[i];
          return {
            type: b.type,
            ...(b.type === 'heading' ? { level: b.level ?? 1 } : {}),
            ...(own === undefined ? {} : { loc: own }),
            ...(at === '' ? {} : { at: placeLabel(at, manifest.scheme, manifest.edition) || at }),
            ...(range === null ? {} : { pages: [range.from, range.to] as const }),
            text: blockText(b)
          };
        })
      };
    });
    out.push({
      id: text.entry.id,
      work: manifest.work,
      ...(work === undefined ? {} : { workTitle: entryTitle(work, look), ...(work.key === undefined ? {} : { workKey: work.key }) }),
      scheme: manifest.scheme,
      ...(Object.keys(manifest.edition).length === 0 ? {} : { edition: { ...manifest.edition } }),
      parts
    });
  }
  return out;
}

/** Die Arten, die ein Teil braucht, um gelesen zu werden — mit der Bedeutung jedes Feldes. */
function kindsFor(part: ScopePart, lib: CogitaLibrary | undefined, entries: readonly SnapshotEntry[]): SnapshotKind[] {
  if (part.kind === 'knowledge' && lib !== undefined) return lib.kinds.map((k) => cogitaKind(k));
  const used = new Set(entries.map((e) => e.kind));
  const kinds = (part.kind === 'books' ? LIBRARY_KINDS : WRITING_KINDS).filter((k) => used.has(k.kind)).map(libKind);
  /* Ein Rodzaj tekstu ist eine Art: seine Felder stehen neben den festen eines Textes. */
  const types = part.kind === 'writing'
    ? part.store.all().filter((e) => e.kind === 'texttype').map((e) => cogitaKind(textTypeKind(e), typeof e.data.name === 'string' && e.data.name.trim() !== '' ? e.data.name.trim() : 'Rodzaj tekstu'))
    : [];
  return [...kinds, ...types];
}

/**
 * DIE ABSCHRIFT EINES BEHÄLTERS des Links — rein gerechnet aus den offenen
 * Speichern (ohne Netz, ohne Schlüssel), damit sie ohne Browser prüfbar ist
 * (`scripts/app-library-check.mjs`). Holen, packen und versiegeln:
 * `aiAccess.ts`.
 */
export function snapshotDoc(parts: readonly ScopePart[], libraryId: string, madeAt: string, withTexts = true): SnapshotDoc {
  const part = parts.find((p) => p.store.libraryId === libraryId);
  if (part === undefined) throw new Error('Ten zbiór nie należy do tego dostępu.');

  /* Jede Baza wiedzy mit den anderen Behältern des Links als Quellen — nur mit ihnen. */
  const bases = new Map<string, CogitaLibrary>();
  for (const one of parts) {
    if (one.kind !== 'knowledge') continue;
    const lib = new CogitaLibrary(one.store, false);
    lib.setSources(parts.filter((o) => o !== one).map((o) => ({ store: o.store, kind: o.kind, name: o.name })));
    bases.set(one.store.libraryId, lib);
  }
  const look = scopeLookup(parts, bases);
  const lib = bases.get(libraryId);
  const entries = part.kind === 'knowledge' && lib !== undefined ? baseEntries(part, lib, look) : sourceEntries(part, look);
  return {
    v: SNAPSHOT_VERSION,
    library: libraryId,
    part: part.kind,
    name: part.name,
    madeAt,
    notes: NOTES[part.kind](),
    kinds: kindsFor(part, lib, entries),
    entries,
    ...(part.texts === undefined || part.texts.length === 0 ? {} : withTexts ? { texts: snapshotTexts(part.texts, look) } : { textsOmitted: true as const })
  };
}

/** gzip (CompressionStream, im Browser wie in Node) — der Dienst entpackt mit einer Obergrenze. */
export async function gzip(text: string): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') throw new Error('Ta przeglądarka nie umie spakować odpisu — otwórz aplikację w nowszej.');
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
