/**
 * DIE OFFENE BIBLIOTHEK IM BROWSER (0064).
 *
 * <b>Alles, was der Dienst nicht kann, geschieht hier:</b> öffnen, suchen,
 * Verweise und Rückverweise („wo wird dieses Zitat genannt?"), Schlüssel
 * eindeutig machen, und vor dem Veröffentlichen ausrechnen, was mitgeht.
 * Der Dienst gleicht nur ab — dieser Speicher holt beim zweiten Mal bloss,
 * was sich seither geändert hat.
 *
 * Ein Speicher je Bibliothek und Tab, über Ansichten hinweg: wer von der
 * Liste in einen Eintrag und zurück geht, lädt nicht neu.
 */

import { useEffect, useState } from 'react';

import { areaKeys, newestKey } from '../chat/chat';
import { idbDelete, idbForget, idbGet, idbPut } from '../core/idb';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import {
  forgetLibraryNames, loadEntries, loadLibraries, moveEntry, openedLibraryKind, openEntry, openLibraries, putEntry, removeEntries, removeEntry, sealEntry, withdrawEntries,
  type EntryDoc, type LibraryRow, type PublishedAs, type SealedEntry
} from './library';
import { originOf } from './libraryCite';
import {
  ALIASES, aliasesOf, entryTitle, fieldRefs, kindOf, mapMarkups, markupsOf, nextAliases, refTarget, storedMarkup, suggestKey, uniqueKey,
  type EntryData, type LibEntry, type Lookup
} from './libraryKinds';
import { citedKeys, mapRefTokens } from './libraryMarkup';
import { WorkspaceError } from '../core/session';

export interface Entry extends LibEntry {
  /** 2026-10-22 — die Bibliothek (und damit der Bereich), in der er liegt. */
  readonly libraryId: string;
  readonly key?: string;
  readonly version: number;
  readonly epoch: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  /** Eine alte offene Fassung (bis 2026-10-22) — nur noch, damit „Wycofaj stare kopie" sie zurückzieht. */
  readonly publishedAs: PublishedAs | null;
}

/** Was gespeichert wird: ohne Kennung ein neuer Eintrag. */
export interface SaveInput {
  readonly id?: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
}

/** Leere Werte fallen weg — ein Eintrag trägt nur, was gesagt ist. */
export function cleanData(data: EntryData): EntryData {
  const out: EntryData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = typeof value === 'string' ? value.replace(/\s+$/, '') : value;
  }
  return out;
}

const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/*
 * 0109 — DIE VERSIEGELTE ABSCHRIFT EINER BIBLIOTHEK im Browser [N2]. Eine
 * grosse Bibliothek (bis 50 000 Einträge) lädt beim zweiten Öffnen nur, was
 * sich seither geändert hat — auch nach einem Neustart. Abgelegt werden die
 * Hüllen, wie der Dienst sie schickt: zu öffnen nur mit dem Schlüssel des
 * Bereichs. Im strengen Betrieb (der Schlüssel lebt nur im Tab) und nach der
 * Abmeldung liegt nichts.
 */
let cacheOn = false;

/** Ob Abschriften abgelegt werden dürfen — `kept`: ja, `tab` oder niemand: nein. */
export function setLibraryCache(on: boolean): void {
  cacheOn = on;
}

interface Cached {
  readonly v: 1;
  readonly since: string;
  readonly rows: readonly SealedEntry[];
}

const cacheKey = (libraryId: string) => `entries:${libraryId}`;

/**
 * 2026-10-22 — ALLE LESBAREN BIBLIOTHEKEN ZUSAMMEN. Jeder Bereich hat seine
 * Bibliothek; wer mehrere lesen darf, arbeitet mit allen zugleich: ein
 * Verweis, ein Zitat im Text, die Suche und die Rückverweise reichen über
 * die Bibliothek hinaus, in der man gerade steht. Gelistet und geschrieben
 * wird weiter je Bibliothek (`all`, `ofKind`, `save` — der eigene Bereich).
 * Die Nachbarn sind die anderen offenen Speicher derselben Art: die des
 * Kontos im Arbeitsbereich, die einer Seite auf der Seite (`setPeers`).
 */
const bus = new Set<LibraryStore>();

