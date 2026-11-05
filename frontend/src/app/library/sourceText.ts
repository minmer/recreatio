/**
 * 2026-10-24 — TEKST ŹRÓDŁA: DER VOLLTEXT EINES WERKS IN DER BIBLIOTHEK.
 *
 * Ein Werk ist ohne Text vollständig benutzbar (zitieren, Zitate sammeln, Stellen nennen).
 * Kommt der Text später, hängt er an GENAU diesem Werk-Eintrag — dieser Ausgabe, dieser
 * Übersetzung; zwei Ausgaben werden nie vermischt — und jede Stelle, die schon zitiert
 * wurde, findet ihren Absatz, ohne dass jemand etwas neu anlegt: verknüpft wird beim
 * Lesen (`placeLink`), nicht gespeichert.
 *
 * <b>Gespeichert</b> wie alles in der Bibliothek, versiegelt unter dem Schlüssel ihres
 * Bereichs — in IRGENDEINER Bibliothek, die man beschreiben darf: der Werk-Eintrag kann in
 * einer öffentlichen liegen, der Text in einer privaten. Wer den Bereich des Textes nicht
 * liest, sieht ihn nicht — nicht im Zitat, nicht in der Suche, nicht auf einer Seite.
 * <code>
 *   sourcetext   das Verzeichnis eines Textes: welches Werk, welche Regel der Stellen, die Teile
 *                mit ihren Grenzen (erste/letzte Stelle, Seiten) — klein, wird mit abgeglichen
 *   sourcepart   ein Teil (ein Buch der Bibel, ein Kapitel) mit seinen Blöcken — gross; der
 *                Abgleich bringt nur seine Zeile, der Leser holt ihn bei Bedarf
 * </code>
 *
 * <b>Das JSON</b> (`recreatio/source-text`, Version 1) ist für Menschen und KI zum Schreiben
 * gemacht: ein Teil je Dokument, Blöcke in der Reihenfolge des Originals, jede Stelle in der
 * Schreibweise des Werks (`locations.ts`), Seitenwechsel auch mitten im Absatz, Fussnoten,
 * Unsicheres markiert. Ein Teil mit demselben `portion.key` ersetzt sich selbst; andere
 * bleiben. Erfunden wird nichts — was fehlt, bleibt leer.
 */

import { macroWords, mathAt, readMacros, repairTexText, TEX_FIX_SAYS, texPlain, texSource, texTags, type TexFix, type TexMacros } from '../core/tex';
import { contains, formatPlace, overlap, pagesOverlap, parsePlace, placeSortKey, rememberSeries, SCHEMES, schemeOf, seriesKeyOf, TEXT_SCHEMES, workScheme, type PageSpan, type Place, type PlaceOptions, type SchemeId, type Span } from './locations';
import { ids, type EntryData, type LibEntry, type Lookup } from './libraryKinds';
import { t } from '../core/i18n';
import { keyText, kindOfWord, labelKey, labelMatches, looksLikeLabel, NOT_A_TARGET, readKeyText, STATEMENT_KINDS, statementKind, type LabelKey } from './textLabels';

export const SOURCE_FORMAT = 'recreatio/source-text';
export const SOURCE_VERSION = 1;
export const TEXT_KIND = 'sourcetext';
export const PART_KIND = 'sourcepart';
/** Arten, deren Hülle der Abgleich nicht mitbringt (`Library.HeavyKinds` im Dienst). */
export const HEAVY_KINDS: ReadonlySet<string> = new Set([PART_KIND]);
/** Arten der Bibliothek, die keine Quellen-Einträge sind und doch hierher gehören (nicht „Stare wpisy"). */
export const TEXT_KINDS: ReadonlySet<string> = new Set([TEXT_KIND, PART_KIND]);

/** Wie gross ein Teil höchstens sein darf (die Blöcke als JSON in UTF-8) — eine Hülle fasst 4 MB, mit Rand für ihre Hülle. */
export const MAX_PART_BYTES = 3_500_000;

/*
 * 2026-11-01 — WZORY UND AUSSAGEN (Lehrbücher der Mathematik und der Naturwissenschaften): jeder Text kann
 * Wzory tragen (`$…$`, `$$…$$`, LaTeX — `core/tex.ts`), dazu drei Blöcke:
 *   statement   Definicja, Twierdzenie, Lemat, Dowód … mit Label („Twierdzenie 2.3"), Namen und Inhalt —
 *               im JSON verschachtelt (`blocks`), gespeichert flach: der Kopf mit `id`, sein Inhalt mit `in`
 *   figure      ein Rysunek: Label, Podpis, was er zeigt (`alt`)
 *   code        Kod oder Pseudokod, Zeichen für Zeichen
 * und einen Verweis im Text: `{{ref twierdzenia 2.3}}`, `{{ref (2.4)}}` (`textLabels.ts`).
 */
export type BlockType = 'heading' | 'paragraph' | 'quote' | 'list' | 'table' | 'note' | 'page' | 'statement' | 'figure' | 'code';
export const BLOCK_TYPES: readonly BlockType[] = ['heading', 'paragraph', 'quote', 'list', 'table', 'note', 'page', 'statement', 'figure', 'code'];

export interface SourceBlock {
  /** Bei `statement`: was für eine Aussage (`textLabels.ts`: theorem, definition, proof …). */
  readonly kind?: string;
  /** Bei `statement`, `figure`, `table`: die Bezeichnung, wie gedruckt („Twierdzenie 2.3", „Rys. 4.1", „Tabela 2"). */
  readonly label?: string;
  /** Bei `statement`: ihr Name („Bolzano–Weierstrassa"). */
  readonly title?: string;
  /** Bei `figure`: was das Bild zeigt — vom Abschreibenden, nicht aus dem Buch. */
  readonly alt?: string;
  /** Bei `code`: die Sprache. */
  readonly lang?: string;
  /** In welcher Aussage der Block steht (deren `id`). */
  readonly in?: string;
  readonly type: BlockType;
  /** Die Stelle in der Struktur des Werks, in seiner Schreibweise („J 21,15", „nr 24", „2.0121"). */
  readonly loc?: string;
  readonly text?: string;
  readonly level?: number;
  readonly ordered?: boolean;
  readonly items?: readonly string[];
  readonly columns?: readonly string[];
  readonly rows?: readonly (readonly string[])[];
  /** Bei `note`: ihre Kennung, auf die `{{note …}}` zeigt; bei `statement`: seine, auf die `in` zeigt. */
  readonly id?: string;
  /** Bei `page`: die gedruckte Seite, die hier beginnt, und die Seite der PDF-Datei. */
  readonly page?: string;
  readonly pdf?: number;
  /** Die Lesung ist unsicher (schlecht lesbar, unvollständig). */
  readonly uncertain?: boolean;
}

export interface Edition {
  /** Gedruckte Seite = PDF-Seite − dieser Abstand (wo er überall gilt). */
  readonly pdfPageOffset?: number;
  readonly language?: string;
  /** Zählung der Psalmen in diesem Text (nur Pismo Święte). */
  readonly psalms?: 'hebrew' | 'greek';
  readonly note?: string;
  /** 2026-11-01 — die Makra des Buches für seine Wzory (`\R` → `\mathbb{R}`). */
  readonly macros?: TexMacros;
}

/** Ein Teil im Verzeichnis: wo er beginnt und endet. */
export interface ManifestPart {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly order: number;
  readonly first?: string;
  readonly last?: string;
  readonly pages?: readonly [number, number];
  /** 2026-10-27 — die Serien seiner Seiten außer den gewöhnlichen und der römischen Titelei („#*", „A#") — so werden sie wieder geschrieben, wie sie gedruckt sind. */
  readonly series?: readonly string[];
  readonly blocks: number;
  readonly words: number;
  /** 2026-11-01 — wie viele Wzory (der Czytnik lädt KaTeX gleich mit) und die Labels darin („theorem 2.3", „eq 2.4"). */
  readonly formulas?: number;
  readonly labels?: readonly string[];
}

export interface TextManifest {
  readonly work: string;
  readonly scheme: SchemeId;
  readonly edition: Edition;
  readonly parts: readonly ManifestPart[];
}

export interface PartData {
  readonly text: string;
  readonly work: string;
  readonly key: string;
  readonly label: string;
  readonly order: number;
  readonly blocks: readonly SourceBlock[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const s = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
/** `{ macros }`, wenn es welche gibt — sonst nichts (ein Text ohne Wzory bleibt, wie er war). */
const macrosOf = (raw: unknown): { macros?: TexMacros } => {
  const { macros } = readMacros(raw);
  return Object.keys(macros).length === 0 ? {} : { macros };
};

/* -- Lesen des gespeicherten -------------------------------------------------------------------- */

export function readManifest(data: EntryData): TextManifest {
  const edition = isObject(data.edition) ? data.edition : {};
  const seriesOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x !== '' && x.length <= 24).slice(0, 40) : []);
  const manifest: TextManifest = {
    work: s(data.work),
    scheme: (SCHEMES.some((x) => x.id === data.scheme) ? data.scheme : 'pages') as SchemeId,
    edition: {
      ...(typeof edition.pdfPageOffset === 'number' ? { pdfPageOffset: edition.pdfPageOffset } : {}),
      ...(s(edition.language) === '' ? {} : { language: s(edition.language) }),
      ...(edition.psalms === 'greek' || edition.psalms === 'hebrew' ? { psalms: edition.psalms } : {}),
      ...(s(edition.note) === '' ? {} : { note: s(edition.note) }),
      ...macrosOf(edition.macros)
    },
    parts: (Array.isArray(data.parts) ? data.parts : []).filter(isObject).map((p) => ({
      id: s(p.id), key: s(p.key), label: s(p.label) || s(p.key), order: typeof p.order === 'number' ? p.order : 0,
      ...(s(p.first) === '' ? {} : { first: s(p.first) }), ...(s(p.last) === '' ? {} : { last: s(p.last) }),
      ...(Array.isArray(p.pages) && p.pages.length === 2 && p.pages.every((x) => typeof x === 'number') ? { pages: [p.pages[0] as number, p.pages[1] as number] as const } : {}),
      ...(seriesOf(p.series).length === 0 ? {} : { series: seriesOf(p.series) }),
      blocks: typeof p.blocks === 'number' ? p.blocks : 0, words: typeof p.words === 'number' ? p.words : 0,
      ...(typeof p.formulas === 'number' && p.formulas > 0 ? { formulas: p.formulas } : {}),
      ...(Array.isArray(p.labels) && p.labels.length > 0 ? { labels: p.labels.filter((x): x is string => typeof x === 'string').slice(0, 5000) } : {})
    })).filter((p) => p.id !== '').sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pl'))
  };
  /* Die Serien der Seiten bekannt — dann schreibt das Verzeichnis „s. 12*–20*", auch bevor ein Teil geladen ist. */
  rememberSeries(manifest.parts.flatMap((p) => p.series ?? []));
  return manifest;
}

