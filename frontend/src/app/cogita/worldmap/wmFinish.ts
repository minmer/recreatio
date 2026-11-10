/**
 * 2026-11-10 (Eigentümer) — WAS EIN TEIL GEBRACHT HAT: beim Beginn eines Teils (Erzählung, Karten, Durchgang) ein Abzug des Stands,
 * an seinem Ende der Vergleich. Daraus die Zahlen des Abschlusses (`WorldFinish.tsx`, im Vollbild) und welche Animation er bekommt:
 * <code>
 *   arrive    das Ziel der Navigation ist erreicht (Feuerwerk)
 *   perfect   „Mistrzowsko" neu (Stern)
 *   conquer   ein Ort neu erobert (Fahne)
 *   tower     ein Durchgang (die Stufen leuchten auf)
 *   story     eine Erzählung (Seiten)
 *   cards     Karten gelernt oder wiederholt (Ring der Treffer)
 * </code>
 * 2026-11-10 (Eigentümer: „zeigen, was getan ist, was daraus folgt und warum") — DIE FOLGEN: eroberte Türme, neue Stufen und
 * Pfade, die sich eben geöffnet haben, je mit dem Grund (die Regel der Eroberung, der eroberte Start-Turm, die erfüllte Eintrittsbedingung).
 * Rein (ohne React); `scripts/app-wm-interaction-check.mjs` prüft es.
 */

import type { CardBand } from './wmConditions';

export type FinishKind = 'arrive' | 'perfect' | 'conquer' | 'tower' | 'story' | 'cards';

export interface FinishSnap {
  readonly key: string;
  readonly kind: 'story' | 'cards' | 'run';
  readonly title: string;
  readonly at: number;
  readonly bands: ReadonlyMap<string, CardBand>;
  readonly levels: ReadonlyMap<string, number>;
  readonly conquered: ReadonlySet<string>;
  readonly perfect: ReadonlySet<string>;
  /** Die erledigten Teile des Weges (Schlüssel), null ohne Navigation. */
  readonly done: ReadonlySet<string> | null;
  readonly target: string | null;
  /** Besuchte Schritte der Erzählung. */
  readonly visited: number;
  /** Die noch nicht befahrenen Pfade beim Beginn: offen (Start am Haus/eroberten Turm) und Eintritt erfüllt. */
  readonly ways?: ReadonlyMap<string, { readonly open: boolean; readonly met: boolean }>;
}

export interface FinishNow {
  readonly band: (card: string) => CardBand;
  readonly level: (place: string) => number;
  readonly conquered: (place: string) => boolean;
  readonly perfect: (place: string) => boolean;
  readonly done: ReadonlySet<string> | null;
  readonly arrived: boolean;
  readonly visited: number;
  /** Die Antworten seit dem Beginn. */
  readonly marks: readonly { readonly correctness: number }[];
  readonly points: number;
  readonly end: number;
  readonly levels: number;
  /** Ohne Stufen: welcher Anteil gekonnt sein muss (0–1). */
  readonly share?: number;
  /** Ein Pfad jetzt (fehlt: unbekannt). */
  readonly way?: (section: string) => { readonly open: boolean; readonly met: boolean; readonly travelled: boolean } | undefined;
  /** Wo ein Pfad beginnt (ein Turm oder das Haus). */
  readonly startOf?: (section: string) => string | undefined;
}

/** Eine Folge des Teils, mit ihrem Grund. */
export type Consequence =
  /** Erobert — mit Stufen: die oberste erreicht; ohne: der Anteil gekonnter Karten. */
  | { readonly kind: 'conquer'; readonly place: string; readonly why: 'levels' | 'share'; readonly of: number; readonly share: number }
  /** Eine Stufe höher, noch nicht erobert. */
  | { readonly kind: 'level'; readonly place: string; readonly from: number; readonly to: number; readonly of: number }
  /** Ein Pfad ist jetzt offen: sein Start-Turm erobert (`tower`), auf der Stufe, ab der er öffnet (`level`), oder der Eintritt erfüllt (`entry`). */
  | { readonly kind: 'opened'; readonly section: string; readonly start: string; readonly why: 'tower' | 'level' | 'entry' };