export class LibraryStore implements Lookup {
  readonly libraryId: string;
  readonly areaId: string;
  /** `null`: ein Speicher ohne Konto (`readOnlyStore`) — er liest nur, und er legt keine Abschrift ab. */
  private readonly ring: Ring | null;
  private readonly entries = new Map<string, Entry>();
  private readonly keys = new Map<string, string>();
  /** 2026-10-22 — alte Schlüssel (`_aliases`): ein Text mit einem alten Schlüssel findet den Eintrag weiter. */
  private readonly aliases = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private since: string | null = null;
  private syncing: Promise<void> | null = null;
  private backIndex: Map<string, Set<string>> | null = null;
  private searchIndex: Map<string, string> | null = null;
  /** Die Hüllen, wie sie kamen — für die Abschrift (nur, wenn sie abgelegt werden darf). */
  private readonly sealedRows = new Map<string, SealedEntry>();
  private cacheWrite: number | null = null;

  /** Einträge, deren Hülle sich hier nicht öffnen lässt (Schlüssel einer fremden Epoche). */
  unreadable = 0;
  revision = 0;
  loaded = false;

  constructor(ring: Ring | null, library: Pick<LibraryRow, 'libraryId' | 'areaId'>) {
    this.ring = ring;
    this.libraryId = library.libraryId;
    this.areaId = library.areaId;
    bus.add(this);
  }

  /* -- Die Nachbarn ----------------------------------------------------------------------- */

  private peerSource: (() => readonly LibraryStore[]) | null = null;

  /** Wer die Nachbarn sind, wenn es nicht die Speicher des Kontos sind (eine Seite). */
  setPeers(source: () => readonly LibraryStore[]): void {
    this.peerSource = source;
  }

  /**
   * Die anderen lesbaren Behälter, durch die Verweise und Schlüssel gehen:
   * eine Bibliothek sieht Bibliotheken (Quellen zeigen nur auf Quellen); ein
   * Skryptorium (2026-10-23) Bibliotheken und andere Skryptoria — ein Text
   * zitiert aus der Bibliothek, ein Wygłoszenie nennt einen Text, der in ein
   * öffentliches Skryptorium gezogen ist. Bazy wiedzy nie (`bases`).
   */
  peers(): LibraryStore[] {
    if (this.peerSource !== null) return this.peerSource().filter((s) => s !== this && s.loaded);
    const mine = openedLibraryKind(this.libraryId);
    if (this.ring === null || (mine !== 'books' && mine !== 'writing')) return [];
    const wanted = (kind: string | undefined) => kind === 'books' || (mine === 'writing' && kind === 'writing');
    return [...stores.values()].filter((s) => s !== this && s.loaded && wanted(openedLibraryKind(s.libraryId)));
  }

  /** Ein Nachbar hat sich geändert: neu zeichnen, die Verzeichnisse neu bauen — nicht weitersagen. */
  private peerChanged(): void {
    this.revision += 1;
    this.backIndex = null;
    for (const listener of this.listeners) listener();
  }

  /** Nur hier, ohne Nachbarn. */
  own(id: string): Entry | undefined { return this.entries.get(id); }

  ownByKey(key: string): Entry | undefined {
    const id = this.keys.get(key.toLowerCase()) ?? this.aliases.get(key.toLowerCase());
    return id === undefined ? undefined : this.entries.get(id);
  }

  /** In welcher Bibliothek ein Eintrag liegt — diese oder ein Nachbar. */
  homeOf(id: string): LibraryStore | undefined {
    if (this.entries.has(id)) return this;
    return this.peers().find((p) => p.own(id) !== undefined);
  }

  /** Alles Lesbare: hier und bei den Nachbarn. */
  readable(): Entry[] {
    return [...this.all(), ...this.peers().flatMap((p) => p.all())];
  }

  /* -- Lesen ------------------------------------------------------------------------------- */

  get(id: string): Entry | undefined {
    const here = this.entries.get(id);
    if (here !== undefined) return here;
    for (const peer of this.peers()) { const there = peer.own(id); if (there !== undefined) return there; }
    /* 2026-10-22 (Schritt 11) — ein Słowo, ein Widok einer Baza wiedzy, auf die ein Kazanie verweist: über die Kennung (Schlüssel gelten nur unter Bibliotheken). */
    for (const base of this.bases()) { const there = base.own(id); if (there !== undefined) return there; }
    return undefined;
  }

