/**
 * 2026-11-05 (Prompt 17) — WAS DIE KARTE ZULETZT ZEIGTE — je Lernendem, Baza und Widok, in diesem Browser — und was sich
 * seither geändert hat. Kommt der Lernende zurück (nach einer Powtórka, einem neuen Laden), spielt die Karte genau diesen
 * Unterschied ab (`WorldMap`, `playback`); beim ersten Besuch gibt es keinen, die Säulen steigen nur sanft auf.
 * <code>
 *   je Thema   das Band (Berg, lernbar, fällig, gekonnt), ob etwas fällig ist, die mittlere Kenntnis (der Ring, in
 *              Prozent) und die Höhe — gepackt in EINE Zahl
 *   dazu       wann es zu sehen war und die Figuren (ihre Themen)
 * </code>
 * Die Kennungen stehen gekürzt (FNV-1a, 32 Bit, Basis 36): 5 000 Themen sind etwa 70 KB. Treffen zwei Kürzel zusammen,
 * beginnt höchstens ein Feld beim falschen Stand — nichts geht verloren. Höchstens 16 solche Stände je Browser (der älteste
 * geht zuerst). Ohne Speicher (privates Fenster): jedes Mal wie ein erster Besuch.
 *
 * Verglichen wird Thema für Thema (`diffShown`):
 * <code>
 *   learned    vorher nicht gekonnt, jetzt gekonnt (im Tal)              — sinkt, füllt sich, der Ring schliesst sich
 *   reviewed   beide Male gekonnt, vorher fällig, jetzt nicht            — der Ring schliesst sich, der Punkt vergeht, ein Puls
 *   opened     vorher ein Berg, jetzt lernbar                            — der hellgelbe Rand zeichnet sich, ein Schimmer
 *   lowered    sonst niedriger geworden (eine Grundlage wurde gekonnt)  — sinkt in einer Welle danach
 *   moved      sonst etwas anders (der Ring, fällig geworden, höher)     — geht ohne Aufhebens dorthin
 *   fresh      vorher nicht auf der Karte                                — steigt auf wie beim ersten Besuch
 * </code>
 */

import type { LsBand } from './landscape';

const BANDS: readonly (LsBand | null)[] = [null, 'mountain', 'ring', 'due', 'known'];
const codeOf = (b: LsBand | null): number => { const i = BANDS.indexOf(b); return i < 0 ? 0 : i; };
const isLand = (b: LsBand | null): boolean => b === 'known' || b === 'due';

/** Was von einem Thema gemerkt wird (in der Reihenfolge der Karte). */
export interface ShownTopicIn {
  readonly id: string;
  readonly band: LsBand | null;
  readonly due: boolean;
  /** 0–1. */
  readonly share: number;
  readonly steps: number;
}

/** Wie ein Thema vorher aussah. */
export interface WorldBefore {
  readonly band: LsBand | null;
  readonly due: boolean;
  readonly share: number;
  readonly steps: number;
}

export interface ShownState {
  readonly v: 1;
  /** Wann die Karte so zu sehen war (Millisekunden seit 1970). */
  readonly at: number;
  /** Je Thema (gekürzte Kennung) eine gepackte Zahl (`pack`). */
  readonly topics: Readonly<Record<string, number>>;
  /** Die Figuren: [0 einzeln | 1 zum Ziel, Kennung des Themas]. */
  readonly pieces: readonly (readonly [0 | 1, string])[];
}