export const readPart = (data: EntryData): PartData => ({
  text: s(data.text), work: s(data.work), key: s(data.key), label: s(data.label) || s(data.key),
  order: typeof data.order === 'number' ? data.order : 0,
  blocks: (Array.isArray(data.blocks) ? data.blocks : []).filter(isObject) as unknown as SourceBlock[]
});

/* -- Im Text: Seiten, Fussnoten, Unsicheres ------------------------------------------------------ */

export type Piece =
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'page'; readonly page: string; readonly pdf?: number }
  | { readonly t: 'note'; readonly id: string }
  | { readonly t: 'unsure'; readonly v: string }
  | { readonly t: 'gap' }
  /** 2026-11-01 — ein Wzór (LaTeX) im Satz oder für sich. */
  | { readonly t: 'math'; readonly tex: string; readonly display: boolean }
  /** 2026-11-01 — ein Verweis auf ein Twierdzenie, einen Wzór, einen Rysunek desselben Textes, so geschrieben wie im Buch. */
  | { readonly t: 'ref'; readonly label: string };

const MARK = /\{\{\s*(page\b|note\b|gap\b|ref\b|\?)([^}]*)\}\}/y;

/**
 * Ein Text mit seinen Zeichen: `{{page 46}}`, `{{page 46 pdf 52}}`, `{{note 3}}`, `{{? wyraz}}`, `{{gap}}`,
 * `{{ref twierdzenia 2.3}}` — und seinen Wzory (`$…$`, `$$…$$`; in ihnen gilt kein Zeichen). `\$` ist ein Dollar.
 */
export function pieces(text: string): Piece[] {
  if (!text.includes('{{') && !text.includes('$')) return text === '' ? [] : [{ t: 'text', v: text }];
  const out: Piece[] = [];
  let buffer = '';
  const flush = () => { if (buffer !== '') { out.push({ t: 'text', v: buffer }); buffer = ''; } };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === '\\' && text[i + 1] === '$') { buffer += '$'; i += 1; continue; }
    if (c === '$') {
      const m = mathAt(text, i);
      if (m !== null) { flush(); out.push({ t: 'math', tex: m.tex, display: m.display }); i = m.end - 1; continue; }
    }
    if (c === '{' && text[i + 1] === '{') {
      MARK.lastIndex = i;
      const m = MARK.exec(text);
      if (m !== null) {
        const arg = (m[2] ?? '').trim();
        if (m[1] === 'page') {
          const pm = /^(\S+)(?:\s+pdf\s+(\d+))?$/i.exec(arg);
          flush();
          if (pm !== null) out.push({ t: 'page', page: pm[1]!, ...(pm[2] === undefined ? {} : { pdf: Number(pm[2]) }) });
        } else if (m[1] === 'note') { flush(); out.push({ t: 'note', id: arg }); }
        else if (m[1] === '?') { flush(); out.push({ t: 'unsure', v: arg }); }
        else if (m[1] === 'ref') { flush(); if (arg !== '') out.push({ t: 'ref', label: arg }); }
        else { flush(); out.push({ t: 'gap' }); }
        i += m[0].length - 1;
        continue;
      }
    }
    buffer += c;
  }
  flush();
  return out;
}

/** Was man liest — ohne Zeichen (für Suche, Zählung, Zitat aus der Auswahl); ein Wzór als Zeile Text (`texPlain`). */
export const plainOfText = (text: string): string =>
  pieces(text).map((p) => (p.t === 'text' ? p.v : p.t === 'unsure' ? p.v : p.t === 'gap' ? '…' : p.t === 'ref' ? p.label : p.t === 'math' ? ` ${texPlain(p.tex)} ` : '')).join('').replace(/\s+/g, ' ').trim();

/** Die Wzory eines Textes als LaTeX (für die Suche nach einem Befehl, `\frac`). */
const texOfText = (text: string): string =>
  text.includes('$') ? pieces(text).flatMap((p) => (p.t === 'math' ? [p.tex] : [])).join(' ') : '';

/** Alles, was ein Block an Text trägt — auch Kopf und Podpis einer Aussage, eines Rysunek, einer Tabela. */
const blockTexts = (b: SourceBlock): string[] => (b.type === 'code' ? [codeAsText(b.text ?? '')] : [
  ...(b.type === 'statement' ? [statementHead(b)] : b.label !== undefined ? [b.label] : []),
  b.text ?? '', ...(b.alt === undefined ? [] : [b.alt]), ...(b.items ?? []), ...(b.columns ?? []), ...(b.rows ?? []).flat()
]);

/** Die Wzory eines Blocks als Zeile Text (α, ∫, ℝ) — für Suchen ausserhalb (die Abschrift für den Dostęp dla AI). Leer: keine Wzory. */
export const texSearchText = (b: SourceBlock): string =>
  blockTexts(b).filter((t) => t.includes('$')).map((t) => pieces(t).flatMap((p) => (p.t === 'math' ? [texPlain(p.tex)] : [])).join(' ')).join(' ').trim();

/** Der Kopf einer Aussage, wie er dasteht: „Twierdzenie 2.3 (Bolzano–Weierstrassa)". */
export const statementHead = (b: SourceBlock): string => {
  const label = b.label ?? statementKind(b.kind).label;
  return `${label}${b.title === undefined || b.title === '' ? '' : ` (${b.title})`}`;
};

/* -- Aussagen: der Kopf und was in ihm steht ---------------------------------------------------- */

/**
 * JE BLOCK DIE AUSSAGEN, IN DENEN ER STEHT — von aussen nach innen (ihre `id`). Der Kopf einer
 * Aussage steht in ihr selbst. Ein `in`, das auf nichts davor zeigt, zählt nicht.
 */
export function boxesOf(blocks: readonly SourceBlock[]): string[][] {
  const chains = new Map<string, string[]>();
  return blocks.map((b) => {
    const outer = b.in === undefined ? [] : chains.get(b.in) ?? [];
    if (b.type === 'statement' && b.id !== undefined && b.id !== '') {
      const own = [...outer, b.id];
      chains.set(b.id, own);
      return own;
    }
    return outer;
  });
}

/** Die Blöcke einer Aussage: ihr Kopf und alles, was in ihr steht (auch tiefer). */
export function boxBlocks(blocks: readonly SourceBlock[], head: number): number[] {
  const id = blocks[head]?.id;
  if (id === undefined || blocks[head]!.type !== 'statement') return [head];
  const chains = boxesOf(blocks);
  return chains.map((chain, i) => (chain.includes(id) ? i : -1)).filter((i) => i >= 0);
}

/* -- Labels: Twierdzenia, Wzory, Rysunki, Tabele ------------------------------------------------- */

/** Was an einem Block nummeriert ist, wie es dasteht — mit seinem Schlüssel (`textLabels.ts`). */
export function blockLabels(b: SourceBlock): { label: string; key: LabelKey }[] {
  const out: { label: string; key: LabelKey }[] = [];
  if (b.type === 'statement' && b.label !== undefined && !NOT_A_TARGET.has(b.kind ?? '')) {
    const key = labelKey(b.label, b.kind ?? null);
    if (key !== null) out.push({ label: b.label, key });
  }
  if ((b.type === 'figure' || b.type === 'table') && b.label !== undefined) {
    const key = labelKey(b.label, b.type);
    if (key !== null) out.push({ label: b.label, key });
  }
  for (const text of [b.text ?? '', ...(b.items ?? []), ...(b.rows ?? []).flat()]) {
    if (!text.includes('\\tag')) continue;
    for (const p of pieces(text)) {
      if (p.t !== 'math' || !p.display) continue;
      for (const tag of texTags(p.tex)) { const key = labelKey(tag, 'eq'); if (key !== null) out.push({ label: tag, key }); }
    }
  }
  return out;
}

/** Die Schlüssel der Labels eines Teils, in der Reihenfolge des Textes (fürs Verzeichnis). */
export const partLabels = (blocks: readonly SourceBlock[]): string[] =>
  [...new Set(blocks.flatMap((b) => blockLabels(b).map((l) => keyText(l.key))))];

/**
 * WO STEHT „Twierdzenie 2.3", „(2.4)", „Rys. 1"? Die Blöcke, die das Label tragen — bei einer Aussage
 * sie ganz (Kopf und Inhalt). Leer: nichts davon in diesem Teil.
 */
export function labelBlocks(blocks: readonly SourceBlock[], wanted: string): number[] {
  const ref = labelKey(wanted);
  if (ref === null) return [];
  for (let i = 0; i < blocks.length; i += 1) {
    if (blockLabels(blocks[i]!).some((l) => labelMatches(ref, l.key))) return blocks[i]!.type === 'statement' ? boxBlocks(blocks, i) : [i];
  }
  return [];
}

/** Welcher Teil trägt das Label (aus dem Verzeichnis, ohne einen Teil zu laden)? */
export function labelPart(manifest: TextManifest, wanted: string): ManifestPart | undefined {
  const ref = labelKey(wanted);
  if (ref === null) return undefined;
  return manifest.parts.find((p) => (p.labels ?? []).some((k) => { const key = readKeyText(k); return key !== null && labelMatches(ref, key); }));
}

const pageValue = (page: string): number | null => {
  const p = parsePlace(`s. ${page}`, 'pages').pages[0];
  return p === undefined ? null : p.from;
};

/** Je Block: die Seiten, auf denen er steht (die gedruckte Seite vor ihm, und was in ihm beginnt). */
export function blockPages(blocks: readonly SourceBlock[]): ({ from: number; to: number } | null)[] {
  let current: number | null = null;
  return blocks.map((b) => {
    if (b.type === 'page') {
      current = pageValue(b.page ?? '');
      return current === null ? null : { from: current, to: current };
    }
    const start = current;
    for (const text of blockTexts(b)) for (const p of pieces(text)) if (p.t === 'page') { const v = pageValue(p.page); if (v !== null) current = v; }
    if (start === null && current === null) return null;
    return { from: start ?? current!, to: current ?? start! };
  });
}

/* -- Stellen eines Teils ------------------------------------------------------------------------ */

export interface Located {
  readonly index: number;
  readonly spans: readonly Span[];
}