  /** 2026-10-22 (Schritt 11) — die geöffneten Bazy wiedzy des Kontos (eine Seite hat sie schon unter ihren Nachbarn). */
  private bases(): LibraryStore[] {
    if (this.peerSource !== null || this.ring === null) return [];
    return [...stores.values()].filter((s) => s !== this && s.loaded && openedLibraryKind(s.libraryId) === 'knowledge');
  }

  /** Ein Schlüssel gilt zuerst hier, dann bei den Nachbarn (in einer Bibliothek ist er eindeutig, über sie hinweg nicht). */
  byKey(key: string): Entry | undefined {
    const here = this.ownByKey(key);
    if (here !== undefined) return here;
    for (const peer of this.peers()) { const there = peer.ownByKey(key); if (there !== undefined) return there; }
    return undefined;
  }

  all(): Entry[] { return [...this.entries.values()]; }

  ofKind(kind: string): Entry[] { return this.all().filter((e) => e.kind === kind); }

  title(entry: LibEntry): string { return entryTitle(entry, this); }

  /** In dieser Bibliothek vergeben — als Schlüssel oder als alter Schlüssel eines anderen Eintrags. */
  keyTaken(key: string, except?: string): boolean {
    const id = this.keys.get(key.toLowerCase()) ?? this.aliases.get(key.toLowerCase());
    return id !== undefined && id !== except;
  }

  /**
   * 2026-10-22 — derselbe Schlüssel in einer anderen lesbaren Bibliothek: kein
   * Fehler (Texte halten Kennungen), aber eine Warnung beim Vergeben. Bibliotheken,
   * die ich nicht lesen kann, werden nie gefragt.
   */
  keyTakenElsewhere(key: string, except?: string): LibraryStore | undefined {
    return this.peers().find((p) => p.keyTaken(key, except));
  }

  /**
   * 2026-10-22 — ALLES ÖFFNEN, WAS DIESES KONTO LESEN DARF: jede Bibliothek und
   * jede Baza wiedzy, für das Verzeichnis der Verweise (`refIndex.ts`) und
   * die Suche nach einer Stelle der Schrift. Ein Speicher ohne Konto öffnet
   * nichts. Es kommt nur dazu, was ohnehin lesbar ist.
   */
  async openEverything(): Promise<number> {
    if (this.ring === null) return 0;
    const ring = this.ring;
    const opened = await openLibraries(ring, (await loadLibraries()).libraries);
    await Promise.all(opened.map((row) => storeOf(ring, row).sync().catch(() => undefined)));
    return opened.length;
  }

  /** Wer auf einen Eintrag zeigt — hier und in den Nachbarn. */
  backlinks(id: string): Entry[] {
    return [...this.ownBacklinks(id), ...this.peers().flatMap((p) => p.ownBacklinks(id))];
  }

  /** Wer hier auf einen Eintrag zeigt — über ein Feld oder einen Verweis im Text. */
  ownBacklinks(id: string): Entry[] {
    if (this.backIndex === null) {
      const index = new Map<string, Set<string>>();
      const add = (target: string, source: string) => {
        if (target === source) return;
        let set = index.get(target);
        if (set === undefined) { set = new Set(); index.set(target, set); }
        set.add(source);
      };
      for (const entry of this.entries.values()) {
        for (const ref of fieldRefs(entry)) add(ref, entry.id);
        /* 2026-10-21 — auch der Zapis in Unterfeldern: ein Zitat im Plan einer Predigt. */
        for (const key of citedKeys(...markupsOf(entry))) {
          const target = refTarget(this, key);
          if (target !== undefined) add(target.id, entry.id);
        }
      }
      this.backIndex = index;
    }
    return [...(this.backIndex.get(id) ?? [])].map((one) => this.entries.get(one)).filter((e): e is Entry => e !== undefined);
  }

  /** Suchen — hier zuerst, dann in den Nachbarn. */
  search(query: string, kinds?: readonly string[]): Entry[] {
    return [...this.ownSearch(query, kinds), ...this.peers().flatMap((p) => p.ownSearch(query, kinds))];
  }

