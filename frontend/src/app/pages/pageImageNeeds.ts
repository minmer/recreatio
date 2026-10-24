/**
 * 2026-10-24 — DATEIEN, UM DIE EIN DOKUMENT DER SEITE BITTET ("images").
 *
 * Ein Dokument (oft von einem Sprachmodell geschrieben) kann sagen: hier
 * gehört ein Foto hin, das es noch nicht gibt — und beschreiben, was es zeigen
 * soll. An der Stelle steht dann statt `page-image:<id>` ein Platzhalter
 * `page-image:@schlüssel`. Vor dem Import legt der Mensch zu jeder
 * Beschreibung eine Datei (oder wählt eine, die die Seite schon hat); der
 * Import lädt sie hoch und setzt sie ÜBERALL ein, wo der Platzhalter steht.
 *
 * <b>Das ganze Dokument, nicht Feld für Feld.</b> Bilder stehen an Dutzenden
 * Stellen — Obraz, Galeria, Osoby, Pliki, Schichten, Szenen, Klang, Menü. Eine
 * Liste dieser Felder liefe ihnen hinterher; der Platzhalter ist eindeutig
 * genug, um ihn in jeder Zeichenkette zu ersetzen.
 *
 * <b>Erst einsetzen, dann planen.</b> Die Leser des Imports verwerfen, was
 * kein Bild sein kann (ein Logo `page-image:@dom` wäre keines). Deshalb wird
 * vor dem Plan eingesetzt — für die Vorschau ein Platzhalter in der Gestalt
 * einer Datei (`PREVIEW_REF`), beim Import die echte Kennung. Was ohne Datei
 * bleibt, wird leer: der Baustein steht ohne Bild da, und der Import sagt es.
 *
 * Rein, ohne Browser — `app-json-check` prüft es.
 */

import { FILE_ACCEPT, FILE_TYPES, IMAGE_TYPES, isAudioType, isImageType, isMediaType, isVideoType, MAX_FILE_BYTES, MAX_IMAGE_BYTES, MAX_MEDIA_BYTES, mediaAccept } from './pageImages';

/** So beginnt ein Platzhalter; dahinter steht der Schlüssel. */
export const NEED_PREFIX = 'page-image:@';

const TOKEN = /page-image:@([A-Za-z0-9][A-Za-z0-9_-]{0,59})/g;
const KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/;

/** Mehr Dateien erbittet keine Seite — mehr wäre ein Archiv. */
export const MAX_NEEDS = 60;

/** Was für eine Datei: ein Bild (gewöhnlich), ein Film, ein Klang, ein Dokument. */
export type NeedKind = 'image' | 'video' | 'sound' | 'file';
export const NEED_KINDS: readonly NeedKind[] = ['image', 'video', 'sound', 'file'];

/** Ein Platzhalter ohne Beschreibung: welche Art, weiss niemand — jede Datei der Seite passt. */
export type NeedFit = NeedKind | 'any';

export interface ImageNeed {
  readonly key: string;
  /** Wie der Mensch sie sieht — ohne eigenen der Schlüssel. */
  readonly label: string;
  /** Was die Datei zeigen soll (leer: ohne Beschreibung). */
  readonly description: string;
  /** Der Dateiname, wenn das Dokument ihn kennt: Dateien dieses Namens ordnen sich selbst zu. */
  readonly name: string | null;
  readonly kind: NeedFit;
  /** An so vielen Stellen des Dokuments steht der Platzhalter. */
  readonly uses: number;
  /** In "images" beschrieben — sonst nur benutzt. */
  readonly declared: boolean;
}

export interface NeedsPlan {
  readonly needs: readonly ImageNeed[];
  readonly warnings: readonly string[];
}

/**
 * Für die Vorschau: sieht aus wie eine Datei der Seite (eine Kennung in voller
 * Gestalt), damit kein Leser des Imports das Bild verwirft — gespeichert wird
 * sie nie.
 */
export const PREVIEW_REF = 'page-image:00000000-0000-4000-8000-000000000000';

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Die Platzhalter in allem, was das Dokument trägt — ausser den Beschreibungen selbst. */
function countUses(value: unknown, into: Map<string, number>, depth: number): void {
  if (typeof value === 'string') {
    if (!value.includes(NEED_PREFIX)) return;
    for (const hit of value.matchAll(TOKEN)) into.set(hit[1], (into.get(hit[1]) ?? 0) + 1);
    return;
  }
  if (depth > 64 || value === null || typeof value !== 'object') return;
  for (const one of Array.isArray(value) ? value : Object.values(value)) countUses(one, into, depth + 1);
}