export const placeOptions = (edition: Edition): PlaceOptions => (edition.psalms === undefined ? {} : { psalms: edition.psalms });

/** Die Blöcke mit lesbarer Stelle; ein Block ohne eigene erbt keine (Überschriften, Absätze dazwischen). */
export function locate(blocks: readonly SourceBlock[], scheme: SchemeId, edition: Edition = {}): Located[] {
  const out: Located[] = [];
  blocks.forEach((b, index) => {
    if (b.loc === undefined || b.loc.trim() === '') return;
    const place = parsePlace(b.loc, scheme, placeOptions(edition));
    if (place.spans.length > 0) out.push({ index, spans: place.spans });
  });
  return out;
}

/**
 * WELCHE BLÖCKE MEINT EINE STELLE? Die Struktur zuerst (ein Vers, eine Nummer, eine
 * Proposition — in jeder Ausgabe dieselbe); nur Seiten, wenn die Stelle nichts anderes
 * sagt (sie gelten nur in dieser Ausgabe). Ein Block ohne eigene Stelle gehört zu der
 * Stelle davor (der Absatz nach „Rozdział 3" liegt in Kapitel 3).
 */
export function findBlocks(blocks: readonly SourceBlock[], place: Place, scheme: SchemeId, edition: Edition = {}): number[] {
  const out = new Set<number>();
  if (place.spans.length > 0) {
    const owned: { index: number; spans: readonly Span[] }[] = [];
    let current: readonly Span[] = [];
    blocks.forEach((b, i) => {
      if (b.type === 'note' || b.type === 'page') return;
      if (b.loc !== undefined && b.loc.trim() !== '') current = parsePlace(b.loc, scheme, placeOptions(edition)).spans;
      if (current.length > 0) owned.push({ index: i, spans: current });
    });
    /*
     * Je gesuchtem Stück: die Blöcke darin (oder halb darin). Nur wo es keine gibt, die
     * Blöcke, die es umfassen — und von ihnen die engsten (der Absatz „J 21,15-17" für
     * Vers 16, nicht die Überschrift des Kapitels davor).
     */
    for (const want of place.spans) {
      const within = owned.filter((o) => o.spans.some((own) => overlap(own, want) && !(contains(own, want) && !contains(want, own))));
      if (within.length > 0) { within.forEach((o) => out.add(o.index)); continue; }
      const around = owned.filter((o) => o.spans.some((own) => contains(own, want)));
      const tight = (o: { spans: readonly Span[] }) => o.spans.find((own) => contains(own, want))!;
      around.filter((o) => !around.some((other) => other !== o && contains(tight(o), tight(other)) && !contains(tight(other), tight(o)))).forEach((o) => out.add(o.index));
    }
  }
  if (out.size === 0 && place.spans.length === 0 && place.pages.length > 0) {
    const pages = blockPages(blocks);
    pages.forEach((range, i) => {
      if (range === null || blocks[i]!.type === 'page' || blocks[i]!.type === 'note') return;
      if (place.pages.some((p) => pagesOverlap(p, range))) out.add(i);
    });
  }
  return [...out].sort((a, b) => a - b);
}

/** 2026-10-27 — die Serien der gedruckten Seiten eines Teils, ausser den gewöhnlichen und der römischen Titelei. */
export function pageSeriesIn(blocks: readonly SourceBlock[]): string[] {
  const out = new Set<string>();
  const take = (label: string | undefined) => {
    const key = label === undefined ? null : seriesKeyOf(label);
    if (key !== null && key !== '#' && key !== 'i') out.add(key);
  };
  for (const b of blocks) {
    if (b.type === 'page') take(b.page);
    for (const text of blockTexts(b)) for (const p of pieces(text)) if (p.t === 'page') take(p.page);
  }
  return [...out];
}

/** Wie viele Wzory ein Teil trägt. */
export const formulaCount = (blocks: readonly SourceBlock[]): number =>
  blocks.reduce((n, b) => n + blockTexts(b).reduce((m, t) => m + (t.includes('$') ? pieces(t).filter((p) => p.t === 'math').length : 0), 0), 0);

/** Erste und letzte Stelle, Seiten, Blöcke, Wörter, Wzory und Labels eines Teils — für das Verzeichnis. */
export function partSummary(blocks: readonly SourceBlock[]): { first?: string; last?: string; pages?: readonly [number, number]; series?: readonly string[]; blocks: number; words: number; formulas?: number; labels?: readonly string[] } {
  const locs = blocks.map((b) => b.loc?.trim() ?? '').filter((l) => l !== '');
  const pages = blockPages(blocks).filter((p): p is { from: number; to: number } => p !== null);
  const series = pageSeriesIn(blocks);
  const words = blocks.reduce((n, b) => n + blockTexts(b).reduce((m, t) => m + (plainOfText(t).match(/\S+/g)?.length ?? 0), 0), 0);
  const formulas = formulaCount(blocks);
  const labels = partLabels(blocks);
  return {
    ...(locs.length === 0 ? {} : { first: locs[0], last: locs[locs.length - 1] }),
    ...(pages.length === 0 ? {} : { pages: [Math.min(...pages.map((p) => p.from)), Math.max(...pages.map((p) => p.to))] as const }),
    ...(series.length === 0 ? {} : { series }),
    blocks: blocks.length,
    words,
    ...(formulas === 0 ? {} : { formulas }),
    ...(labels.length === 0 ? {} : { labels })
  };
}

/* -- Von der Fussnote zum Absatz ------------------------------------------------------------------- */

export type PlaceStatus = 'found' | 'ambiguous' | 'none';

export interface TextPlace {
  readonly status: PlaceStatus;
  /** Welcher Teil (bei `found`). */
  readonly part?: ManifestPart;
  /** Warum nicht — für den Titel des Hinweises. */
  readonly why: string;
}

/**
 * WO STEHT DIE STELLE IM TEXT? Nur aus dem Verzeichnis, ohne einen Teil zu laden: ein Teil,
 * dessen Grenzen (Stellen oder Seiten) die Stelle umfassen. Mehrere Kandidaten — zweideutig;
 * eine Stelle, die der Text nicht tragen kann (Seiten, aber der Text hat keine) — nichts.
 */
export function placeInManifest(manifest: TextManifest, locator: string): TextPlace {
  /* 2026-11-01 — ein Label („Twierdzenie 2.3", „(2.4)", „Rys. 1") zuerst, wenn es wie eines aussieht; sonst nach den Stellen. */
  const labelled = looksLikeLabel(locator) ? labelPart(manifest, locator) : undefined;
  if (labelled !== undefined) return { status: 'found', part: labelled, why: '' };
  const place = parsePlace(locator, manifest.scheme, placeOptions(manifest.edition));
  if (place.spans.length === 0 && place.pages.length === 0) {
    const part = labelPart(manifest, locator);
    return part !== undefined ? { status: 'found', part, why: '' } : { status: 'none', why: t('librarySource.place.unreadable') };
  }
  const parts = manifest.parts;
  if (place.spans.length > 0) {
    const hits = parts.filter((p) => {
      if (p.first === undefined) return false;
      const a = parsePlace(p.first, manifest.scheme, placeOptions(manifest.edition)).spans[0];
      const b = parsePlace(p.last ?? p.first, manifest.scheme, placeOptions(manifest.edition)).spans.slice(-1)[0];
      if (a === undefined || b === undefined) return false;
      return place.spans.some((want) => overlap({ from: a.from, to: b.to }, want));
    });
    if (hits.length === 1) return { status: 'found', part: hits[0], why: '' };
    if (hits.length > 1) return { status: 'found', part: hits[0], why: t('librarySource.place.spansParts', { count: hits.length }) };
    if (place.pages.length === 0) return { status: 'none', why: t('librarySource.place.notInParts') };
  }
  const withPages = parts.filter((p) => p.pages !== undefined);
  if (withPages.length === 0) return { status: 'none', why: t('librarySource.place.noPages') };
  const hits = withPages.filter((p) => place.pages.some((want) => pagesOverlap(want, { from: p.pages![0], to: p.pages![1] })));
  if (hits.length === 1) return { status: 'found', part: hits[0], why: '' };
  if (hits.length > 1) return { status: 'ambiguous', why: t('librarySource.place.pageAmbiguous') };
  return { status: 'none', why: t('librarySource.place.pageNotInParts') };
}

/* -- JSON hinein ---------------------------------------------------------------------------------- */

export interface ImportContext {
  /** Das Werk, an das der Text kommt (der Eintrag dieser Ausgabe). */
  readonly work: LibEntry;
  /** Was es schon gibt — ein Teil mit demselben Schlüssel wird ersetzt. */
  readonly manifest?: TextManifest;
  /** 2026-11-01 — der Prüfer der Wzory (KaTeX, `ui/tex/`); ohne ihn werden sie nicht gesetzt, nur gelesen. */
  readonly tex?: TexCheck;
}

/** Lässt sich der Wzór setzen? Die Meldung, wenn nicht. */
export type TexCheck = (tex: string, display: boolean, macros: TexMacros) => string | null;

export interface SourcePlan {
  readonly portion: { readonly key: string; readonly label: string; readonly order: number };
  readonly scheme: SchemeId;
  /** Die Regel des Werks soll so gesetzt werden (es hatte noch keine ausdrückliche). */
  readonly setScheme?: SchemeId;
  readonly edition: Edition;
  readonly blocks: readonly SourceBlock[];
  readonly replaces: boolean;
  readonly summary: ReturnType<typeof partSummary> & {
    readonly notes: number;
    readonly located: number;
    /** 2026-11-01 — Aussagen (Twierdzenia, Dowody …), ob die Wzory gesetzt wurden, wie viele nicht gingen. */
    readonly statements: number;
    readonly checked: boolean;
    readonly texErrors: number;
  };
  readonly warnings: readonly string[];
}

const KEY = /^[\p{L}\p{N} _.:()\-]{1,60}$/u;
/** Wie tief Aussagen ineinander stehen dürfen (ein Lemat im Beweis im Twierdzenie …). */
const MAX_DEPTH = 4;
/** Wie viele Hinweise einer Sorte genannt werden — der Rest als Zahl. */
const SHOWN_WARNINGS = 25;

/** Ein Dollarzeichen, das keinen Wzór beginnt und nicht als `\$` geschrieben ist? */
function strayDollar(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\' && text[i + 1] === '$') { i += 1; continue; }
    if (text[i] !== '$') continue;
    const m = mathAt(text, i);
    if (m === null) return true;
    i = m.end - 1;
  }
  return false;
}