  /** Suchen — in Titel, Schlüssel und allen Textfeldern, ohne Rücksicht auf Akzente. */
  ownSearch(query: string, kinds?: readonly string[]): Entry[] {
    if (this.searchIndex === null) {
      const index = new Map<string, string>();
      for (const entry of this.entries.values()) {
        const parts = [this.title(entry), entry.key ?? ''];
        for (const value of Object.values(entry.data)) {
          if (typeof value === 'string') parts.push(value);
          /* 2026-10-21 — die Punkte eines Plans, die Zeilen eines Wygłoszenia. */
          else if (Array.isArray(value)) for (const item of value) if (typeof item === 'object' && item !== null) for (const one of Object.values(item)) if (typeof one === 'string') parts.push(one);
        }
        if (entry.kind === 'quote') parts.push(originOf(entry, this));
        if (entry.kind === 'work') for (const id of fieldRefs(entry)) { const p = this.get(id); if (p !== undefined) parts.push(this.title(p)); }
        index.set(entry.id, fold(parts.join(' ')));
      }
      this.searchIndex = index;
    }
    const words = fold(query).split(/\s+/).filter(Boolean);
    return this.all().filter((entry) => (kinds === undefined || kinds.includes(entry.kind))
      && words.every((w) => (this.searchIndex!.get(entry.id) ?? '').includes(w)));
  }

  /* -- Abgleich --------------------------------------------------------------------------- */

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private changed(): void {
    this.revision += 1;
    this.backIndex = null;
    this.searchIndex = null;
    for (const listener of this.listeners) listener();
    for (const other of bus) if (other !== this) other.peerChanged();
  }

  private put(entry: Entry): void {
    const before = this.entries.get(entry.id);
    if (before !== undefined) this.unindex(before);
    this.entries.set(entry.id, entry);
    if (entry.key !== undefined) this.keys.set(entry.key.toLowerCase(), entry.id);
    for (const alias of aliasesOf(entry.data)) if (!this.aliases.has(alias.toLowerCase())) this.aliases.set(alias.toLowerCase(), entry.id);
  }

  private unindex(entry: Entry): void {
    if (entry.key !== undefined && this.keys.get(entry.key.toLowerCase()) === entry.id) this.keys.delete(entry.key.toLowerCase());
    for (const alias of aliasesOf(entry.data)) if (this.aliases.get(alias.toLowerCase()) === entry.id) this.aliases.delete(alias.toLowerCase());
  }

  private drop(id: string): void {
    const before = this.entries.get(id);
    if (before !== undefined) this.unindex(before);
    this.entries.delete(id);
  }

  /** 0109 — woher die Schlüssel kommen, wenn kein Konto liest (ein Link, ein Platz: `areaReader`). */
  private keySource: ((areaId: string, epochs: readonly number[]) => Promise<ReadonlyMap<number, Uint8Array>>) | null = null;

  useKeys(source: (areaId: string, epochs: readonly number[]) => Promise<ReadonlyMap<number, Uint8Array>>): void {
    this.keySource = source;
  }

  private async keysFor(epochs: Iterable<number>): Promise<ReadonlyMap<number, Uint8Array>> {
    if (this.keySource !== null) return this.keySource(this.areaId, [...new Set(epochs)]);
    if (this.ring === null) return new Map();
    let keys = await areaKeys(this.ring, this.areaId);
    if ([...epochs].some((e) => !keys.has(e))) keys = await areaKeys(this.ring, this.areaId, true);
    return keys;
  }

  /** Ob dieser Speicher eine Abschrift auf dem Gerät halten darf — nur der eines Kontos, und nur bei `kept`. */
  private get copies(): boolean {
    return cacheOn && this.ring !== null;
  }

  private async absorb(rows: readonly SealedEntry[]): Promise<void> {
    const keys = await this.keysFor(rows.filter((r) => r.sealed !== null).map((r) => r.epoch));
    let unreadable = 0;
    for (const row of rows) {
      if (this.copies) {
        if (row.deletedAt !== null) this.sealedRows.delete(row.entryId);
        else this.sealedRows.set(row.entryId, row);
      }
      if (row.deletedAt !== null) { this.drop(row.entryId); continue; }
      const doc = await openEntry(keys, row);
      if (doc === null) { unreadable += 1; continue; }
      this.put({
        libraryId: this.libraryId, id: doc.id, kind: doc.kind, ...(doc.key === undefined ? {} : { key: doc.key }), data: doc.data,
        version: row.version, epoch: row.epoch, createdAt: row.createdAt, updatedAt: row.updatedAt,
        publishedAt: row.publishedAt, publishedAs: row.publishedAs
      });
    }
    this.unreadable = this.since === null ? unreadable : this.unreadable + unreadable;
  }

