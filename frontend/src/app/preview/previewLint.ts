/**
 * 2026-10-27 — WAS DER IMPORT VON EINEM DOKUMENT NICHT NIMMT, Schlüssel für
 * Schlüssel — für den Assistenten, der es geschrieben hat.
 *
 * <b>Die Leser des Imports sind duldsam</b>: was nicht passt, fällt still weg
 * (`part.ts`, `slides.ts`, `presentation.ts`). Für einen Menschen im Editor ist
 * das richtig — für ein Sprachmodell, das einen Schlüssel erfunden hat, heisst
 * es: es sieht nie, dass er nichts bewirkt. Deshalb hier ausdrücklich:
 *
 * <code>
 *   unknown  diesen Schlüssel liest nichts (er steht in keiner Beschreibung)
 *   dropped  der Import lässt ihn fallen — unbekannt, ungültig oder die Vorgabe
 *   changed  der Import liest ihn anders (eingerastet, begrenzt, ersetzt)
 * </code>
 *
 * Gemessen wird an den Lesern selbst: das Dokument geht durch denselben Leser
 * und dieselbe Ausgabe wie beim Export (`toJson(fromJson(…))`, `slideJson`,
 * `pieceJson`, `showJson`) — was dabei verschwindet oder sich ändert, steht da.
 *
 * Rein, ohne Browser — `scripts/app-preview-check.mjs` prüft es.
 */

import { asArray, asRecord, asText } from '../pages/event/kit';
import { BREAKPOINTS, COLUMNS, snapColSpan, snapRowSpan } from '../pages/layout';
import { documentKind } from '../pages/pageJson';
import { menuImageOf } from '../pages/menuPath';
import { partOf } from '../pages/parts/registry';
import { pieceJson, readPieceValue, readShow, showJson } from '../pages/presentation/presentation';
import { readSlideValue, slideJson } from '../pages/slides/slides';
import { deckJson, layersJson, readDeck, readLayers } from '../pages/slides/slideLook';

export interface LintItem {
  /** Wo im Dokument: `modules[2].config.subtitle`, `show.scenes[1].change`. */
  readonly path: string;
  readonly kind: 'unknown' | 'dropped' | 'changed';
  readonly detail: string;
}

const ROOT_KEYS = new Set([
  'format', 'version', 'path', 'title', 'lead', 'mode', 'theme', 'cover', 'show', 'deck', 'menu', 'logic', 'subject',
  'modules', 'parts', 'images', 'appointments', 'calendars'
]);

/** Was ein Eintrag von "modules" tragen kann — die Stelle, ihr Modul und (bei einem Formular) alles eines Modul-Dokuments. */
const ENTRY_KEYS = new Set([
  'id', 'module', 'name', 'kind', 'slide', 'show', 'layout', 'size', 'config',
  'questions', 'design', 'needs', 'repeat', 'memberRoles', 'memberRole', 'virtualAreas', 'audience', 'group', 'extends',
  /* ein Modul- oder Baustein-Dokument */
  'format', 'version'
]);

const THEME_KEYS = new Set(['mode', 'accent', 'ink', 'ground', 'muted', 'night']);
const PALETTE_KEYS = new Set(['accent', 'ink', 'ground', 'muted']);
const MENU_KEYS = new Set(['label', 'kind', 'target', 'children', 'image']);
const FRAME_KEYS = new Set(['position', 'size']);