/** Kod bleibt Zeichen für Zeichen — nur ein Seitenwechsel darf in ihm stehen. Für die Zeichen der Texte entwertet. */
export const codeAsText = (text: string): string => text.replace(/\$/g, '\\$').replace(/\{\{(?!\s*page\b)/g, '{​{');

const short = (tex: string): string => { const t = tex.replace(/\s+/g, ' ').trim(); return t.length > 60 ? `${t.slice(0, 59)}…` : t; };

/** Einen Teil prüfen und ordnen — `{ error }`, wenn nichts davon gespeichert werden kann. */
export function planSourceImport(raw: unknown, ctx: ImportContext): SourcePlan | { error: string } {
  if (!isObject(raw)) return { error: t('librarySource.import.oneObject') };
  if (raw.format !== SOURCE_FORMAT) return { error: t('librarySource.import.notSourceText', { format: SOURCE_FORMAT }) };
  if (raw.version !== SOURCE_VERSION) return { error: t('librarySource.import.unknownVersion', { version: s(raw.version), known: SOURCE_VERSION }) };

  const warnings: string[] = [];
  const workRef = s(raw.work).replace(/^@/, '');
  if (workRef !== '' && workRef !== ctx.work.id && workRef.toLowerCase() !== (ctx.work.key ?? '').toLowerCase())
    return { error: t('librarySource.import.otherWork', { work: workRef }) };

  const own = workScheme(ctx.work.data);
  const explicit = typeof ctx.work.data.scheme === 'string' && ctx.work.data.scheme !== '';
  let scheme: SchemeId = ctx.manifest?.scheme ?? own;
  let setScheme: SchemeId | undefined;
  if (s(raw.scheme) !== '') {
    const asked = s(raw.scheme) as SchemeId;
    if (!SCHEMES.some((x) => x.id === asked)) return { error: t('librarySource.import.unknownScheme', { scheme: asked, list: SCHEMES.map((x) => x.id).join(', ') }) };
    if (asked !== scheme) {
      if (ctx.manifest !== undefined || explicit) return { error: t('librarySource.import.schemeDiffers', { label: schemeOf(scheme).label, scheme, asked }) };
      scheme = asked;
      setScheme = asked;
    }
  }

  const ed = isObject(raw.edition) ? raw.edition : {};
  const { macros: ownMacros, warnings: macroWarnings } = readMacros(ed.macros);
  warnings.push(...macroWarnings);
  /* Die Makra des Textes wachsen mit jedem Teil: was ein neuer Teil nennt, kommt dazu oder ersetzt. */
  const macros: Record<string, string> = { ...(ctx.manifest?.edition.macros ?? {}), ...ownMacros };
  const prior = ctx.manifest?.edition ?? {};
  const edition0: Edition = {
    ...(prior.pdfPageOffset === undefined ? {} : { pdfPageOffset: prior.pdfPageOffset }),
    ...(prior.language === undefined ? {} : { language: prior.language }),
    ...(prior.psalms === undefined ? {} : { psalms: prior.psalms }),
    ...(prior.note === undefined ? {} : { note: prior.note }),
    ...(typeof ed.pdfPageOffset === 'number' && Number.isInteger(ed.pdfPageOffset) ? { pdfPageOffset: ed.pdfPageOffset } : {}),
    ...(s(ed.language) === '' ? {} : { language: s(ed.language).slice(0, 20) }),
    ...(ed.psalms === 'greek' || ed.psalms === 'hebrew' ? { psalms: ed.psalms } : {}),
    ...(s(ed.note) === '' ? {} : { note: s(ed.note).slice(0, 500) })
  };
  if (scheme !== 'bible' && edition0.psalms !== undefined) warnings.push(t('librarySource.import.psalmsOnlyBible'));

  const portion = isObject(raw.portion) ? raw.portion : {};
  const key = s(portion.key).trim();
  if (!KEY.test(key)) return { error: t('librarySource.import.portionKey') };
  const label = s(portion.label).trim().slice(0, 200) || key;
  const order = typeof portion.order === 'number' && Number.isFinite(portion.order) ? portion.order : (ctx.manifest?.parts.find((p) => p.key === key)?.order ?? (ctx.manifest?.parts.length ?? 0) + 1);

  if (!Array.isArray(raw.blocks) || raw.blocks.length === 0) return { error: t('librarySource.import.blocks') };
  const blocks: SourceBlock[] = [];
  const noteIds = new Set<string>();
  const noteRefs = new Set<string>();
  const seenLocs = new Map<string, string>();
  const refs: { label: string; where: string }[] = [];
  const formulas: { tex: string; display: boolean; where: string }[] = [];
  const pageRun: { v: number; where: string }[] = [];
  const fixes: Partial<Record<TexFix, number>> = {};
  const hoisted = new Set<string>();
  const strays: string[] = [];
  let lastPage: number | null = null;
  let lastPdf: number | null = null;
  let boxes = 0;

  /* Was eine KI an Wzory typischerweise verdirbt, wird ausgebessert (`repairTexText`) — und gesagt. Die Makra des Textes zählen als Befehle. */
  const words = macroWords(macros);
  const fix = (text: string): string => {
    const r = repairTexText(text, words);
    for (const [k, n] of Object.entries(r.fixes)) fixes[k as TexFix] = (fixes[k as TexFix] ?? 0) + (n ?? 0);
    for (const [name, body] of Object.entries(r.macros)) { macros[name] = body; hoisted.add(name); }
    return r.text;
  };
  const seePage = (page: string, pdf: number | undefined, where: string, label: string) => {
    const v = pageValue(page);
    if (v === null) { warnings.push(t('librarySource.import.unreadablePage', { where, page, place: t(`librarySource.import.in.${label}`) })); return; }
    if (lastPage !== null && v < lastPage) warnings.push(t('librarySource.import.pageOrder', { where, page }));
    lastPage = v;
    pageRun.push({ v, where });
    if (pdf !== undefined) { if (lastPdf !== null && pdf < lastPdf) warnings.push(t('librarySource.import.pdfOrder', { where, pdf })); lastPdf = pdf; }
  };
  const checkText = (text: string, where: string, label: string) => {
    if (strayDollar(text)) strays.push(where);
    for (const p of pieces(text)) {
      if (p.t === 'note') noteRefs.add(p.id);
      else if (p.t === 'ref') refs.push({ label: p.label, where });
      else if (p.t === 'math') formulas.push({ tex: p.tex, display: p.display, where });
      else if (p.t === 'page') seePage(p.page, p.pdf, where, label);
    }
  };

  let nextBox = 0;
  const take = (one: unknown, where: string, inside: string | undefined, depth: number): void => {
    if (!isObject(one)) { warnings.push(t('librarySource.import.notObject', { where })); return; }
    let type = s(one.type) as BlockType;
    /* Eine Aussage auch unter dem Namen ihrer Art: {"type": "theorem"} wie {"type": "statement", "kind": "theorem"}. */
    let kindOfType: string | undefined;
    if (!BLOCK_TYPES.includes(type) && STATEMENT_KINDS.some((k) => k.id === s(one.type) && k.id !== 'other')) { kindOfType = s(one.type); type = 'statement'; }
    if (!BLOCK_TYPES.includes(type)) { warnings.push(t('librarySource.import.unknownType', { where, type: s(one.type) })); return; }
    const loc = s(one.loc).trim();
    const block: Record<string, unknown> = { type };
    if (loc !== '') {
      const place = parsePlace(loc, scheme, placeOptions(edition0));
      if (place.spans.length === 0 && place.pages.length === 0) warnings.push(t('librarySource.import.locUnreadable', { where, loc, scheme: schemeOf(scheme).label }));
      else if (place.rest !== '') warnings.push(t('librarySource.import.locRest', { where, loc, rest: place.rest }));
      const seen = seenLocs.get(loc);
      if (seen !== undefined && type !== 'heading' && type !== 'statement') warnings.push(t('librarySource.import.locTwice', { where, loc, seen }));
      seenLocs.set(loc, where);
      block.loc = loc;
    }
    if (one.uncertain === true) block.uncertain = true;
    if (inside !== undefined) block.in = inside;
    switch (type) {
      case 'page': {
        const page = s(one.page).trim();
        const v = pageValue(page);
        if (v === null) { warnings.push(t('librarySource.import.pageWithout', { where })); return; }
        seePage(page, typeof one.pdf === 'number' && Number.isInteger(one.pdf) ? one.pdf : undefined, where, 'block');
        block.page = page;
        if (typeof one.pdf === 'number' && Number.isInteger(one.pdf)) block.pdf = one.pdf;
        delete block.loc;
        break;
      }
      case 'list': {
        const items = Array.isArray(one.items) ? one.items.map(s).filter((x) => x.trim() !== '').map(fix) : [];
        if (items.length === 0) { warnings.push(t('librarySource.import.listWithout', { where })); return; }
        items.forEach((x) => checkText(x, where, 'list'));
        block.items = items;
        if (one.ordered === true) block.ordered = true;
        break;
      }
      case 'table': {
        const rows = Array.isArray(one.rows) ? one.rows.filter(Array.isArray).map((r) => (r as unknown[]).map(s).map(fix)) : [];
        if (rows.length === 0) { warnings.push(t('librarySource.import.tableWithout', { where })); return; }
        rows.flat().forEach((x) => checkText(x, where, 'table'));
        block.rows = rows;
        if (Array.isArray(one.columns)) { block.columns = one.columns.map(s).map(fix); (block.columns as string[]).forEach((x) => checkText(x, where, 'table')); }
        if (s(one.label).trim() !== '') block.label = s(one.label).trim().slice(0, 120);
        if (s(one.text).trim() !== '') { block.text = fix(s(one.text).trim()); checkText(block.text as string, where, 'tableCaption'); }
        break;
      }
      case 'note': {
        const id = s(one.id).trim();
        if (id === '') { warnings.push(t('librarySource.import.noteWithoutId', { where })); return; }
        if (noteIds.has(id)) warnings.push(t('librarySource.import.noteTwice', { where, id }));
        noteIds.add(id);
        block.id = id;
        const text = fix(s(one.text).trim());
        if (text === '') { warnings.push(t('librarySource.import.noteEmpty', { where, id })); return; }
        checkText(text, where, 'note');
        block.text = text;
        break;
      }
      case 'statement': {
        const said = (kindOfType ?? s(one.kind)).trim().toLowerCase();
        const head = s(one.label).trim().slice(0, 120);
        const fromLabel = head === '' ? null : kindOfWord(head);
        const kind = STATEMENT_KINDS.some((k) => k.id === said) ? said
          : STATEMENT_KINDS.some((k) => k.id === fromLabel) ? fromLabel! : 'other';
        if (said !== '' && kind !== said) warnings.push(kind === 'other' ? t('librarySource.import.kindUnknownOther', { where, kind: said }) : t('librarySource.import.kindUnknownTaken', { where, kind: said, label: statementKind(kind).label }));
        if (head === '' && kind === 'other') { warnings.push(t('librarySource.import.statementBare', { where })); return; }
        if (depth >= MAX_DEPTH) { warnings.push(t('librarySource.import.tooDeep', { where, count: MAX_DEPTH })); return; }
        nextBox += 1;
        const id = `s${nextBox}`;
        block.kind = kind;
        if (head !== '') block.label = head;
        const title = s(one.title).trim().slice(0, 200);
        if (title !== '') block.title = fix(title);
        block.id = id;
        blocks.push(block as unknown as SourceBlock);
        boxes += 1;
        const text = s(one.text).replace(/\r\n/g, '\n').trim();
        const children = Array.isArray(one.blocks) ? one.blocks : [];
        if (text !== '') take({ type: 'paragraph', text }, where, id, depth + 1);
        children.forEach((child, j) => take(child, `${where}.${j + 1}`, id, depth + 1));
        if (text === '' && children.length === 0) warnings.push(t('librarySource.import.statementEmpty', { where, head: statementHead(block as unknown as SourceBlock) }));
        return;
      }
      case 'figure': {
        const head = s(one.label).trim().slice(0, 120);
        const caption = fix(s(one.text).trim());
        const alt = fix(s(one.alt).trim().slice(0, 4000));
        if (head === '' && caption === '' && alt === '') { warnings.push(t('librarySource.import.figureBare', { where })); return; }
        if (head !== '') block.label = head;
        if (caption !== '') { block.text = caption; checkText(caption, where, 'caption'); }
        if (alt !== '') { block.alt = alt; checkText(alt, where, 'figureAlt'); }
        break;
      }
      case 'code': {
        const text = s(one.text).replace(/\r\n/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
        if (text.trim() === '') { warnings.push(t('librarySource.import.codeEmpty', { where })); return; }
        block.text = text;
        if (s(one.lang).trim() !== '') block.lang = s(one.lang).trim().slice(0, 30);
        for (const p of pieces(codeAsText(text))) if (p.t === 'page') seePage(p.page, p.pdf, where, 'code');
        break;
      }
      default: {
        const text = fix(s(one.text).replace(/\r\n/g, '\n').trim());
        if (text === '') { warnings.push(t('librarySource.import.textEmpty', { where })); return; }
        checkText(text, where, 'text');
        block.text = text;
        if (type === 'heading') block.level = typeof one.level === 'number' ? Math.min(4, Math.max(1, Math.round(one.level))) : 1;
      }
    }
    blocks.push(block as unknown as SourceBlock);
  };
  raw.blocks.forEach((one, i) => take(one, t('librarySource.import.block', { n: i + 1 }), undefined, 0));

  for (const ref of noteRefs) if (!noteIds.has(ref)) warnings.push(t('librarySource.import.refWithoutNote', { ref }));
  for (const id of noteIds) if (!noteRefs.has(id)) warnings.push(t('librarySource.import.noteWithoutRef', { id }));
  if (blocks.length === 0) return { error: t('librarySource.import.nothing') };
  if (new TextEncoder().encode(JSON.stringify(blocks)).length > MAX_PART_BYTES) return { error: t('librarySource.import.tooBig') };

  /* -- 2026-11-01: Wzory, Labels, Verweise, Seiten — was beim Lesen auffiele, schon jetzt -- */
  for (const kind of Object.keys(fixes) as TexFix[]) warnings.push(t('librarySource.import.texFixed', { n: fixes[kind] ?? 0, what: TEX_FIX_SAYS[kind] }));
  if (hoisted.size > 0) warnings.push(t('librarySource.import.macrosHoisted', { list: [...hoisted].join(', ') }));
  if (strays.length > 0) warnings.push(t('librarySource.import.strayDollar', { list: strays.slice(0, 5).join(', ') + (strays.length > 5 ? t('librarySource.import.andOthers', { count: strays.length - 5 }) : '') }));
  let texErrors = 0;
  if (ctx.tex !== undefined) {
    const said: string[] = [];
    for (const f of formulas) {
      const error = ctx.tex(f.tex, f.display, macros);
      if (error === null) continue;
      texErrors += 1;
      if (said.length < SHOWN_WARNINGS) said.push(t('librarySource.import.texError', { where: f.where, tex: texSource(short(f.tex), f.display), error }));
    }
    warnings.push(...said);
    if (texErrors > said.length) warnings.push(t('librarySource.import.texMore', { count: texErrors - said.length }));
  }
  const labelsHere = blocks.flatMap((b, i) => blockLabels(b).map((l) => ({ ...l, i })));
  const twice = new Map<string, number>();
  for (const l of labelsHere) twice.set(keyText(l.key), (twice.get(keyText(l.key)) ?? 0) + 1);
  const doubles = [...twice.entries()].filter(([, n]) => n > 1).map(([k]) => labelsHere.find((l) => keyText(l.key) === k)!.label);
  if (doubles.length > 0) warnings.push(t('librarySource.import.labelTwice', { list: doubles.slice(0, 8).join(', ') + (doubles.length > 8 ? ' …' : '') }));
  const others = (ctx.manifest?.parts ?? []).filter((p) => p.key !== key).flatMap((p) => (p.labels ?? []).map(readKeyText)).filter((k): k is LabelKey => k !== null);
  const missing: string[] = [];
  for (const ref of refs) {
    const want = labelKey(ref.label);
    if (want === null) { missing.push(t('librarySource.import.refNoNumber', { label: ref.label, where: ref.where })); continue; }
    if (!labelsHere.some((l) => labelMatches(want, l.key)) && !others.some((k) => labelMatches(want, k))) missing.push(t('librarySource.import.refAt', { label: ref.label, where: ref.where }));
  }
  if (missing.length > 0) warnings.push(t('librarySource.import.refsMissing', { list: missing.slice(0, 8).join(', ') + (missing.length > 8 ? t('librarySource.import.andOthers', { count: missing.length - 8 }) : '') }));
  /* Fehlende Seiten: eine Lücke zwischen zwei Seiten derselben Zählung (leere Seiten, Bilder — oder Ausgelassenes). */
  const gaps: string[] = [];
  for (let i = 1; i < pageRun.length; i += 1) {
    const a = pageRun[i - 1]!.v;
    const b = pageRun[i]!.v;
    if (b - a >= 2 && b - a <= 40) gaps.push(t('librarySource.import.gapAt', { pages: pageRangeLabel([a + 1, b - 1]), where: pageRun[i]!.where }));
  }
  if (gaps.length > 0) warnings.push(t('librarySource.import.pagesMissing', { list: gaps.slice(0, 6).join('; ') + (gaps.length > 6 ? t('librarySource.import.andOtherGaps', { count: gaps.length - 6 }) : '') }));

  const edition: Edition = { ...edition0, ...(Object.keys(macros).length === 0 ? {} : { macros }) };
  return {
    portion: { key, label, order },
    scheme,
    ...(setScheme === undefined ? {} : { setScheme }),
    edition,
    blocks,
    replaces: ctx.manifest?.parts.some((p) => p.key === key) ?? false,
    summary: { ...partSummary(blocks), notes: noteIds.size, located: locate(blocks, scheme, edition).length, statements: boxes, checked: ctx.tex !== undefined, texErrors },
    warnings
  };
}

/** Ein Dokument oder eine Liste von Dokumenten (Export „wszystko") — als Liste. */
export const documentsOf = (raw: unknown): unknown[] => portionDocs(raw);

/**
 * 2026-10-24 — DER GANZE TEXT IN EINEM DOKUMENT. Ein Dokument trägt eine Part (`portion` +
 * `blocks`) oder viele (`portions: [{ portion, blocks }, …]`); eine Liste von Dokumenten geht
 * auch. Hier wird daraus je Part ein Dokument der einfachen Gestalt — mit `format`, `work`,
 * `scheme` und `edition` des Ganzen. Ein Werk als Objekt (ein neuer Eintrag, `sourceImport.ts`)
 * wird dabei zu seinem Schlüssel.
 */
export function portionDocs(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw.flatMap(portionDocs);
  if (!isObject(raw)) return [raw];
  const work = isObject(raw.work) ? (s(raw.work.key) === '' ? '' : `@${s(raw.work.key).replace(/^@/, '')}`) : raw.work;
  if (!Array.isArray(raw.portions)) return [{ ...raw, work }];
  const { portions, ...whole } = raw;
  return (portions as unknown[]).map((one) => {
    const item = isObject(one) ? one : {};
    const portion = isObject(item.portion) ? item.portion : { key: item.key, label: item.label, order: item.order };
    return { ...whole, work, ...(item.scheme === undefined ? {} : { scheme: item.scheme }), portion, blocks: item.blocks };
  });
}

/* -- JSON hinaus ------------------------------------------------------------------------------------ */

/**
 * 2026-11-01 — DIE AUSSAGEN WIEDER VERSCHACHTELT, wie man sie schreibt: der Kopf mit `blocks`, darin, was
 * `in` ihm stand. Ihre Kennungen fallen weg — der Import vergibt sie in derselben Reihenfolge wieder.
 */
export function nestBlocks(blocks: readonly SourceBlock[]): Record<string, unknown>[] {
  const top: Record<string, unknown>[] = [];
  const open = new Map<string, Record<string, unknown>[]>();
  for (const b of blocks) {
    const { in: inside, ...rest } = b;
    const into = inside === undefined ? top : open.get(inside) ?? top;
    if (b.type === 'statement' && b.id !== undefined) {
      const { id, ...head } = rest;
      const children: Record<string, unknown>[] = [];
      into.push({ ...head, blocks: children });
      open.set(id!, children);
    } else into.push({ ...rest });
  }
  return top;
}

export function exportSourcePart(work: LibEntry, manifest: TextManifest, part: PartData): Record<string, unknown> {
  return {
    format: SOURCE_FORMAT,
    version: SOURCE_VERSION,
    work: work.key !== undefined ? `@${work.key}` : work.id,
    scheme: manifest.scheme,
    ...(Object.keys(manifest.edition).length === 0 ? {} : { edition: manifest.edition }),
    portion: { key: part.key, label: part.label, order: part.order },
    blocks: nestBlocks(part.blocks)
  };
}

/* -- Die Beschreibung für Mensch und KI ---------------------------------------------------------- */

/** Beispiele je Regel — sie werden in der Prüfung importiert (`app-library-check.mjs`), müssen also ohne Warnung durchgehen. */
/* 2026-10-26 — ohne `time`: die Zeit gehört einem Nagranie, und ein Nagranie hat keinen Quellentext. */
export const SOURCE_EXAMPLES: Readonly<Record<Exclude<SchemeId, 'time'>, Record<string, unknown>>> = {
  pages: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@ratzinger2007', scheme: 'pages', edition: { pdfPageOffset: 12, language: 'pl' },
    portion: { key: 'rozdz-1', label: 'Rozdział 1. Chrzest Jezusa', order: 1 }, // i18n-ignore
    blocks: [
      { type: 'page', page: '33', pdf: 45 },
      { type: 'heading', level: 1, loc: 'rozdz. 1', text: 'Rozdział pierwszy. Chrzest Jezusa' }, // i18n-ignore
      { type: 'paragraph', text: 'Pierwsze zdanie akapitu na stronie 33, który przechodzi na następną {{page 34 pdf 46}} stronę i ma przypis.{{note 1}}' }, // i18n-ignore
      { type: 'paragraph', text: 'Kolejny akapit, w którym jedno słowo jest {{? nieczytelne}}, a fragment pominięto {{gap}}.', uncertain: true }, // i18n-ignore
      { type: 'note', id: '1', text: 'Por. J. Jeremias, Teologia Nowego Testamentu, s. 45.' } // i18n-ignore
    ]
  },
  bible: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@bt', scheme: 'bible', edition: { language: 'pl', psalms: 'hebrew' },
    portion: { key: 'J', label: 'Ewangelia według św. Jana', order: 43 }, // i18n-ignore
    blocks: [
      { type: 'heading', level: 1, loc: 'J 21', text: 'Rozdział 21' }, // i18n-ignore
      { type: 'heading', level: 2, text: 'Jezus ukazuje się nad Jeziorem Tyberiadzkim' }, // i18n-ignore
      { type: 'paragraph', loc: 'J 21,15', text: 'A gdy spożyli śniadanie, rzekł Jezus do Szymona Piotra: «Szymonie, synu Jana, czy miłujesz Mnie więcej aniżeli ci?»' }, // i18n-ignore
      { type: 'paragraph', loc: 'J 21,16', text: 'I drugi raz powiedział do niego: «Szymonie, synu Jana, czy miłujesz Mnie?»' } // i18n-ignore
    ]
  },
  numbered: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@dei-verbum', scheme: 'numbered', edition: { language: 'pl' },
    portion: { key: 'rozdz-2', label: 'Rozdział II. Przekazywanie Objawienia Bożego', order: 2 }, // i18n-ignore
    blocks: [
      { type: 'heading', level: 1, text: 'Rozdział II. Przekazywanie Objawienia Bożego' }, // i18n-ignore
      { type: 'paragraph', loc: 'nr 7', text: 'Bóg w swej łaskawości postanowił, aby to, co dla zbawienia wszystkich narodów objawił, trwało na zawsze nienaruszone.' }, // i18n-ignore
      { type: 'paragraph', loc: 'nr 8', text: 'Przeto przepowiadanie apostolskie, które w szczególniejszy sposób wyrażone jest w księgach natchnionych…' } // i18n-ignore
    ]
  },
  aquinas: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@sth', scheme: 'aquinas', edition: { language: 'la' },
    portion: { key: 'I-q2', label: 'I, q. 2. De Deo, an Deus sit', order: 2 }, // i18n-ignore
    blocks: [
      { type: 'heading', level: 1, loc: 'I, q. 2', text: 'Quaestio 2. De Deo, an Deus sit' }, // i18n-ignore
      { type: 'heading', level: 2, loc: 'I, q. 2, a. 3', text: 'Articulus 3. Utrum Deus sit' }, // i18n-ignore
      { type: 'paragraph', loc: 'I, q. 2, a. 3, arg. 1', text: 'Ad tertium sic proceditur. Videtur quod Deus non sit.' }, // i18n-ignore
      { type: 'paragraph', loc: 'I, q. 2, a. 3, sed contra', text: 'Sed contra est quod dicitur Exodi III, ex persona Dei, ego sum qui sum.' }, // i18n-ignore
      { type: 'paragraph', loc: 'I, q. 2, a. 3, co.', text: 'Respondeo dicendum quod Deum esse quinque viis probari potest.' }, // i18n-ignore
      { type: 'paragraph', loc: 'I, q. 2, a. 3, ad 1', text: 'Ad primum ergo dicendum quod, sicut Augustinus dicit in Enchiridio…' } // i18n-ignore
    ]
  },
  decimal: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@tractatus', scheme: 'decimal', edition: { language: 'pl' },
    portion: { key: '2', label: 'Twierdzenie 2', order: 2 }, // i18n-ignore
    blocks: [
      { type: 'paragraph', loc: '2', text: 'To, co zachodzi, fakt, to istnienie stanów rzeczy.' }, // i18n-ignore
      { type: 'paragraph', loc: '2.01', text: 'Stan rzeczy jest połączeniem przedmiotów (rzeczy).' }, // i18n-ignore
      { type: 'paragraph', loc: '2.011', text: 'Dla rzeczy jest istotne, że może ona być składnikiem stanu rzeczy.' }, // i18n-ignore
      { type: 'paragraph', loc: '2.012', text: 'W logice nic nie jest przypadkowe.' }, // i18n-ignore
      { type: 'paragraph', loc: '2.0121', text: 'Wyglądałoby to na przypadek, gdyby rzeczy, która mogłaby występować samodzielnie, później miała przypaść w udziale sytuacja.' } // i18n-ignore
    ]
  },
  sections: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@dociekania', scheme: 'sections', edition: { language: 'pl' },
    portion: { key: 'cz-1-41-45', label: 'Część I, §§ 41–45', order: 1 }, // i18n-ignore
    blocks: [
      { type: 'paragraph', loc: '§ 43', text: 'Dla wielkiej klasy przypadków użycia słowa „znaczenie" — choć nie dla wszystkich — można to słowo objaśnić tak: znaczeniem słowa jest jego użycie w języku.' }, // i18n-ignore
      { type: 'paragraph', loc: '§ 44', text: 'Powiedzieliśmy: zdanie „Excalibur ma ostre ostrze" ma sens także wtedy, gdy Excalibur jest już rozbity.' } // i18n-ignore
    ]
  },
  outline: {
    format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@wyznania', scheme: 'outline', edition: { language: 'pl' },
    portion: { key: 'ks-1', label: 'Księga I', order: 1 }, // i18n-ignore
    blocks: [
      { type: 'heading', level: 1, loc: 'ks. 1', text: 'Księga pierwsza' }, // i18n-ignore
      { type: 'paragraph', loc: 'ks. 1, rozdz. 1, ak. 1', text: 'Wielki jesteś, Panie, i godzien wielkiej chwały. Stworzyłeś nas dla siebie i niespokojne jest serce nasze, dopóki nie spocznie w Tobie.' }, // i18n-ignore
      { type: 'list', loc: 'ks. 1, rozdz. 1, ak. 2', items: ['Najpierw wzywać Ciebie?', 'Czy najpierw Ciebie poznać?'] }, // i18n-ignore
      { type: 'table', columns: ['Łacina', 'Polski'], rows: [['inquietum est cor nostrum', 'niespokojne jest serce nasze']] } // i18n-ignore
    ]
  }
};