export interface FinishStats {
  readonly kind: FinishKind;
  readonly answers: number;
  readonly right: number;
  /** Mittel der Richtigkeit, 0…1. */
  readonly accuracy: number;
  /** Zum ersten Mal gesehene Karten. */
  readonly met: number;
  /** Neu sicher gewusste Karten. */
  readonly known: number;
  readonly visited: number;
  readonly ms: number;
  readonly points: number;
  /** Der grösste Sprung einer Stufe (ein Ort). */
  readonly level: { readonly place: string; readonly from: number; readonly to: number; readonly of: number } | null;
  readonly conquered: readonly string[];
  readonly perfect: boolean;
  readonly arrived: boolean;
  /** Die eben erledigten Teile des Weges. */
  readonly just: readonly string[];
  /** Was daraus folgt, mit Gründen (eroberte Türme, Stufen, geöffnete Pfade — in dieser Reihenfolge). */
  readonly consequences: readonly Consequence[];
  /** Hat sich überhaupt etwas getan? Sonst kein Abschluss. */
  readonly worth: boolean;
}

/** Richtig heisst: ganz richtig. */
export const RIGHT = 0.999;

export function finishStats(snap: FinishSnap, now: FinishNow): FinishStats {
  const answers = now.marks.length;
  const right = now.marks.filter((m) => m.correctness >= RIGHT).length;
  const accuracy = answers === 0 ? 0 : now.marks.reduce((s, m) => s + m.correctness, 0) / answers;
  let met = 0;
  let known = 0;
  for (const [card, was] of snap.bands) {
    const is = now.band(card);
    if (was === 'unseen' && is !== 'unseen') met += 1;
    if (was !== 'known' && is === 'known') known += 1;
  }
  let level: FinishStats['level'] = null;
  const conquered: string[] = [];
  let perfect = false;
  for (const [place, was] of snap.levels) {
    const is = now.level(place);
    if (is > was && (level === null || is - was > level.to - level.from)) level = { place, from: was, to: is, of: now.levels };
    if (!snap.conquered.has(place) && now.conquered(place)) conquered.push(place);
    if (!snap.perfect.has(place) && now.perfect(place)) perfect = true;
  }
  const just = snap.done === null || now.done === null ? [] : [...now.done].filter((k) => !snap.done!.has(k));
  const arrived = now.arrived && snap.target !== null;
  const visited = Math.max(0, now.visited - snap.visited);
  const consequences: Consequence[] = [];
  for (const place of conquered) consequences.push({ kind: 'conquer', place, why: now.levels > 0 ? 'levels' : 'share', of: now.levels, share: now.share ?? 1 });
  for (const [place, was] of snap.levels) {
    const is = now.level(place);
    if (is > was && !conquered.includes(place)) consequences.push({ kind: 'level', place, from: was, to: is, of: now.levels });
  }
  if (snap.ways !== undefined && now.way !== undefined) {
    for (const [section, was] of snap.ways) {
      const is = now.way(section);
      if (is === undefined || is.travelled || !is.open || !is.met || (was.open && was.met)) continue;
      const start = now.startOf?.(section) ?? '';
      consequences.push({ kind: 'opened', section, start, why: was.open ? 'entry' : now.conquered(start) ? 'tower' : 'level' });
    }
  }
  const kind: FinishKind = arrived ? 'arrive' : perfect ? 'perfect' : conquered.length > 0 ? 'conquer'
    : snap.kind === 'run' ? 'tower' : snap.kind === 'story' ? 'story' : 'cards';
  const worth = answers > 0 || visited > 0 || met > 0 || level !== null || conquered.length > 0 || arrived || just.length > 0 || consequences.length > 0;
  return { kind, answers, right, accuracy, met, known, visited, ms: Math.max(0, now.end - snap.at), points: now.points, level, conquered, perfect, arrived, just, consequences, worth };
}

/** Ein Wort des Lobs nach der Trefferquote (Schlüssel unter `cogitaWorld.finish.cheer`). */
export function cheerOf(s: FinishStats): 'top' | 'good' | 'keep' | 'read' {
  if (s.answers === 0) return 'read';
  if (s.accuracy >= 0.9) return 'top';
  if (s.accuracy >= 0.7) return 'good';
  return 'keep';
}

/** Gleichmässig verstreut, aber jedes Mal gleich (Konfetti, Funken). */
export function scatter(i: number, salt = 0): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
