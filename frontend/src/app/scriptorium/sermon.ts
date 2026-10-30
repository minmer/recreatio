/**
 * KAZANIA (2026-10-21) — der Plan eines Textes, seine Wygłoszenia und was
 * davon gesagt wurde. Reine Rechnung ohne Browser: die öffentliche Seite,
 * der Editor und die Prüfung (`app-library-check.mjs`) lesen dasselbe.
 *
 * <code>
 *   Text (kazanie)      Plan: Punkte mit fester Kennung — Myśl, Cytat, Przykład, Pytanie, Zastosowanie
 *   Wygłoszenie         ein Mal gesagt: wann, wo, Nagranie — und je Punkt des Plans:
 *                       powiedziane · krótko · pominięte (mit der Stelle im Nagranie);
 *                       dazu „co doszło": was gesagt wurde und nicht im Plan stand
 * </code>
 *
 * <b>Ein Text, viele Wygłoszenia.</b> Ein Kazanie wird vorbereitet und
 * gehalten — einmal oder in jeder Messe des Sonntags, und Jahre später noch
 * einmal. Was es SAGEN will, steht einmal im Text; was jedes Mal daraus
 * wurde, steht beim Wygłoszenie. So zeigt die Seite einen Plan und darauf,
 * was in dieser Aufnahme gesagt wurde und was nicht.
 *
 * <b>Die KI bleibt draussen</b> (wie bei den Zitaten): `deliveryPrompt` ist
 * das Polecenie für den eigenen Chat — mit dem Plan und seinen Kennungen;
 * zurück kommt JSON der Bibliothek, das das Wygłoszenie an Ort und Stelle
 * ändert.
 */

import { citeSegs, newCiteState, originOf, segText } from '../library/libraryCite';
import {
  COVERAGE_STATES, ids, isSource, itemsOf, kindOf, num, ownTitle, POINT_KINDS, refTarget, str,
  type EntryData, type LibEntry, type Lookup
} from '../library/libraryKinds';
import { parseMarkup, plainText, type Inline } from '../library/libraryMarkup';

export type PointKind = (typeof POINT_KINDS)[number]['value'];
export type CoverageState = (typeof COVERAGE_STATES)[number]['value'];

export interface PlanPoint {
  readonly id: string;
  /** Zapis — ein Gedanke, ein Satz mit Quelle, oder ein `![@cytat]`. */
  readonly text: string;
  readonly depth: 0 | 1 | 2;
  readonly kind: PointKind;
  /**
   * ALT (bis 2026-10-22): eine Notiz am Punkt. Sie wird bei der Umstellung
   * gezeigt wird sie nirgends mehr; sie reist unverändert mit
   * (2026-10-23: keine Umstellung mehr).
   */
  readonly note: string;
}

const POINT_KIND_SET: ReadonlySet<string> = new Set(POINT_KINDS.map((k) => k.value));
const STATE_SET: ReadonlySet<string> = new Set(COVERAGE_STATES.map((s) => s.value));

export const pointKindLabel = (kind: string): string => POINT_KINDS.find((k) => k.value === kind)?.label ?? 'Myśl';
export const stateLabel = (state: string): string => COVERAGE_STATES.find((s) => s.value === state)?.label ?? 'Nie oznaczone';

/* -- Der Plan --------------------------------------------------------------------------------- */

const depthOf = (value: number | null): 0 | 1 | 2 => (value === null ? 0 : value >= 2 ? 2 : value >= 1 ? 1 : 0);

/**
 * DER PLAN, duldsam gelesen: ein Punkt ohne Kennung bekommt eine aus seiner
 * Stelle (`#3`) — so bleibt er sichtbar, auch wenn ihn kein Wygłoszenie
 * nennen kann —, und keine Stufe springt um zwei (unter einer Myśl steht
 * Stufe 1, nicht 2).
 */