/**
 * 2026-11-01 — EIN LEHRBUCH MIT WZORY: Definicja, Twierdzenie mit Namen, Beweis mit Herleitung über einen
 * Seitenwechsel, Macierze, Fallunterscheidung, Makra des Buches, Verweise, Rysunek, Tabela, Pseudokod. Wird in
 * der Prüfung mit KaTeX importiert (`app-library-check.mjs`) — muss ohne Hinweis durchgehen.
 */
export const SOURCE_MATH_EXAMPLE: Readonly<Record<string, unknown>> = {
  format: SOURCE_FORMAT, version: SOURCE_VERSION, work: '@analiza1', scheme: 'pages',
  edition: { language: 'pl', pdfPageOffset: 10, macros: { '\\R': '\\mathbb{R}', '\\norm': '\\left\\lVert #1 \\right\\rVert' } },
  portion: { key: 'rozdz-2', label: 'Rozdział 2. Ciągi liczbowe', order: 2 }, // i18n-ignore
  blocks: [
    { type: 'page', page: '41', pdf: 51 },
    { type: 'heading', level: 1, text: 'Rozdział 2. Ciągi liczbowe' }, // i18n-ignore
    { type: 'heading', level: 2, text: '2.1. Granica ciągu' }, // i18n-ignore
    { type: 'statement', kind: 'definition', label: 'Definicja 2.1', text: 'Ciąg $(a_n)$ liczb rzeczywistych jest zbieżny do $g \\in \\R$, gdy $$\\forall_{\\varepsilon > 0}\\; \\exists_{N \\in \\mathbb{N}}\\; \\forall_{n \\geq N} \\quad |a_n - g| < \\varepsilon. \\tag{2.1}$$ Piszemy wtedy $\\lim_{n \\to \\infty} a_n = g$.' }, // i18n-ignore
    { type: 'statement', kind: 'theorem', label: 'Twierdzenie 2.2', title: 'o trzech ciągach', text: 'Jeżeli $a_n \\leq b_n \\leq c_n$ dla $n \\geq n_0$ oraz $\\lim a_n = \\lim c_n = g$, to $\\lim b_n = g$.' }, // i18n-ignore
    {
      type: 'statement', kind: 'proof', label: 'Dowód', blocks: [ // i18n-ignore
        { type: 'paragraph', text: 'Niech $\\varepsilon > 0$. Z {{ref (2.1)}} dla ciągów $(a_n)$ i $(c_n)$ istnieje $N$ takie, że dla $n \\geq N$ {{page 42 pdf 52}} mamy $$\\begin{aligned} g - \\varepsilon &< a_n \\leq b_n \\\\ &\\leq c_n < g + \\varepsilon. \\end{aligned}$$' }, // i18n-ignore
        { type: 'paragraph', text: 'Stąd $|b_n - g| < \\varepsilon$ dla $n \\geq N$.{{note 1}}' } // i18n-ignore
      ]
    },
    {
      type: 'statement', kind: 'example', label: 'Przykład 2.3', blocks: [ // i18n-ignore
        { type: 'paragraph', text: 'Dla macierzy $$A = \\begin{pmatrix} 1 & 2 \\\\ 0 & 1 \\end{pmatrix}, \\qquad A^n = \\begin{pmatrix} 1 & 2n \\\\ 0 & 1 \\end{pmatrix}$$ ciąg $\\norm{A^n}$ nie jest zbieżny — por. {{ref twierdzenie 2.2}}.' }, // i18n-ignore
        { type: 'paragraph', text: 'Funkcja $f(x) = \\begin{cases} x^2, & x \\geq 0, \\\\ -x, & x < 0 \\end{cases}$ jest ciągła.' } // i18n-ignore
      ]
    },
    { type: 'figure', label: 'Rys. 2.1', text: 'Wykres ciągu $a_n = \\frac{(-1)^n}{n}$.', alt: 'Punkty na przemian nad i pod osią poziomą, coraz bliżej zera.' }, // i18n-ignore
    { type: 'table', label: 'Tabela 2.1', text: 'Wyrazy ciągu $a_n = \\left(1 + \\frac{1}{n}\\right)^n$.', columns: ['$n$', '$a_n$'], rows: [['1', '$2$'], ['10', '$2{,}5937\\ldots$']] }, // i18n-ignore
    { type: 'code', lang: 'pseudokod', text: 'dla n := 1, 2, …\n    jeśli |a(n) − g| < ε: zwróć n' }, // i18n-ignore
    { type: 'note', id: '1', text: 'Tak samo dowodzi się wersji dla funkcji: jeśli $f \\leq g \\leq h$ w otoczeniu punktu $x_0$, to granice też są uporządkowane.' } // i18n-ignore
  ]
};