  /**
   * Woher die Hüllen kommen — der Weg eines Kontos oder Links; ein Platz
   * (`/seat/…/library`) setzt seinen eigenen (`readVia`).
   */
  private source: (since: string | null) => Promise<{ now: string; entries: readonly SealedEntry[] }> =
    (since) => loadEntries(this.libraryId, since);

  /** 0109 — die Hüllen über einen anderen Weg holen (ein Platz ohne Konto). */
  readVia(source: (since: string | null) => Promise<{ now: string; entries: readonly SealedEntry[] }>): void {
    this.source = source;
  }

  /** Holen, was sich geändert hat — beim ersten Mal alles. Gleichzeitige Aufrufe teilen sich einen Gang. */
  sync(): Promise<void> {
    if (this.syncing !== null) return this.syncing;
    this.syncing = (async () => {
      try {
        /* 0109 — zuerst die Abschrift, dann nur, was seither geschah. */
        if (this.since === null && this.copies) {
          const cached = await idbGet<Cached>('library', cacheKey(this.libraryId));
          if (cached !== null && cached.v === 1 && Array.isArray(cached.rows) && typeof cached.since === 'string') {
            await this.absorb(cached.rows);
            this.since = cached.since;
            this.loaded = true;
            this.changed();
          }
        }
        const { now, entries } = await this.source(this.since);
        await this.absorb(entries);
        this.since = now;
        this.loaded = true;
        this.changed();
        this.keepCopy();
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  /** Die Abschrift schreiben — einmal kurz nach dem letzten Abgleich, nicht bei jedem. */
  private keepCopy(): void {
    if (!this.copies || typeof window === 'undefined' || this.since === null) return;
    if (this.cacheWrite !== null) window.clearTimeout(this.cacheWrite);
    this.cacheWrite = window.setTimeout(() => {
      this.cacheWrite = null;
      if (!this.copies || this.since === null) return;
      const doc: Cached = { v: 1, since: this.since, rows: [...this.sealedRows.values()] };
      void idbPut('library', cacheKey(this.libraryId), doc);
    }, 1500);
  }

  /** Die Abschrift dieser Bibliothek wegwerfen (sie wurde gelöscht). */
  dropCopy(): void {
    void idbDelete('library', cacheKey(this.libraryId));
  }

  /* -- Schreiben -------------------------------------------------------------------------- */

  /**
   * Ein Schlüssel für diesen Eintrag: der gewünschte (eindeutig in der
   * Bibliothek; in einer anderen lesbaren nur gewarnt), sonst ein Vorschlag,
   * der in KEINER lesbaren Bibliothek vergeben ist (2026-10-22).
   */
  keyFor(entry: LibEntry, wanted?: string): string | undefined {
    if (kindOf(entry.kind)?.keyed !== true) return undefined;
    if ((wanted ?? '').trim() !== '') return uniqueKey(wanted!.trim(), (key) => this.keyTaken(key, entry.id));
    return uniqueKey(suggestKey(entry, this), (key) => this.keyTaken(key, entry.id) || this.keyTakenElsewhere(key, entry.id) !== undefined);
  }

  /**
   * SPEICHERN — versiegelt unter dem jüngsten Schlüssel des Bereichs. Hat
   * inzwischen jemand anderes geändert, lehnt der Dienst ab (`stale`); dann
   * wird abgeglichen, und der Editor zeigt den neueren Stand.
   */
  async save(input: SaveInput): Promise<Entry> {
    const newest = await this.writeKey();
    try {
      const entry = await this.write(input, newest);
      this.changed();
      return entry;
    } catch (e) {
      if (e instanceof WorkspaceError && e.verdict === 'stale') await this.sync().catch(() => undefined);
      throw e;
    }
  }

  /**
   * 2026-10-17 — VIELE AUF EINMAL (ein Formularz dodawania, eine eingefügte
   * Liste): der Schlüssel einmal, einige Anfragen zugleich unterwegs, die
   * Ansichten nur ab und zu neu. Was scheitert, steht in `failed`; der Rest
   * ist gespeichert. Ein `stale` gleicht danach einmal ab.
   */
  async saveMany(inputs: readonly SaveInput[], progress?: (done: number, total: number) => void, parallel = 4): Promise<{ saved: Entry[]; failed: { id: string; error: string }[] }> {
    if (inputs.length === 0) return { saved: [], failed: [] };
    const newest = await this.writeKey();
    const saved: Entry[] = [];
    const failed: { id: string; error: string }[] = [];
    let next = 0;
    let done = 0;
    let stale = false;
    const worker = async () => {
      while (next < inputs.length) {
        const input = inputs[next++];
        try {
          saved.push(await this.write(input, newest));
        } catch (e) {
          if (e instanceof WorkspaceError && e.verdict === 'stale') stale = true;
          failed.push({ id: input.id ?? '', error: e instanceof Error && e.message !== '' ? e.message : 'Nie udało się zapisać.' });
        }
        done += 1;
        progress?.(done, inputs.length);
        if (done % 25 === 0) this.changed();
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, inputs.length) }, worker));
    this.changed();
    if (stale) await this.sync().catch(() => undefined);
    return { saved, failed };
  }

  private async writeKey(): Promise<{ epoch: number; key: Uint8Array }> {
    if (this.ring === null) throw new WorkspaceError('Tę bibliotekę można tu tylko czytać.');
    const newest = newestKey(await areaKeys(this.ring, this.areaId, true));
    if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
    return newest;
  }

  /** Versiegeln und schreiben — der Speicher kennt den Eintrag danach; wer zeichnet, erfährt es über `changed()`. */
  private async write(input: SaveInput, newest: { epoch: number; key: Uint8Array }): Promise<Entry> {
    const id = input.id ?? newId();
    const before = this.entries.get(id);
    if (before === undefined && this.get(id) !== undefined) throw new WorkspaceError('Ten wpis należy do innej biblioteki — zmień go tam.');
    /* 2026-10-22 — im Speicher stehen Kennungen: ein Schlüssel im Zapis, der aufgeht, wird die Kennung seines Eintrags. */
    const data: EntryData = { ...storedMarkup(input.kind, cleanData(input.data), this) };
    const key = this.keyFor({ id, kind: input.kind, data }, input.key ?? before?.key);
    /* Der bisherige Schlüssel bleibt als alter Schlüssel — ein Text, der ihn noch nennt, findet den Eintrag weiter. */
    const aliases = nextAliases(before?.key, key, [...aliasesOf(before?.data ?? {}), ...aliasesOf(data)]);
    if (aliases.length > 0) data[ALIASES] = aliases; else delete data[ALIASES];
    const doc: EntryDoc = { v: 1, id, kind: input.kind, ...(key === undefined ? {} : { key }), data };
    const done = await putEntry(this.libraryId, id, {
      kind: input.kind, epoch: newest.epoch, sealed: await sealEntry(newest.key, doc), version: before?.version ?? 0
    });
    const entry: Entry = {
      libraryId: this.libraryId, id, kind: input.kind, ...(key === undefined ? {} : { key }), data,
      version: done.version, epoch: newest.epoch, createdAt: before?.createdAt ?? done.updatedAt, updatedAt: done.updatedAt,
      publishedAt: before?.publishedAt ?? null, publishedAs: before?.publishedAs ?? null
    };
    this.put(entry);
    return entry;
  }

  async remove(id: string): Promise<void> {
    await removeEntry(this.libraryId, id);
    this.drop(id);
    this.changed();
  }

  /**
   * 2026-10-23 — VIELE AUF EINMAL LÖSCHEN (Zaznaczone → Usuń, „Stare wpisy"):
   * nur eigene Einträge, in Paketen zu 200. Was danach noch da ist, gleicht
   * der nächste Abgleich ab.
   */
  async removeMany(ids: readonly string[], progress?: (done: number, total: number) => void): Promise<number> {
    const own = ids.filter((id) => this.entries.has(id));
    let done = 0;
    for (let at = 0; at < own.length; at += 200) {
      const chunk = own.slice(at, at + 200);
      await removeEntries(this.libraryId, chunk);
      for (const id of chunk) this.drop(id);
      done += chunk.length;
      progress?.(done, own.length);
      this.changed();
    }
    return done;
  }

  /**
   * 2026-10-22 — IN DIE BIBLIOTHEK EINES ANDEREN BEREICHS TRAGEN: so wird ein
   * Eintrag öffentlich (oder wieder nur für wenige). Die Kennung bleibt —
   * jeder Verweis zeigt weiter auf ihn; der Schlüssel bleibt, wenn er drüben
   * frei ist (sonst ein freier, und `keyChanged` sagt es).
   */
  /**
   * `as` (2026-10-22, Schritt 6): der Eintrag kommt drüben als andere Art an —
   * ein „Wiedza" einer Baza wiedzy wird ein Komentarz der Bibliothek desselben
   * Bereichs (der Dienst erlaubt das nur so). Kennung bleibt; Verweise im Zapis
   * werden drüben Kennungen wie bei jedem Speichern.
   */
  async moveTo(id: string, target: LibraryStore, as?: { readonly kind: string; readonly data: EntryData }): Promise<{ entry: Entry; keyChanged: boolean; from?: string; pinned: number }> {
    if (this.entries.get(id) === undefined) throw new WorkspaceError('Ten wpis należy do innej biblioteki.');
    if (target === this) return { entry: this.entries.get(id)!, keyChanged: false, pinned: 0 };
    /* Erst die Texte, die ihn noch über den Schlüssel nennen, auf seine Kennung — drüben könnte der Schlüssel einem anderen gehören. */
    const { pinned } = await this.pinCitations(id);
    const entry = this.entries.get(id);
    if (entry === undefined) throw new WorkspaceError('Ten wpis należy do innej biblioteki.');
    const newest = await target.writeKey();
    const kind = as?.kind ?? entry.kind;
    const shaped = as === undefined ? entry.data : storedMarkup(kind, as.data, target);
    const key = target.keyFor({ ...entry, kind, data: shaped }, entry.key);
    const aliases = nextAliases(entry.key, key, aliasesOf(shaped));
    const data: EntryData = { ...shaped };
    if (aliases.length > 0) data[ALIASES] = aliases; else delete data[ALIASES];
    const doc: EntryDoc = { v: 1, id, kind, ...(key === undefined ? {} : { key }), data };
    let done;
    try {
      done = await moveEntry(this.libraryId, id, {
        toLibrary: target.libraryId, kind, epoch: newest.epoch, sealed: await sealEntry(newest.key, doc), version: entry.version
      });
    } catch (e) {
      if (e instanceof WorkspaceError && e.verdict === 'stale') await this.sync().catch(() => undefined);
      throw e;
    }
    this.drop(id);
    const moved: Entry = {
      ...entry, kind, libraryId: target.libraryId, ...(key === undefined ? {} : { key }), data,
      version: done.version, epoch: newest.epoch, updatedAt: done.updatedAt, publishedAt: null, publishedAs: null
    };
    target.put(moved);
    this.changed();
    target.changed();
    return { entry: moved, keyChanged: key !== entry.key, ...(entry.key === undefined ? {} : { from: entry.key }), pinned };
  }

  /**
   * 2026-10-22 — TEXTE, DIE EINEN EINTRAG NOCH ÜBER SEINEN SCHLÜSSEL NENNEN (aus
   * der Zeit vor den Kennungen, aus einem Import, als alter Schlüssel), nennen
   * ihn danach über seine Kennung — in jeder lesbaren Bibliothek, in der ich
   * schreiben darf. Vor jeder Änderung des Schlüssels und vor jedem Umzug: so
   * verwaist kein Zitat. Wo ich nicht schreiben darf, bleibt der alte
   * Schlüssel als zweiter am Eintrag und findet ihn weiter.
   */
  async pinCitations(id: string): Promise<{ pinned: number; failed: number }> {
    const target = this.get(id);
    if (target === undefined) return { pinned: 0, failed: 0 };
    const names = new Set([target.key, ...aliasesOf(target.data)].filter((k): k is string => k !== undefined).map((k) => k.toLowerCase()));
    if (names.size === 0) return { pinned: 0, failed: 0 };
    let pinned = 0;
    let failed = 0;
    for (const store of [this, ...this.peers()]) {
      for (const entry of store.all()) {
        const next = mapMarkups(entry.kind, entry.data, (text) => mapRefTokens(text, (token) =>
          names.has(token.toLowerCase()) && refTarget(store, token)?.id === id ? id : token));
        if (next === entry.data) continue;
        try {
          await store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: next });
          pinned += 1;
        } catch {
          failed += 1;
        }
      }
    }
    return { pinned, failed };
  }