export function planOf(data: EntryData, options: { keepEmpty?: boolean } = {}): PlanPoint[] {
  const out: PlanPoint[] = [];
  const seen = new Set<string>();
  let previous = -1;
  for (const [index, item] of itemsOf(data, 'plan').entries()) {
    /* Im Editor bleibt ein leerer Punkt stehen — man hat gerade Enter gedrückt. */
    const text = options.keepEmpty === true ? str(item, 'text') : str(item, 'text').replace(/\s+$/, '');
    if (text.trim() === '' && options.keepEmpty !== true) continue;
    let id = str(item, 'id').trim();
    if (id === '' || seen.has(id)) id = `#${index + 1}`;
    seen.add(id);
    const depth = depthOf(Math.min(num(item, 'depth') ?? 0, previous + 1));
    previous = depth;
    const kind = str(item, 'kind');
    out.push({ id, text, depth, kind: (POINT_KIND_SET.has(kind) ? kind : /^!\[@[^\]]+\]$/.test(text.trim()) ? 'quote' : 'thought') as PointKind, note: str(item, 'note') });
  }
  return out;
}

/** Wie ein Punkt gespeichert wird — ohne leere Felder, ohne „myśl" (die Vorgabe). */
export function pointData(point: PlanPoint): Record<string, unknown> {
  return {
    id: point.id,
    text: point.text,
    ...(point.depth === 0 ? {} : { depth: point.depth }),
    ...(point.kind === 'thought' ? {} : { kind: point.kind }),
    ...(point.note.trim() === '' ? {} : { note: point.note })
  };
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Eine neue Kennung für einen Punkt — kurz („p4k2x"), und keine, die es schon gibt. */
export function newPointId(taken: (id: string) => boolean): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const id = `p${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
    if (!taken(id)) return id;
  }
  return `p${Date.now().toString(36)}`;
}

/** Die Nummern der Punkte: „1", „1.1", „1.1.1", „2" — wie man sie auf der Kanzel liest. */
export function pointNumbers(plan: readonly PlanPoint[]): Map<string, string> {
  const out = new Map<string, string>();
  const counter = [0, 0, 0];
  for (const point of plan) {
    counter[point.depth] += 1;
    for (let d = point.depth + 1; d < 3; d += 1) counter[d] = 0;
    out.set(point.id, counter.slice(0, point.depth + 1).map((n) => Math.max(1, n)).join('.'));
  }
  return out;
}

/** Nur der Schlüssel eines eingebetteten Zitats, wenn der Punkt nichts anderes ist. */
export const embedOf = (text: string): string | null => /^!\[@([A-Za-z0-9][A-Za-z0-9_.:-]*)(?:\s*,[^\]]*)?\]$/.exec(text.trim())?.[1] ?? null;

const cut = (text: string, length: number): string => (text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text);

/**
 * EIN PUNKT ALS ZEILE OHNE ZAPIS — für Listen, die Kurzfassung und das
 * Polecenie. Mit `look` steht eine Quelle in Klammern („(J 6,35 (BT))") und
 * ein eingebettetes Zitat mit Wortlaut und Herkunft; ohne `look` bleibt nur,
 * was man liest.
 */
export function pointLine(text: string, look?: Lookup, length = 400): string {
  const flat = (list: readonly Inline[]): string => list.map((one) => {
    switch (one.t) {
      case 'text': return one.v;
      case 'br': return ' ';
      case 'note': return '';
      case 'cite': {
        if (look === undefined) return '';
        /* 2026-10-22 — ein eigener Eintrag mit seinem Namen, Quellen in Klammern. */
        const own = one.items.filter((item) => !isSource(refTarget(look, item.key))).map((item) => ownTitle(refTarget(look, item.key)!, look));
        const sources = one.items.filter((item) => isSource(refTarget(look, item.key)));
        return `${own.length === 0 ? '' : ` (zob. ${own.join('; ')})`}${sources.length === 0 ? '' : ` (${sources.map((item) => segText(citeSegs(refTarget(look, item.key), item.locator, look, newCiteState()))).join('; ')})`}`;
      }
      default: return flat(one.c);
    }
  }).join('');
  const quoted = (key: string): string => {
    const quote = look === undefined ? undefined : refTarget(look, key);
    if (look === undefined || quote === undefined || quote.kind !== 'quote') return look === undefined ? '' : `[cytat ${key}]`;
    return `„${cut(str(quote.data, 'text').replace(/\s+/g, ' ').trim(), length)}” — ${originOf(quote, look)}`;
  };
  const parts: string[] = [];
  for (const block of parseMarkup(text)) {
    if (block.t === 'p' || block.t === 'h') parts.push(flat(block.c));
    else if (block.t === 'list') parts.push(...block.items.map(flat));
    else if (block.t === 'quote') parts.push(plainText(block.c.length === 0 ? '' : text.replace(/^>\s?/gm, '')));
    else if (block.t === 'embed') parts.push(quoted(block.key));
  }
  return cut(parts.join(' ').replace(/\s+/g, ' ').replace(/ +([.,;:!?)])/g, '$1').trim(), length);
}

/**
 * EINEN PLAN EINFÜGEN, wie man ihn tippt oder kopiert: eine Zeile je Punkt;
 * die Stufe aus dem Einzug (Tab, zwei Leerzeichen), aus der Nummer („1.2")
 * oder einem kleinen Buchstaben („a)"); „- ", „• " fallen weg. „> " macht
 * einen Cytat, ein Fragezeichen am Ende ein Pytanie.
 */
export function planFromText(text: string): { text: string; depth: 0 | 1 | 2; kind: PointKind }[] {
  const out: { text: string; depth: 0 | 1 | 2; kind: PointKind }[] = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (raw.trim() === '') continue;
    const indent = /^[\t ]*/.exec(raw)![0];
    let depth = Math.floor([...indent].reduce((n, c) => n + (c === '\t' ? 2 : 1), 0) / 2);
    let line = raw.trim();
    const dotted = /^(\d+(?:\.\d+)+)\.?\s+/.exec(line) ?? /^(\d+)[.)]\s+/.exec(line);
    if (dotted !== null) {
      depth = Math.max(depth, dotted[1].split('.').length - 1);
      line = line.slice(dotted[0].length);
    } else {
      const lower = /^(?:[a-z]|[ivx]{1,4})[.)]\s+/.exec(line);
      const upper = /^[IVX]{1,4}[.)]\s+/.exec(line);
      const bullet = /^[-*•–]\s+/.exec(line);
      if (lower !== null) { depth = Math.max(depth, 1); line = line.slice(lower[0].length); }
      else if (upper !== null) line = line.slice(upper[0].length);
      else if (bullet !== null) line = line.slice(bullet[0].length);
    }
    let kind: PointKind = 'thought';
    if (line.startsWith('>')) { kind = 'quote'; line = line.replace(/^>\s*/, ''); }
    else if (embedOf(line) !== null) kind = 'quote';
    else if (/\?\s*$/.test(line)) kind = 'question';
    line = line.trim();
    if (line === '') continue;
    const previous = out.length === 0 ? -1 : out[out.length - 1].depth;
    out.push({ text: line, depth: depthOf(Math.min(depth, previous + 1)), kind });
  }
  return out;
}

/* -- Was gesagt wurde ---------------------------------------------------------------------- */

export interface CoverageItem {
  readonly point: string;
  readonly state: CoverageState | '';
  readonly at: string;
  readonly note: string;
}

export interface AddedItem {
  readonly text: string;
  readonly at: string;
  readonly after: string;
}

export function coverageOf(data: EntryData): CoverageItem[] {
  return itemsOf(data, 'coverage').map((item) => {
    const state = str(item, 'state');
    return { point: str(item, 'point').trim(), state: (STATE_SET.has(state) ? state : '') as CoverageState | '', at: str(item, 'at').trim(), note: str(item, 'note') };
  }).filter((item) => item.point !== '');
}

export function addedOf(data: EntryData): AddedItem[] {
  return itemsOf(data, 'added').map((item) => ({ text: str(item, 'text'), at: str(item, 'at').trim(), after: str(item, 'after').trim() }))
    .filter((item) => item.text.trim() !== '');
}

/** Wie eine Zeile gespeichert wird — ohne leere Felder. */
export const coverageData = (item: CoverageItem): Record<string, unknown> => ({
  point: item.point,
  ...(item.state === '' ? {} : { state: item.state }),
  ...(item.at === '' ? {} : { at: item.at }),
  ...(item.note.trim() === '' ? {} : { note: item.note })
});

export const addedData = (item: AddedItem): Record<string, unknown> => ({
  text: item.text,
  ...(item.at === '' ? {} : { at: item.at }),
  ...(item.after === '' ? {} : { after: item.after })
});

/** Je Punkt die letzte Zeile, die ihn nennt. */
export function coverageIndex(coverage: readonly CoverageItem[]): Map<string, CoverageItem> {
  return new Map(coverage.map((item) => [item.point, item]));
}

export interface CoverageCounts {
  readonly points: number;
  readonly said: number;
  readonly short: number;
  readonly skipped: number;
  /** Punkte, über die das Wygłoszenie (noch) nichts sagt. */
  readonly open: number;
  readonly added: number;
}

export function coverageCounts(plan: readonly PlanPoint[], coverage: readonly CoverageItem[], added: readonly AddedItem[]): CoverageCounts {
  const index = coverageIndex(coverage);
  let said = 0;
  let short = 0;
  let skipped = 0;
  for (const point of plan) {
    const state = index.get(point.id)?.state ?? '';
    if (state === 'said') said += 1;
    else if (state === 'short') short += 1;
    else if (state === 'skipped') skipped += 1;
  }
  return { points: plan.length, said, short, skipped, open: plan.length - said - short - skipped, added: added.length };
}

/** In Worten: „7 z 9 punktów · 1 krótko · 1 pominięty · 2 dodane". */
export function countsLine(c: CoverageCounts): string {
  if (c.points === 0 && c.added === 0) return '';
  const parts = [`powiedziane ${c.said} z ${c.points}`];
  if (c.short > 0) parts.push(`krótko ${c.short}`);
  if (c.skipped > 0) parts.push(`pominięte ${c.skipped}`);
  if (c.open > 0 && c.open < c.points) parts.push(`bez oznaczenia ${c.open}`);
  if (c.added > 0) parts.push(`dodane ${c.added}`);
  return c.open === c.points && c.added === 0 ? '' : parts.join(' · ');
}

/* -- Zeit im Nagranie ---------------------------------------------------------------------- */

/** „4:30", „1:02:05", „95" — Sekunden; sonst `null`. */
export function secondsOf(at: string): number | null {
  const t = at.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(t);
  if (m === null) return null;
  return m[3] === undefined ? Number(m[1]) * 60 + Number(m[2]) : Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** 270 → „4:30", 3725 → „1:02:05". */
export function timeText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** Eine Datei, die der Browser selbst abspielt — `audio`, `video` — oder `null` (eine Seite, YouTube). */
export function mediaFile(url: string): 'audio' | 'video' | null {
  if (!/^https?:\/\//i.test(url.trim())) return null;
  if (/\.(mp3|m4a|ogg|oga|wav|aac|opus|flac)(\?|#|$)/i.test(url)) return 'audio';
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return 'video';
  return null;
}

/**
 * EIN LINK AN DIE STELLE: YouTube (`t=95s`), Vimeo (`#t=95s`), eine Datei
 * (Media Fragments, `#t=95`). Anderswo gibt es keine Stelle — `null`.
 */
export function timeLink(url: string, seconds: number): string | null {
  const s = Math.max(0, Math.floor(seconds));
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'music.youtube.com') { u.searchParams.set('t', `${s}s`); return u.toString(); }
    if (host === 'vimeo.com') { u.hash = `t=${s}s`; return u.toString(); }
    if (mediaFile(url) !== null) { u.hash = `t=${s}`; return u.toString(); }
  } catch {
    return null;
  }
  return null;
}