/**
 * 2026-10-30 — WAS DIE APP MIT EINEM TEXT TUT („Jak aplikacja używa tych danych"): Czytnik, „pokaż w tekście",
 * andere Ausgaben, „W Wiedzy", wer ihn sieht, der Dostęp dla AI. Steht am Ende dieser Beschreibung und — mit dem
 * Werk davor — am Ende von „Dzieło z tekstem" (`sourceImport.ts`, dort ohne den eigenen Abschnitt hier).
 */
export const sourceTextUse = (): string => t('librarySource.describe.use');

/**
 * Die Beschreibung des Formats — vollständig und ohne Wissen über die App zu schreiben. `usage: false` lässt
 * „Jak aplikacja używa tych danych" weg (für „Dzieło z tekstem", das ihn am eigenen Ende trägt).
 */
export function sourceTextDescription(asked?: SchemeId, { usage = true }: { readonly usage?: boolean } = {}): string {
  const scheme = asked === 'time' ? undefined : asked;
  const schemes = scheme === undefined ? TEXT_SCHEMES : TEXT_SCHEMES.filter((x) => x.id === scheme);
  return `${t('librarySource.describe.head', { format: SOURCE_FORMAT, version: SOURCE_VERSION, scheme: scheme ?? 'pages', kinds: STATEMENT_KINDS.filter((k) => k.id !== 'other').map((k) => `${k.id} (${k.label})`).join(', ') })}
${schemes.map((x) => t('librarySource.describe.schemeLine', { id: x.id, label: x.label, says: x.says, examples: x.examples.join(' · ') })).join('\n')}

${t('librarySource.describe.rules')}

${t('librarySource.describe.examplesHead')}
${schemes.map((x) => `${t('librarySource.describe.exampleHead', { label: x.label, id: x.id })}\n${JSON.stringify(SOURCE_EXAMPLES[x.id as Exclude<SchemeId, 'time'>], null, 2)}`).join('\n\n')}

${t('librarySource.describe.mathExample')}
${JSON.stringify(SOURCE_MATH_EXAMPLE, null, 2)}
${usage ? `\n${t('librarySource.describe.useHead')}\n${sourceTextUse()}\n` : ''}`;
}