  /* -- Alte offene Fassungen (bis 2026-10-22) ------------------------------------------------- */

  /**
   * 2026-10-22 (Schritt 8) — alte offene Fassungen zurückziehen („Wycofaj stare kopie" in den Einstellungen).
   * Hinaus geht nichts mehr: wer liest, sagt der Bereich.
   */
  async withdraw(ids: readonly string[]): Promise<number> {
    let done = 0;
    for (let i = 0; i < ids.length; i += 400) done += (await withdrawEntries(this.libraryId, ids.slice(i, i + 400))).unpublished;
    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry !== undefined) this.put({ ...entry, publishedAs: null, publishedAt: null });
    }
    this.changed();
    return done;
  }
}

/* -- Ein Speicher je Bibliothek und Tab ------------------------------------------------------ */

const stores = new Map<string, LibraryStore>();

/** 0109 — die Bibliotheken, die dieser Tab schon offen hat (für die Suche, Ctrl K). */
export const loadedStores = (): LibraryStore[] => [...stores.values()].filter((s) => s.loaded);

/**
 * 0109 — BEI DER ABMELDUNG bleibt nichts aus den Bibliotheken: nicht im Tab
 * (die offenen Einträge, die Namen), nicht auf dem Gerät (die Abschriften und
 * die Powtórki für die Zeit ohne Netz). Was ohne Konto gelernt wurde
 * (`progress`) gehört dem Gerät, und die Ablage (`outbox`) ist versiegelt und
 * geht mit der nächsten Anmeldung desselben Halters hinaus — beide bleiben.
 */