/* -- Texte und ihre Wygłoszenia --------------------------------------------------------------- */

const isDelivery = (entry: LibEntry | undefined): entry is LibEntry => entry !== undefined && entry.kind === 'delivery';

/** Neueste zuerst; ohne Datum ans Ende. */
const newestFirst = (a: LibEntry, b: LibEntry): number =>
  (str(b.data, 'date') || '0000').localeCompare(str(a.data, 'date') || '0000') || a.id.localeCompare(b.id);

/**
 * DIE WYGŁOSZENIA EINES TEXTES, neueste zuerst — alle, die dieser Leser
 * lesen darf (2026-10-22: wer liest, sagt der Bereich; ein „Nie publikuj"
 * gibt es nicht mehr).
 */
export function deliveriesOf(text: LibEntry, look: Lookup): LibEntry[] {
  const found = (look.backlinks?.(text.id) ?? []).filter((one) => isDelivery(one) && ids(one.data, 'texts').includes(text.id));
  return [...new Map(found.map((d) => [d.id, d])).values()].sort(newestFirst);
}

/** Die Texte eines Wygłoszenia, die es (noch) gibt. */
export function textsOf(delivery: LibEntry, look: Lookup): LibEntry[] {
  return ids(delivery.data, 'texts').map((id) => look.get(id)).filter((t): t is LibEntry => t !== undefined && t.kind === 'text');
}