/** Der Auftrag für die eigene KI: was zu tun ist, das Werk, das Format für SEINE Regel. */
export function sourceTextPrompt(work: LibEntry, title: string, scheme: SchemeId, portionHint = ''): string {
  return `${t('librarySource.prompt.intro')}

${t('librarySource.prompt.work', { title, key: work.key === undefined ? '' : t('librarySource.prompt.workKey', { key: work.key }) })}
${t('librarySource.prompt.scheme', { scheme, label: schemeOf(scheme).label })}${portionHint === '' ? '' : `\n${t('librarySource.prompt.portion', { portion: portionHint })}`}

${t('librarySource.prompt.faithful')}
${mathAsk()}

${sourceTextDescription(scheme)}`;
}

/** 2026-11-01 — was eine KI bei Wzory, Aussagen und Rysunki tun soll, in drei Sätzen (vor der Beschreibung). */
export const mathAsk = (): string => t('librarySource.describe.mathAsk');

/** Eine Stelle schön (für Kopf und Liste der Teile). */
export const placeLabel = (loc: string | undefined, scheme: SchemeId, edition: Edition = {}): string =>
  loc === undefined || loc === '' ? '' : formatPlace(parsePlace(loc, scheme, placeOptions(edition)), loc);

export const pageRangeLabel = (pages: readonly [number, number] | undefined): string => {
  if (pages === undefined) return '';
  const w = (n: number) => formatPlace({ scheme: 'pages', spans: [], pages: [{ from: n, to: n }], rest: '' }).replace(/^s\. /, '');
  return pages[0] === pages[1] ? `s. ${w(pages[0])}` : `s. ${w(pages[0])}–${w(pages[1])}`;
};

/* -- Über die Bibliotheken hinweg: welche Texte hat ein Werk, wo steht eine Stelle -------------- */

export interface WorkText {
  readonly entry: LibEntry;
  readonly manifest: TextManifest;
}

/** Wie man Texte findet — ein `Lookup` (der Speicher) und, im Arbeitsbereich, was der Tab sonst offen hat. */
export type TextFinder = (workId: string) => readonly LibEntry[];

export const textsOfWork = (find: TextFinder, workId: string): WorkText[] =>
  find(workId).filter((e) => e.kind === TEXT_KIND).map((entry) => ({ entry, manifest: readManifest(entry.data) }));

/**
 * DIE ANDEREN AUSGABEN DESSELBEN WERKS — über `editionOf`: das Original, auf das diese
 * Ausgabe zeigt, und alle Ausgaben, die auf dasselbe Original (oder auf diese) zeigen.
 */
export function editionsOf(look: Lookup, work: LibEntry): LibEntry[] {
  const root = ids(work.data, 'editionOf')[0] ?? work.id;
  const out = new Map<string, LibEntry>();
  const original = look.get(root);
  if (original !== undefined && original.id !== work.id) out.set(original.id, original);
  for (const e of look.readable?.() ?? []) {
    if (e.kind !== 'work' || e.id === work.id) continue;
    const of = ids(e.data, 'editionOf')[0];
    if (of === root || of === work.id) out.set(e.id, e);
  }
  return [...out.values()];
}

export interface TextLink extends TextPlace {
  readonly text?: WorkText;
  readonly workId: string;
  readonly locator: string;
  /** Gefunden im Text einer ANDEREN Ausgabe (nur Stellen der Struktur gelten dort). */
  readonly edition?: LibEntry;
}

/**
 * WO STEHT EINE ZITIERTE STELLE IM TEXT? Zuerst in den Texten genau dieses Werks; findet
 * sich dort nichts und nennt die Stelle die Struktur (ein Vers, eine Nummer), auch im Text
 * einer anderen Ausgabe — Seiten nie. `null`: kein Text, nichts zu sagen.
 */
export function textPlace(look: Lookup, find: TextFinder, workId: string, locator: string): TextLink | null {
  const own = textsOfWork(find, workId);
  const wanted = locator.trim();
  const at = (text: WorkText): TextPlace => (wanted === ''
    ? (text.manifest.parts.length > 0 ? { status: 'found', part: text.manifest.parts[0], why: '' } : { status: 'none', why: t('librarySource.place.noParts') })
    : placeInManifest(text.manifest, wanted));
  let ambiguous: TextLink | null = null;
  let none: TextLink | null = null;
  for (const text of own) {
    const hit = at(text);
    const link = { ...hit, text, workId, locator: wanted };
    if (hit.status === 'found') return link;
    if (hit.status === 'ambiguous') ambiguous ??= link;
    else none ??= link;
  }
  if (ambiguous !== null) return ambiguous;
  const work = look.get(workId);
  if (wanted !== '' && work !== undefined) {
    for (const other of editionsOf(look, work)) {
      for (const text of textsOfWork(find, other.id)) {
        const place = parsePlace(wanted, text.manifest.scheme, placeOptions(text.manifest.edition));
        if (place.spans.length === 0) continue;
        const hit = placeInManifest(text.manifest, formatPlace({ ...place, pages: [], rest: '' }));
        if (hit.status === 'found') return { ...hit, text, workId: other.id, locator: wanted, edition: other };
      }
    }
  }
  return none;
}

/** Teile eines Textes, die dieselben Stellen tragen wie ein neuer Teil (anderer Schlüssel) — wohl doppelt eingelesen. */
export function overlapsWith(manifest: TextManifest | undefined, plan: SourcePlan): string[] {
  if (manifest === undefined) return [];
  const opts = placeOptions(plan.edition);
  const range = (first?: string, last?: string): Span | null => {
    if (first === undefined) return null;
    const a = parsePlace(first, plan.scheme, opts).spans[0];
    const b = parsePlace(last ?? first, plan.scheme, opts).spans.slice(-1)[0];
    return a === undefined || b === undefined ? null : { from: a.from, to: b.to };
  };
  const mine = range(plan.summary.first, plan.summary.last);
  const myPages = plan.summary.pages;
  return manifest.parts.filter((p) => p.key !== plan.portion.key).filter((p) => {
    const theirs = range(p.first, p.last);
    if (mine !== null && theirs !== null) {
      /* Wo die Stellen sich treffen — nicht schon, wenn beide unter derselben Überschrift (einem Kapitel) beginnen. */
      if (!overlap(mine, theirs)) return false;
      const wider = contains(theirs, mine) ? theirs : contains(mine, theirs) ? mine : null;
      return wider === null || JSON.stringify(mine) === JSON.stringify(theirs);
    }
    if (mine === null && theirs === null && myPages !== undefined && p.pages !== undefined) {
      /*
       * 2026-10-27 — Seiten: ein Kapitel endet oft mitten auf der Seite, auf der das nächste beginnt, und jeder Teil nennt
       * die Seite, auf der er beginnt (er wird für sich gelesen). Teilen sich zwei Teile nur diese eine Grenzseite — das
       * Ende des einen, der Anfang des anderen —, ist das kein doppelter Text. Doppelt ist, was darüber hinaus dieselben
       * Seiten trägt, oder genau dieselben Seiten mit genau so vielen Blöcken und Wörtern (derselbe Teil, anderer Schlüssel).
       */
      const a = { from: myPages[0], to: myPages[1] };
      const b = { from: p.pages[0], to: p.pages[1] };
      if (!pagesOverlap(a, b)) return false;
      const from = Math.max(a.from, b.from);
      const to = Math.min(a.to, b.to);
      const boundary = from === to && ((from === a.to && from === b.from) || (from === b.to && from === a.from));
      const same = a.from === b.from && a.to === b.to && p.blocks === plan.summary.blocks && p.words === plan.summary.words;
      return !boundary || same;
    }
    return false;
  }).map((p) => p.label);
}