const isPlain = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const has = (record: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

/** Ein Wert kurz, wie er im Dokument steht. */
function shown(value: unknown): string {
  if (typeof value === 'string') return `"${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
  if (value === undefined) return '—';
  const said = JSON.stringify(value);
  return said.length > 48 ? `${said.slice(0, 48)}…` : said;
}

/** Nichts, was etwas bewirken könnte: leer, null, eine leere Liste. */
const blank = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0)
  || (isPlain(value) && Object.keys(value).length === 0);

/** Gleich, wie der Import es meint: Zahl und Text derselben Zahl, Zeilen als Liste oder als Text. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if ((typeof a === 'number' || typeof a === 'boolean') && typeof b === 'string') return String(a) === b;
  if (typeof a === 'string' && (typeof b === 'number' || typeof b === 'boolean')) return a === String(b);
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim();
  return false;
}

/**
 * DAS DOKUMENT GEGEN DAS, WAS DER LESER DARAUS MACHT. Fällt ein Schlüssel weg,
 * ist er `dropped`; liest der Leser einen Wert anders, `changed`. Listen
 * werden Eintrag für Eintrag verglichen, solange keiner wegfällt — sonst
 * steht nur da, wie viele bleiben (die Folge verschiebt sich).
 */
function compare(input: unknown, output: unknown, path: string, out: LintItem[], depth = 0): void {
  if (depth > 14) return;
  if (isPlain(input)) {
    const after = isPlain(output) ? output : {};
    for (const [key, value] of Object.entries(input)) {
      const at = `${path}.${key}`;
      if (!has(after, key)) {
        if (!blank(value)) out.push({ path: at, kind: 'dropped', detail: `pominięty przy imporcie (nieznany, nieprawidłowy albo równy domyślnemu): ${shown(value)}` });
        continue;
      }
      compare(value, after[key], at, out, depth + 1);
    }
    return;
  }
  if (Array.isArray(input)) {
    if (typeof output === 'string' && input.every((one) => typeof one === 'string')) {
      /* Zeilen oder Kennungen: als Liste geschrieben, als Text gespeichert. */
      const joined = output.split(output.includes('\n') ? '\n' : ',').map((one) => one.trim());
      if (input.map((one) => String(one).trim()).filter((one) => one !== '').join('|') !== joined.filter((one) => one !== '').join('|')) {
        out.push({ path, kind: 'changed', detail: `import czyta ${shown(input)} jako ${shown(output)}` });
      }
      return;
    }
    if (!Array.isArray(output)) {
      if (!blank(input)) out.push({ path, kind: 'dropped', detail: `pominięte przy imporcie: ${shown(input)}` });
      return;
    }
    if (output.length !== input.length) {
      out.push({ path, kind: 'dropped', detail: `z ${input.length} wpisów import bierze ${output.length} — pozostałe są nieprawidłowe albo nieznane` });
      return;
    }
    input.forEach((one, i) => compare(one, output[i], `${path}[${i}]`, out, depth + 1));
    return;
  }
  if (typeof input === 'string' && Array.isArray(output) && output.every((one) => typeof one === 'string')) {
    /* Ein Text mit "\n", gespeichert als Zeilen: gleich, wenn die Zeilen gleich sind. */
    if (input.split('\n').map((one) => one.trim()).join('|') !== output.map((one) => String(one).trim()).join('|')
      && input.split(',').map((one) => one.trim()).join('|') !== output.map((one) => String(one).trim()).join('|')) {
      out.push({ path, kind: 'changed', detail: `import czyta ${shown(input)} jako ${shown(output)}` });
    }
    return;
  }
  if (!same(input, output)) out.push({ path, kind: 'changed', detail: `import czyta ${shown(input)} jako ${shown(output)}` });
}

/** Jeder Pfad eines Werts, Listen als `[]`: `groups`, `groups[].rows[].time`. */
function pathsOf(value: unknown, prefix: string, out: Map<string, string>, real: string): void {
  if (isPlain(value)) {
    for (const [key, one] of Object.entries(value)) {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      const at = `${real}.${key}`;
      if (!out.has(path)) out.set(path, at);
      pathsOf(one, path, out, at);
    }
    return;
  }
  if (Array.isArray(value)) value.forEach((one, i) => pathsOf(one, `${prefix}[]`, out, `${real}[${i}]`));
}

/**
 * DIE SCHLÜSSEL EINER TAFEL gegen ihre Beschreibung (`PartJson.keys`). Nur wo
 * die Beschreibung die Einträge eines Behälters nennt, ist ein ungenannter
 * unbekannt — ein Behälter ohne genannte Einträge ist frei (ein Bild, eine Szene).
 */
function undocumented(kind: string, config: Record<string, unknown>, at: string, out: LintItem[]): void {
  const def = partOf(kind);
  if (def === undefined) return;
  const documented = [...Object.keys(def.json.keys)];
  const named = new Set(documented);
  /* Ein Behälter, in dem etwas beschrieben steht (`groups[].rows` in `groups[].rows[].time`). */
  const enumerated = (path: string) => documented.some((key) => key.startsWith(`${path}.`) || key.startsWith(`${path}[]`));
  /*
   * Ein Behälter, dessen Einträge die Beschreibung AUFZÄHLT: mindestens zwei
   * eigene. Nennt sie nur einen, ist es meist eine freie Tafel mit einem Beispiel
   * (`sim.events[].set.vy` — die Namen dort wählt der Autor).
   */
  const listed = (path: string) => new Set(documented
    .filter((key) => key.startsWith(`${path}.`))
    .map((key) => key.slice(path.length + 1).split(/[.[]/)[0])).size >= 2;
  const parentOf = (path: string) => {
    const dot = path.lastIndexOf('.');
    return dot < 0 ? '' : path.slice(0, dot);
  };
  const paths = new Map<string, string>();
  pathsOf(config, '', paths, at);
  for (const [path, real] of paths) {
    if (named.has(path) || enumerated(path)) continue;
    const parent = parentOf(path);
    /* Unter einem Behälter, dessen Einträge niemand aufzählt, lässt sich nichts sagen (ein freies Objekt). */
    if (parent !== '' && !listed(parent)) continue;
    out.push({ path: real, kind: 'unknown', detail: `nieznany klucz modułu „${def.label}” (${kind}) — nic go nie czyta` });
  }
}

/** Ein Platz im Raster: was einrastet und was begrenzt wird. `name` macht aus einem Schlüssel des Eintrags seinen Pfad. */
function frameNotes(entry: Record<string, unknown>, name: (key: string) => string, out: LintItem[]): void {
  const layout = asRecord(entry.layout);
  for (const key of Object.keys(layout)) {
    if (!(BREAKPOINTS as readonly string[]).includes(key)) {
      out.push({ path: name(`layout.${key}`), kind: 'unknown', detail: `nieznany rozmiar ekranu — dozwolone: ${BREAKPOINTS.join(', ')}` });
    }
  }
  for (const bp of BREAKPOINTS) {
    if (!has(layout, bp)) continue;
    const frame = asRecord(layout[bp]);
    for (const key of Object.keys(frame)) if (!FRAME_KEYS.has(key)) out.push({ path: name(`layout.${bp}.${key}`), kind: 'unknown', detail: 'nieznany klucz — miejsce to "position" { row, col } i "size" { colSpan, rowSpan }' });
    const size = asRecord(frame.size);
    const position = asRecord(frame.position);
    if (typeof size.colSpan !== 'number' || typeof size.rowSpan !== 'number') {
      out.push({ path: name(`layout.${bp}`), kind: 'dropped', detail: 'bez liczb "size.colSpan" i "size.rowSpan" — import pomija to miejsce (moduł stanie w pierwszym wolnym)' });
      continue;
    }
    const colSpan = snapColSpan(size.colSpan, COLUMNS[bp]);
    const rowSpan = snapRowSpan(size.rowSpan);
    if (colSpan !== size.colSpan) out.push({ path: name(`layout.${bp}.size.colSpan`), kind: 'changed', detail: `${size.colSpan} → ${colSpan} (szerokości 2, 3, 4, 6; na tym ekranie najwyżej ${COLUMNS[bp]})` });
    if (rowSpan !== size.rowSpan) out.push({ path: name(`layout.${bp}.size.rowSpan`), kind: 'changed', detail: `${size.rowSpan} → ${rowSpan} (wysokości 1 pasek, 3 blok, 5 wysoki)` });
    if (typeof position.col === 'number' && position.col + colSpan - 1 > COLUMNS[bp]) {
      out.push({ path: name(`layout.${bp}.position.col`), kind: 'changed', detail: `${position.col} → ${COLUMNS[bp] - colSpan + 1} (moduł nie mieści się w ${COLUMNS[bp]} kolumnach)` });
    }
  }
}

function themeNotes(value: unknown, out: LintItem[]): void {
  if (value === null || !isPlain(value)) return;
  for (const [key, one] of Object.entries(value)) {
    if (!THEME_KEYS.has(key)) { out.push({ path: `theme.${key}`, kind: 'unknown', detail: `nieznany klucz — dozwolone: ${[...THEME_KEYS].join(', ')}` }); continue; }
    if (key === 'mode' || key === 'night') continue;
    if (!/^#[0-9a-f]{6}$/i.test(asText(one))) out.push({ path: `theme.${key}`, kind: 'changed', detail: `${shown(one)} to nie kolor #rrggbb — import weźmie kolor domyślny` });
  }
  if (isPlain(value.night)) {
    for (const [key, one] of Object.entries(value.night)) {
      if (!PALETTE_KEYS.has(key)) out.push({ path: `theme.night.${key}`, kind: 'unknown', detail: 'nieznany klucz — dozwolone: accent, ink, ground, muted' });
      else if (!/^#[0-9a-f]{6}$/i.test(asText(one))) out.push({ path: `theme.night.${key}`, kind: 'dropped', detail: `${shown(one)} to nie kolor #rrggbb — bez nocnych kolorów (muszą być wszystkie cztery)` });
    }
  }
}

function menuNotes(value: unknown, at: string, out: LintItem[], depth = 0): void {
  asArray(value).forEach((raw, i) => {
    const one = asRecord(raw);
    const here = `${at}[${i}]`;
    for (const key of Object.keys(one)) if (!MENU_KEYS.has(key)) out.push({ path: `${here}.${key}`, kind: 'unknown', detail: `nieznany klucz pozycji menu — dozwolone: ${[...MENU_KEYS].join(', ')}` });
    if (asText(one.label).trim() === '') out.push({ path: here, kind: 'dropped', detail: 'pozycja bez "label" — import ją pomija' });
    if (has(one, 'image') && asText(one.image).trim() !== '' && menuImageOf(one.image) === null) {
      out.push({ path: `${here}.image`, kind: 'dropped', detail: 'to nie obraz (page-image:<id>, https://… albo /plik.svg) — zostaje sama nazwa' });
    }
    if (depth >= 4 && asArray(one.children).length > 0) out.push({ path: `${here}.children`, kind: 'dropped', detail: 'menu ma najwyżej 5 poziomów — głębsze pozycje są pomijane' });
    else menuNotes(one.children, `${here}.children`, out, depth + 1);
  });
}

/** WAS DER IMPORT VON DIESEM DOKUMENT NICHT NIMMT — oder anders liest. */
export function lintDocument(doc: unknown): LintItem[] {
  const out: LintItem[] = [];
  const kind = documentKind(doc);
  if (kind === 'legacy' || kind === 'unknown') return out;
  const root = asRecord(doc);

  if (kind === 'page') {
    for (const key of Object.keys(root)) if (!ROOT_KEYS.has(key)) out.push({ path: key, kind: 'unknown', detail: `nieznany klucz strony — dozwolone: ${[...ROOT_KEYS].join(', ')}` });
    if (has(root, 'theme')) themeNotes(root.theme, out);
    if (has(root, 'show') && root.show !== null) compare(root.show, showJson(readShow(root.show)), 'show', out);
    if (has(root, 'deck') && root.deck !== null) compare(root.deck, deckJson(readDeck(root.deck)) ?? {}, 'deck', out);
    if (has(root, 'cover')) compare(root.cover, layersJson(readLayers(root.cover)), 'cover', out);
    if (Array.isArray(root.menu)) menuNotes(root.menu, 'menu', out);
  }

  const entries = kind === 'page' ? asArray(root.modules ?? root.parts) : [root];
  const listName = kind === 'page' ? (has(root, 'modules') ? 'modules' : 'parts') : '';
  entries.forEach((raw, i) => {
    const entry = asRecord(raw);
    const at = listName === '' ? '' : `${listName}[${i}]`;
    const name = (key: string) => (at === '' ? key : `${at}.${key}`);
    const kindSaid = asText(entry.kind).trim();
    const def = partOf(kindSaid);
    for (const key of Object.keys(entry)) if (!ENTRY_KEYS.has(key)) out.push({ path: name(key), kind: 'unknown', detail: `nieznany klucz modułu — dozwolone: ${[...ENTRY_KEYS].join(', ')}` });

    if (def !== undefined && has(entry, 'config')) {
      const config = entry.config;
      if (!isPlain(config)) {
        if (!blank(config)) out.push({ path: name('config'), kind: 'dropped', detail: '"config" to nie obiekt — moduł zostaje pusty' });
      } else {
        for (const own of def.json.own) {
          if (has(config, own)) out.push({ path: name(`config.${own}`), kind: 'dropped', detail: `„${own}” prowadzi sam moduł — import go nie ustawia${own === 'needs' ? ' (wymagania formularza: "needs" obok "questions")' : ''}` });
        }
        const mine = Object.fromEntries(Object.entries(config).filter(([key]) => !def.json.own.includes(key)));
        compare(mine, def.json.toJson(def.json.fromJson(mine)), name('config'), out);
        undocumented(kindSaid, mine, name('config'), out);
      }
    }
    if (has(entry, 'slide') && entry.slide !== null) compare(entry.slide, slideJson(readSlideValue(entry.slide)), name('slide'), out);
    if (has(entry, 'show') && entry.show !== null) compare(entry.show, pieceJson(readPieceValue(entry.show)), name('show'), out);
    if (has(entry, 'layout')) frameNotes(entry, name, out);
    if (has(entry, 'size')) {
      const size = asRecord(entry.size);
      if (typeof size.colSpan === 'number' && snapColSpan(size.colSpan, 6) !== size.colSpan) out.push({ path: name('size.colSpan'), kind: 'changed', detail: `${size.colSpan} → ${snapColSpan(size.colSpan, 6)} (szerokości 2, 3, 4, 6)` });
      if (typeof size.rowSpan === 'number' && snapRowSpan(size.rowSpan) !== size.rowSpan) out.push({ path: name('size.rowSpan'), kind: 'changed', detail: `${size.rowSpan} → ${snapRowSpan(size.rowSpan)} (wysokości 1, 3, 5)` });
    }
  });

  /* Doppelt Genanntes einmal: ein Pfad, eine Zeile — und was unbekannt ist, ist nicht noch einmal „pominięty". */
  const unknown = new Set(out.filter((one) => one.kind === 'unknown').map((one) => one.path));
  const seen = new Set<string>();
  return out.filter((one) => {
    const key = `${one.path}|${one.kind}`;
    if (seen.has(key) || (one.kind === 'dropped' && unknown.has(one.path))) return false;
    seen.add(key);
    return true;
  });
}