/** Wann ein Text zuletzt gehalten wurde — sonst sein eigenes Datum. */
export function lastHeld(text: LibEntry, look: Lookup): string {
  return str(deliveriesOf(text, look)[0]?.data ?? {}, 'date') || str(text.data, 'date');
}

/** Der Plan aller Texte eines Wygłoszenia, Text für Text. */
export function deliveryPlan(delivery: LibEntry, look: Lookup): { text: LibEntry; points: PlanPoint[] }[] {
  return textsOf(delivery, look).map((text) => ({ text, points: planOf(text.data) }));
}

/** Zeilen über Punkte, die in keinem Plan (mehr) stehen. */
export function orphanCoverage(coverage: readonly CoverageItem[], plan: readonly PlanPoint[]): CoverageItem[] {
  const known = new Set(plan.map((p) => p.id));
  return coverage.filter((item) => !known.has(item.point));
}

/* -- Das Polecenie für den eigenen Chat ------------------------------------------------------------ */

/** Der Plan als Liste für ein Sprachmodell: `[p4k2x] 1.2 Myśl … (J 6,35)`. */
export function planLines(points: readonly PlanPoint[], look: Lookup): string {
  const numbers = pointNumbers(points);
  return points.map((p) => `[${p.id}] ${'   '.repeat(p.depth)}${numbers.get(p.id)} ${p.kind === 'thought' ? '' : `(${pointKindLabel(p.kind).toLowerCase()}) `}${pointLine(p.text, look, 600)}`).join('\n');
}