/** Das neue Verzeichnis nach einem Teil: ersetzt (gleicher Schlüssel) oder dazu, geordnet. */
export function nextManifest(before: TextManifest | undefined, work: string, plan: SourcePlan, partId: string): EntryData {
  const { first, last, pages, series, blocks, words, formulas, labels } = plan.summary;
  const part: ManifestPart = {
    id: partId, key: plan.portion.key, label: plan.portion.label, order: plan.portion.order,
    ...(first === undefined ? {} : { first }), ...(last === undefined ? {} : { last }), ...(pages === undefined ? {} : { pages }),
    ...(series === undefined ? {} : { series }), blocks, words,
    ...(formulas === undefined ? {} : { formulas }), ...(labels === undefined ? {} : { labels })
  };
  const parts = [...(before?.parts ?? []).filter((p) => p.key !== plan.portion.key && p.id !== partId), part]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pl'));
  return { work, scheme: plan.scheme, ...(Object.keys(plan.edition).length === 0 ? {} : { edition: plan.edition }), parts };
}

/** Die Hülle eines Teils. */
export const partData = (textId: string, work: string, plan: SourcePlan): EntryData =>
  ({ text: textId, work, key: plan.portion.key, label: plan.portion.label, order: plan.portion.order, blocks: plan.blocks });

/** Hat sich an einem Teil etwas geändert? (Derselbe Teil noch einmal importiert — nichts zu schreiben.) */
export const samePart = (before: PartData, plan: SourcePlan): boolean =>
  before.label === plan.portion.label && before.order === plan.portion.order && JSON.stringify(before.blocks) === JSON.stringify(plan.blocks);

/* -- Aus einer Auswahl: das Zitat mit seiner Stelle ----------------------------------------------- */

/**
 * DIE STELLE EINER AUSWAHL — von Block `first` bis Block `last` eines Teils: in der Struktur
 * (von der ersten bis zur letzten Stelle, die die Blöcke tragen oder erben), bei `pages`
 * die Seiten, auf denen sie stehen (sie gelten in genau dieser Ausgabe, deren Zitat es wird).
 */
export function selectionLocator(blocks: readonly SourceBlock[], first: number, last: number, scheme: SchemeId, edition: Edition = {}): string {
  const opts = placeOptions(edition);
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  const spanAt = (i: number): readonly Span[] => {
    for (let j = i; j >= 0; j -= 1) {
      const loc = blocks[j]?.loc;
      if (loc !== undefined && loc.trim() !== '') return parsePlace(loc, scheme, opts).spans;
    }
    return [];
  };
  const a = spanAt(lo);
  const b = spanAt(hi);
  if (scheme !== 'pages' && a.length > 0 && b.length > 0) {
    return formatPlace({ scheme, spans: [{ from: a[0]!.from, to: b[b.length - 1]!.to }], pages: [], rest: '' });
  }
  const pages = blockPages(blocks).slice(lo, hi + 1).filter((p): p is { from: number; to: number } => p !== null);
  if (pages.length === 0) return '';
  return pageRangeLabel([Math.min(...pages.map((p) => p.from)), Math.max(...pages.map((p) => p.to))]);
}

/* -- Zwei Ausgaben nebeneinander ------------------------------------------------------------------ */

export interface AlignedRow {
  readonly mine: number[];
  readonly theirs: number[];
}

/**
 * ZWEI AUSGABEN, AN DEN STELLEN AUSGERICHTET. Jeder Block mit eigener Stelle beginnt eine Zeile;
 * jeder Block der anderen Ausgabe kommt in die Zeile, deren Stelle seiner entspricht: dieselbe;
 * sonst die erste, die in seiner liegt (ein Absatz „15-17" neben Vers 15); sonst die engste, die
 * ihn umfasst (ein Vers neben dem Absatz, der ihn trägt); sonst die erste, die ihn berührt. Was
 * keine Stelle hat (eine Überschrift), bleibt bei dem, was davor stand. Seiten zählen nicht —
 * sie gehören je zu ihrer Ausgabe.
 */
export function alignEditions(
  mine: readonly SourceBlock[], theirs: readonly SourceBlock[],
  a: { scheme: SchemeId; edition?: Edition }, b: { scheme: SchemeId; edition?: Edition }
): { rows: AlignedRow[]; rest: number[] } {
  const spansOf = (blocks: readonly SourceBlock[], scheme: SchemeId, edition: Edition = {}) => {
    let current: readonly Span[] = [];
    return blocks.map((block) => {
      const own = block.loc !== undefined && block.loc.trim() !== '' ? parsePlace(block.loc, scheme, placeOptions(edition)).spans : null;
      if (own !== null) current = own;
      return { own, current };
    });
  };
  const rows: (AlignedRow & { span: readonly Span[] })[] = [];
  spansOf(mine, a.scheme, a.edition).forEach((s, i) => {
    if (rows.length === 0 || (s.own !== null && s.own.length > 0)) rows.push({ mine: [i], theirs: [], span: s.own ?? [] });
    else rows[rows.length - 1]!.mine.push(i);
  });
  const equal = (x: readonly Span[], y: readonly Span[]) => x.length > 0 && x.every((p) => y.some((q) => contains(p, q) && contains(q, p))) && y.every((q) => x.some((p) => contains(p, q) && contains(q, p)));
  const any = (x: readonly Span[], y: readonly Span[], test: (p: Span, q: Span) => boolean) => x.some((p) => y.some((q) => test(p, q)));
  const rest: number[] = [];
  let last: number | null = null;
  spansOf(theirs, b.scheme, b.edition).forEach((s, j) => {
    const want = s.current;
    let at: number | null = null;
    if (want.length > 0) {
      const candidates = rows.map((r, k) => ({ r, k })).filter(({ r }) => r.span.length > 0 && any(r.span, want, overlap));
      const key = (spans: readonly Span[]) => placeSortKey({ scheme: b.scheme, spans: spans.slice(0, 1), pages: [], rest: '' });
      const pick = candidates.find(({ r }) => equal(r.span, want))
        ?? candidates.find(({ r }) => any(want, r.span, contains) && !equal(r.span, want) && !any(r.span, want, (p, q) => contains(p, q) && !contains(q, p)))
        /* Nur umfasst (ein Kapitel): hinter die letzte Zeile, die vor ihm beginnt — Vers 17 nach Vers 16, nicht zur Überschrift. */
        ?? (candidates.length > 0 ? rows.map((r, k) => ({ r, k })).filter(({ r }) => r.span.length > 0 && key(r.span) <= key(want)).pop() : undefined)
        ?? candidates[0];
      at = pick?.k ?? null;
    } else at = last;
    if (at === null) rest.push(j);
    else { rows[at]!.theirs.push(j); last = at; }
  });
  return { rows: rows.map(({ mine: m, theirs: t }) => ({ mine: m, theirs: t })), rest };
}

/* -- Suchen im Text --------------------------------------------------------------------------- */

const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l'); // i18n-ignore

export interface TextHit {
  readonly part: ManifestPart;
  readonly index: number;
  readonly loc: string;
  readonly snippet: string;
}

/** LaTeX zum Vergleichen: ohne Leerraum (`x^2 + 1` wie `x^2+1`). */
const texKey = (tex: string): string => tex.replace(/\s+/g, '');

/**
 * Ein Wort oder eine Wendung in den geladenen Teilen — nur in dem, was dieser Leser geöffnet hat. 2026-11-01:
 * auch in den Wzory — als Zeile Text („α", „∫", „sin") und im LaTeX (`\frac`, `x^2`, „alpha").
 */
export function searchParts(parts: readonly { part: ManifestPart; data: PartData }[], query: string, limit = 60): TextHit[] {
  const q = fold(query.trim()).replace(/\s+/g, ' ');
  /* Ein Zeichen allein nur, wenn es kein lateinischer Buchstabe und keine Ziffer ist — „∫", „ε", „ℝ" sucht man so. */
  if (q.length < 2 && !(q.length === 1 && /[^a-z0-9]/.test(q))) return [];
  const asTex = /[\\^_{}]/.test(query) ? texKey(query.trim().replace(/^\$+|\$+$/g, '')) : '';
  const out: TextHit[] = [];
  for (const { part, data } of parts) {
    let loc = '';
    data.blocks.forEach((b, index) => {
      if (b.loc !== undefined && b.loc !== '') loc = b.loc;
      if (out.length >= limit || b.type === 'page') return;
      const texts = blockTexts(b);
      const plain = texts.map(plainOfText).join(' ');
      /* `fold` ändert die Länge nicht (ein Zeichen bleibt ein Zeichen) — die Stelle gilt im Klartext. */
      let at = fold(plain).indexOf(q);
      if (at < 0) {
        const tex = texts.map(texOfText).join(' ');
        if (tex === '' || !(fold(tex).includes(q) || (asTex !== '' && texKey(tex).includes(asTex)))) return;
        at = 0;
      }
      const from = Math.max(0, at - 60);
      const to = at + q.length + 80;
      out.push({ part, index, loc: b.loc ?? loc, snippet: `${from > 0 ? '…' : ''}${plain.slice(from, to).trim()}${to < plain.length ? '…' : ''}` });
    });
  }
  return out;
}

/** Der ganze Text als JSON — ein Dokument je Teil (ein Teil allein: das Dokument selbst). */
export const exportSourceText = (work: LibEntry, manifest: TextManifest, parts: readonly PartData[]): unknown =>
  parts.length === 1 ? exportSourcePart(work, manifest, parts[0]!) : parts.map((p) => exportSourcePart(work, manifest, p));

export type { PageSpan, Place, SchemeId };