/** Dasselbe Dokument liest die Vorschau bei jedem Zeichnen — einmal genügt. */
const read = new WeakMap<object, NeedsPlan | null>();

/**
 * Die Dateien, um die ein Dokument bittet — beschriebene und solche, die nur
 * benutzt werden. `undefined`: es bittet um keine.
 */
export function readImageNeeds(doc: unknown): NeedsPlan | undefined {
  if (doc === null || typeof doc !== 'object') return undefined;
  const known = read.get(doc);
  if (known !== undefined) return known ?? undefined;

  const root = record(doc);
  const uses = new Map<string, number>();
  for (const [key, one] of Object.entries(root)) if (key !== 'images') countUses(one, uses, 1);

  const said = root.images;
  if ((said === undefined || said === null) && uses.size === 0) {
    read.set(doc, null);
    return undefined;
  }

  const warnings: string[] = [];
  const needs: ImageNeed[] = [];
  const seen = new Set<string>();
  if (said !== undefined && said !== null && !Array.isArray(said)) warnings.push('"images" to nie lista — opisy plików pominięte.');

  (Array.isArray(said) ? said : []).forEach((raw, i) => {
    const one = record(raw);
    const key = text(one.key).trim();
    if (!KEY.test(key)) {
      warnings.push(`Plik ${i + 1} w "images": "key" „${key}” — tylko litery, cyfry, - i _ (do 60 znaków); pominięty.`);
      return;
    }
    if (seen.has(key)) {
      warnings.push(`„${key}” jest opisany w "images" dwa razy — liczy się pierwszy opis.`);
      return;
    }
    if (needs.length >= MAX_NEEDS) {
      if (needs.length === MAX_NEEDS) warnings.push(`Więcej niż ${MAX_NEEDS} plików w "images" — dalsze pominięte.`);
      return;
    }
    seen.add(key);
    const kindSaid = text(one.kind).trim().toLowerCase();
    const kind: NeedKind = (NEED_KINDS as readonly string[]).includes(kindSaid) ? kindSaid as NeedKind : 'image';
    if (kindSaid !== '' && kind !== kindSaid) warnings.push(`„${key}”: "kind" „${kindSaid}” — dozwolone: ${NEED_KINDS.join(', ')}; będzie "image".`);
    const count = uses.get(key) ?? 0;
    if (count === 0) warnings.push(`„${key}” jest opisany w "images", ale nic go nie używa (brak "${NEED_PREFIX}${key}") — można go pominąć.`);
    needs.push({
      key,
      label: text(one.label).trim() || key,
      description: text(one.description).trim(),
      name: text(one.name).trim() || null,
      kind,
      uses: count,
      declared: true
    });
  });

  for (const [key, count] of uses) {
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push(`„${NEED_PREFIX}${key}” nie ma opisu w "images" — plik i tak można dodać.`);
    needs.push({ key, label: key, description: '', name: null, kind: 'any', uses: count, declared: false });
  }

  /* Eine leere Liste ohne Platzhalter bittet um nichts. */
  const plan = needs.length === 0 && warnings.length === 0 ? null : { needs, warnings };
  read.set(doc, plan);
  return plan ?? undefined;
}

/**
 * DIE PLATZHALTER ERSETZEN — im ganzen Dokument, ausser in den Beschreibungen.
 * `refs`: Schlüssel → `page-image:<id>`. Was dort fehlt, wird leer und steht in
 * `missing`; `placed` zählt die eingesetzten Stellen.
 */
export function resolveImageNeeds(doc: unknown, refs: ReadonlyMap<string, string>): { doc: unknown; placed: number; missing: readonly string[] } {
  const missing = new Set<string>();
  let placed = 0;

  const swap = (value: string): string => value.replace(TOKEN, (_whole, key: string) => {
    const ref = refs.get(key);
    if (ref === undefined) {
      missing.add(key);
      return '';
    }
    placed += 1;
    return ref;
  });

  const walk = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return value.includes(NEED_PREFIX) ? swap(value) : value;
    if (depth > 64 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((one) => walk(one, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, one] of Object.entries(value)) out[key] = depth === 0 && key === 'images' ? one : walk(one, depth + 1);
    return out;
  };

  return { doc: walk(doc, 0), placed, missing: [...missing] };
}