/** FNV-1a über die Kennung, als Basis 36. */
export function shortId(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const MAX_STEPS = 9999;
/** Band (0–4) + 5 · fällig + 10 · Prozent (0–100) + 1010 · Höhe. */
export function pack(t: { readonly band: LsBand | null; readonly due: boolean; readonly share: number; readonly steps: number }): number {
  const s = Math.max(0, Math.min(100, Math.round((Number.isFinite(t.share) ? t.share : 0) * 100)));
  const h = Math.max(0, Math.min(MAX_STEPS, Math.round(Number.isFinite(t.steps) ? t.steps : 0)));
  return codeOf(t.band) + 5 * (t.due ? 1 : 0) + 10 * s + 1010 * h;
}

export function unpack(n: number): WorldBefore {
  const h = Math.floor(n / 1010);
  const r = n - 1010 * h;
  const s = Math.floor(r / 10);
  const r2 = r - 10 * s;
  const d = r2 >= 5 ? 1 : 0;
  return { band: BANDS[r2 - 5 * d] ?? null, due: d === 1, share: s / 100, steps: h };
}

/** Der Stand, wie er jetzt zu sehen ist. */
export function shownOf(topics: readonly ShownTopicIn[], pieces: readonly { readonly kind: 'single' | 'goal'; readonly id: string }[], at: number): ShownState {
  const out: Record<string, number> = {};
  for (const t of topics) out[shortId(t.id)] = pack(t);
  return { v: 1, at, topics: out, pieces: pieces.map((p) => [p.kind === 'goal' ? 1 : 0, p.id] as const) };
}

export interface ShownDiff {
  /** Je Thema der Karte, wie es vorher aussah (`null`: vorher nicht auf der Karte). */
  readonly before: readonly (WorldBefore | null)[];
  readonly learned: readonly number[];
  readonly reviewed: readonly number[];
  readonly opened: readonly number[];
  readonly lowered: readonly number[];
  readonly moved: readonly number[];
  readonly fresh: readonly number[];
  /** Etwas ist anders (ohne `fresh` allein bei einer leeren alten Karte). */
  readonly any: boolean;
}

/** Thema für Thema: was sich seit `shown` geändert hat. */
export function diffShown(shown: ShownState, topics: readonly ShownTopicIn[]): ShownDiff {
  const before: (WorldBefore | null)[] = [];
  const learned: number[] = []; const reviewed: number[] = []; const opened: number[] = []; const lowered: number[] = []; const moved: number[] = []; const fresh: number[] = [];
  topics.forEach((t, i) => {
    const raw = shown.topics[shortId(t.id)];
    if (raw === undefined) { before.push(null); fresh.push(i); return; }
    const b = unpack(raw);
    before.push(b);
    const now = unpack(pack(t));
    if (isLand(now.band) && !isLand(b.band)) learned.push(i);
    else if (isLand(now.band) && isLand(b.band) && b.due && !now.due) reviewed.push(i);
    else if (now.band === 'ring' && b.band === 'mountain') opened.push(i);
    else if (now.steps < b.steps) lowered.push(i);
    else if (now.band !== b.band || now.due !== b.due || now.steps !== b.steps || now.share !== b.share) moved.push(i);
  });
  const known = Object.keys(shown.topics).length > 0;
  const any = learned.length + reviewed.length + opened.length + lowered.length + moved.length > 0 || (known && fresh.length > 0);
  return { before, learned, reviewed, opened, lowered, moved, fresh, any };
}

/**
 * Die Gebiete, die seither erobert wurden (alles darin gekonnt, vorher nicht): nur die obersten davon — ist auch das Gebiet
 * darüber neu erobert, zählt es allein.
 */
export function newlyConquered(regions: ReadonlyMap<string, { readonly topics: readonly number[]; readonly parent: string | null }>, before: readonly (WorldBefore | null)[], landNow: (t: number) => boolean): string[] {
  const fresh = new Set<string>();
  for (const [key, r] of regions) {
    if (r.topics.length === 0 || !r.topics.every(landNow)) continue;
    if (r.topics.every((t) => { const b = before[t]; return b !== null && b !== undefined && isLand(b.band); })) continue;
    fresh.add(key);
  }
  return [...fresh].filter((k) => { const p = regions.get(k)?.parent ?? null; return p === null || !fresh.has(p); });
}

/**
 * Die Punkte seit `since`, je Thema (über die Karte der Antwort) und der Rest (Ziel, Serie, Abzeichen, Stufe — und Karten,
 * die auf keinem Feld dieser Karte liegen).
 */
export function pointsSince(events: readonly { readonly at: number; readonly points: number; readonly card?: string }[], since: number, topicOfCard: (key: string) => number | undefined): { readonly byTopic: ReadonlyMap<number, number>; readonly rest: number; readonly sum: number } {
  const byTopic = new Map<number, number>();
  let rest = 0;
  let sum = 0;
  for (const e of events) {
    if (!(e.at > since) || !(e.points > 0)) continue;
    sum += e.points;
    const t = e.card === undefined ? undefined : topicOfCard(e.card);
    if (t === undefined) rest += e.points; else byTopic.set(t, (byTopic.get(t) ?? 0) + e.points);
  }
  return { byTopic, rest, sum };
}

/* -- Speichern ------------------------------------------------------------------------------------------------------ */

const INDEX = 'cg-ls-shown-index';
const KEEP = 16;

export const shownKey = (libraryId: string, viewKey: string, holder: string): string => `cg-ls-shown:${libraryId}:${viewKey}:${holder}`;

export function readShown(key: string): ShownState | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const v = JSON.parse(raw) as Partial<ShownState>;
    if (v.v !== 1 || typeof v.at !== 'number' || typeof v.topics !== 'object' || v.topics === null) return null;
    return { v: 1, at: v.at, topics: v.topics, pieces: Array.isArray(v.pieces) ? v.pieces.filter((p): p is [0 | 1, string] => Array.isArray(p) && (p[0] === 0 || p[0] === 1) && typeof p[1] === 'string') : [] };
  } catch {
    return null;
  }
}

/** Merken — und die ältesten Stände dieses Browsers gehen, wenn es mehr als 16 sind. */
export function keepShown(key: string, state: ShownState): void {
  try {
    let list: string[] = [];
    try { const raw = localStorage.getItem(INDEX); if (raw !== null) list = (JSON.parse(raw) as unknown[]).filter((x): x is string => typeof x === 'string'); } catch { list = []; }
    list = [...list.filter((k) => k !== key), key];
    while (list.length > KEEP) { const old = list.shift(); if (old !== undefined) localStorage.removeItem(old); }
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem(INDEX, JSON.stringify(list));
  } catch { /* zu gross oder ohne Speicher: beim nächsten Mal wie ein erster Besuch */ }
}