export function forgetLibraries(): void {
  cacheOn = false;
  stores.clear();
  forgetLibraryNames();
  void idbForget('library', 'offline').catch(() => undefined);
}

/**
 * 0109 — EIN SPEICHER OHNE KONTO: ein Platz liest die Bibliothek über seinen
 * eigenen Weg (`/seat/…/library`) und mit den Schlüsseln, die er hält
 * (`areaReader`). Er steht nicht in der Liste des Tabs — die gehört dem
 * Konto —, schreibt nichts und legt nichts auf dem Gerät ab.
 */
export function readOnlyStore(
  library: Pick<LibraryRow, 'libraryId' | 'areaId'>,
  source: (since: string | null) => Promise<{ now: string; entries: readonly SealedEntry[] }>,
  keys: (areaId: string, epochs: readonly number[]) => Promise<ReadonlyMap<number, Uint8Array>>
): LibraryStore {
  const store = new LibraryStore(null, library);
  store.readVia(source);
  store.useKeys(keys);
  return store;
}

export function storeOf(ring: Ring, library: Pick<LibraryRow, 'libraryId' | 'areaId'>): LibraryStore {
  let store = stores.get(library.libraryId);
  if (store === undefined) {
    store = new LibraryStore(ring, library);
    stores.set(library.libraryId, store);
  }
  return store;
}

/** Den Speicher abonnieren — und beim ersten Mal (und bei jedem Öffnen) abgleichen. */
export function useLibraryStore(ring: Ring | null, library: Pick<LibraryRow, 'libraryId' | 'areaId'> | null): {
  readonly store: LibraryStore | null;
  readonly revision: number;
  readonly failed: string | null;
} {
  const store = ring === null || library === null ? null : storeOf(ring, library);
  const [revision, setRevision] = useState(store?.revision ?? 0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (store === null) return undefined;
    const off = store.subscribe(() => setRevision(store.revision));
    let alive = true;
    store.sync().then(() => { if (alive) setFailed(null); }, (e: unknown) => {
      if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać biblioteki.');
    });
    const again = () => { if (document.visibilityState === 'visible') void store.sync().catch(() => undefined); };
    document.addEventListener('visibilitychange', again);
    return () => { alive = false; off(); document.removeEventListener('visibilitychange', again); };
  }, [store]);

  return { store, revision, failed };
}