/** Für die Vorschau: jede gewählte Datei als `PREVIEW_REF`, jede fehlende leer — wie es der Import tun wird. */
export function previewImageNeeds(doc: unknown, chosen: ReadonlySet<string>): unknown {
  const needs = readImageNeeds(doc);
  if (needs === undefined) return doc;
  return resolveImageNeeds(doc, new Map(needs.needs.filter((n) => chosen.has(n.key)).map((n) => [n.key, PREVIEW_REF] as const))).doc;
}

/* -- Welche Datei passt ---------------------------------------------------------------- */

const DOCUMENTS: readonly string[] = Object.values(FILE_TYPES);

/** Passt eine Datei dieser Art (`content type`) zu dem, worum gebeten wird? */
export function fitsNeed(kind: NeedFit, type: string): boolean {
  switch (kind) {
    case 'image': return isImageType(type);
    case 'video': return isVideoType(type);
    case 'sound': return isAudioType(type);
    case 'file': return DOCUMENTS.includes(type) || isImageType(type);
    default: return isImageType(type) || isMediaType(type) || DOCUMENTS.includes(type);
  }
}

/** Warum eine Datei nicht passt, in Worten — `null`: sie passt. `type` wie `typeOfFile` ihn sagt. */
export function fileProblem(kind: NeedFit, type: string | null, bytes: number): string | null {
  if (type === null || !fitsNeed(kind, type)) {
    switch (kind) {
      case 'image': return 'To nie obraz — potrzebny JPEG, PNG, WebP, GIF albo AVIF.';
      case 'video': return 'To nie film — potrzebny MP4 albo WebM.';
      case 'sound': return 'To nie dźwięk — potrzebny MP3, M4A, OGG albo WAV.';
      case 'file': return 'Tego pliku strona nie przyjmie — PDF, Word, Excel, PowerPoint, OpenDocument, GPX albo obraz.';
      default: return 'Tego pliku strona nie przyjmie — obraz, film, dźwięk, PDF, dokument albo GPX.';
    }
  }
  if (isImageType(type)) return bytes > MAX_IMAGE_BYTES ? 'Obraz może mieć najwyżej 8 MB.' : null;
  if (isMediaType(type)) return bytes > MAX_MEDIA_BYTES ? 'Film albo dźwięk może mieć najwyżej 30 MB.' : null;
  return bytes > MAX_FILE_BYTES ? 'Plik może mieć najwyżej 25 MB.' : null;
}

/** Was der Dateidialog anbietet. */
export function acceptOf(kind: NeedFit): string {
  switch (kind) {
    case 'image': return IMAGE_TYPES.join(',');
    case 'video': return mediaAccept('video');
    case 'sound': return mediaAccept('audio');
    case 'file': return `${FILE_ACCEPT},image/*`;
    default: return `image/*,${FILE_ACCEPT},${mediaAccept('video')},${mediaAccept('audio')}`;
  }
}

const bare = (name: string): string => name.trim().toLowerCase().replace(/\.[a-z0-9]{1,5}$/i, '');

/**
 * MEHRERE DATEIEN AUF EINMAL: welche zu welcher Bitte. Zuerst der genannte
 * Dateiname (gleich, ohne Gross und Klein), dann derselbe Name ohne Endung,
 * zuletzt der Schlüssel als Name. Jede Bitte nimmt höchstens eine; was übrig
 * bleibt, ordnet der Mensch zu (`rest`, Stellen in `names`).
 */
export function matchFiles(needs: readonly ImageNeed[], names: readonly string[]): { byKey: Map<string, number>; rest: number[] } {
  const byKey = new Map<string, number>();
  const used = new Set<number>();
  const rounds: ((need: ImageNeed, name: string) => boolean)[] = [
    (need, name) => need.name !== null && need.name.toLowerCase() === name.trim().toLowerCase(),
    (need, name) => need.name !== null && bare(need.name) === bare(name),
    (need, name) => need.key.toLowerCase() === bare(name)
  ];
  for (const fits of rounds) {
    names.forEach((name, i) => {
      if (used.has(i)) return;
      const need = needs.find((one) => !byKey.has(one.key) && fits(one, name));
      if (need === undefined) return;
      byKey.set(need.key, i);
      used.add(i);
    });
  }
  return { byKey, rest: names.map((_, i) => i).filter((i) => !used.has(i)) };
}