const fieldLines = (kind: string, keys: readonly string[]): string => {
  const def = kindOf(kind);
  const lines: string[] = [];
  for (const key of keys) {
    const field = def?.fields.find((f) => f.key === key);
    if (field === undefined) continue;
    lines.push(`  "${field.key}" — ${field.says}`);
    for (const sub of field.item ?? []) lines.push(`      "${sub.key}" — ${sub.says}`);
  }
  return lines.join('\n');
};

/**
 * DAS POLECENIE FÜR EIN WYGŁOSZENIE: den Plan (mit Kennungen) neben das
 * Nagranie oder den Zapis legen und sagen lassen, was gesagt wurde, was nur
 * kurz, was nicht — und was dazukam. Zurück kommt EIN Dokument des
 * Skryptorium, das genau dieses Wygłoszenie ändert (nur die genannten Felder).
 */
export function deliveryPrompt(delivery: LibEntry, look: Lookup): string {
  const parts = deliveryPlan(delivery, look);
  const d = delivery.data;
  const when = [str(d, 'date'), str(d, 'occasion'), str(d, 'place')].filter(Boolean).join(', ');
  const titles = parts.map((p) => `„${str(p.text.data, 'title') || 'Bez tytułu'}”`).join(' i ');
  const plans = parts.map((p) => `Plan ${parts.length > 1 ? `tekstu „${str(p.text.data, 'title')}”` : ''}:\n${p.points.length === 0 ? '(ten tekst nie ma planu)' : planLines(p.points, look)}`).join('\n\n');
  const example = {
    format: 'recreatio/scriptorium',
    version: 1,
    entries: [{
      id: delivery.id,
      kind: 'delivery',
      data: {
        summary: 'Dwa-trzy zdania o tym wygłoszeniu.',
        duration: '14:30',
        coverage: [{ point: parts[0]?.points[0]?.id ?? 'p1', state: 'said', at: '0:40' }, { point: parts[0]?.points[1]?.id ?? 'p2', state: 'skipped' }],
        added: [{ text: 'Co doszło, w jednym-dwóch zdaniach.', at: '12:50', after: parts[0]?.points[0]?.id ?? 'p1' }],
        transcript: 'Pełny zapis — akapity oddzielone pustą linią.'
      }
    }]
  };
  return `Poniżej jest plan kazania ${titles || '(bez tytułu)'}${when === '' ? '' : `, wygłoszonego: ${when}`}. Do tej wiadomości dołączam nagranie albo zapis tego wygłoszenia.

Porównaj to, co zostało powiedziane, z planem:
- Dla KAŻDEGO punktu planu podaj "state": "said" — powiedziany (w całości albo prawie), "short" — tylko wspomniany, krótko, "skipped" — pominięty.
- "at": kiedy w nagraniu ten punkt się zaczyna (m:ss albo g:mm:ss) — tylko gdy był powiedziany i masz nagranie.
- "note": jedno krótkie zdanie po polsku, co było inaczej niż w planie (np. inny przykład, inna kolejność) — tylko gdy coś było inaczej.
- "added": to, co zostało powiedziane, a czego nie ma w planie — każda rzecz osobno: "text" (jedno-dwa zdania), "at", "after" (identyfikator punktu, po którym to padło).
- "summary": dwa-trzy zdania — co tym razem było najważniejsze.
- "duration": długość nagrania (m:ss).
- "transcript": pełny zapis słowo w słowo, akapitami oddzielonymi pustą linią — tylko jeśli możesz go spisać z nagrania; inaczej pomiń.
- Używaj DOKŁADNIE identyfikatorów punktów z nawiasów kwadratowych. Nie zmieniaj planu.

${plans}

Zwróć JEDEN obiekt JSON, bez komentarzy, w tym kształcie ("id" i "kind" zostaw takie, jakie są):
${JSON.stringify(example, null, 2)}

Pola:
${fieldLines('delivery', ['summary', 'duration', 'coverage', 'added', 'transcript'])}
`;
}

/**
 * DAS POLECENIE FÜR EINEN PLAN aus dem geschriebenen Text: die Hauptgedanken
 * der Reihe nach, darunter Zitate, Beispiele, Fragen, Anwendungen — die
 * Quellen so, wie sie im Text stehen (`[@klucz, s. 12]`).
 */
export function planPrompt(text: LibEntry): string {
  const d = text.data;
  const example = {
    format: 'recreatio/scriptorium',
    version: 1,
    entries: [{
      id: text.id,
      kind: 'text',
      data: {
        plan: [
          { text: 'Pierwsza główna myśl.', depth: 0 },
          { text: 'Cytat albo odwołanie, jak w tekście [@klucz, s. 12].', depth: 1, kind: 'quote' },
          { text: 'Przykład z życia.', depth: 1, kind: 'example' },
          { text: 'Co z tego wynika dla słuchacza?', depth: 0, kind: 'question' }
        ]
      }
    }]
  };
  return `Poniżej jest tekst kazania „${str(d, 'title') || 'Bez tytułu'}”. Zrób z niego plan: główne myśli po kolei, a pod każdą — cytaty, przykłady, pytania, zastosowania.

Zasady:
- Jeden punkt — jedna myśl, jedno-dwa zdania, po polsku, w kolejności tekstu.
- "depth": 0 — główna myśl, 1 — pod nią, 2 — jeszcze głębiej.
- "kind": "thought" (myśl), "quote" (cytat), "example" (przykład), "question" (pytanie), "application" (zastosowanie).
- Odwołania do źródeł przepisz dokładnie tak, jak stoją w tekście: [@klucz, miejsce] albo ![@klucz-cytatu]. Nie wymyślaj nowych kluczy.
- Nie dodawaj niczego, czego nie ma w tekście.

Jak aplikacja używa tych danych:
- Plan trafia do formularza tego tekstu i zastępuje obecny; każdy punkt dostaje stały identyfikator.
- Wygłoszenia oznaczają punkty po identyfikatorach: powiedziany, tylko wspomniany, pominięty — z czasem w nagraniu. Oznaczenia zapisane do poprzedniego planu zostają przy wygłoszeniu, a jego formularz ostrzega, że tych punktów nie ma już w planie (można je usunąć).
- Plan stoi przed treścią tekstu — w Skryptorium, na stronach i w druku (także sam, jako „Plan na ambonę”); [@klucz, miejsce] w punkcie staje się przypisem.

Tekst:
---
${str(d, 'body')}
---

Zwróć JEDEN obiekt JSON, bez komentarzy ("id" i "kind" zostaw takie, jakie są; obecny plan zostanie zastąpiony):
${JSON.stringify(example, null, 2)}
`;
}
