/**
 * 2026-11-05 (Prompt 23, C) — SELBSTTEST ÜBER DIE FRAGEN („Sprawdź, co wiesz“ → „Luki“ → „Uzupełnij luki“), rein — geprüft in
 * `scripts/app-selfcheck-check.mjs`.
 * <code>
 *   Kernfrage    eine Frage mit "core": true; ihre Themen sind ihr „O czym“. Ein Thema ohne Kernfrage: seine erste Frage
 *                (in der Folge der Karten) — so geht „Sprawdź, co wiesz“ auch in einer Baza ohne Markierung
 *   Sprawdź      jede Kernfrage der Themen (der ganzen Baza oder des Gebiets im Bild) genau einmal ("mode": "once")
 *   Luka         ein Thema, dessen Kernfrage schon beantwortet ist und jetzt nicht gewusst wird (zuletzt falsch, vergessen)
 *   Uzupełnij    alle Fragen der Lücken (jede einmal) und dazu eine Stichprobe: je übrigem Thema eine andere Frage
 *   Übersicht    am Ende eines Laufs „każda raz“: je Thema „umiesz“ oder „luka“ (eine Karte nicht ganz richtig → Lücke)
 * </code>
 */

import type { Card } from './cardBasics';
import { FORGOTTEN, knownessAt, type CardState } from './knowness';
import { sampleByTopic, topicsOfCard } from './revision';

/** Je Thema seine Kernkarten — ohne Kernfrage die erste Frage des Themas (nur Pytania, nie Karten einer Vorlage). */
export function coreCardsByTopic(cards: readonly Card[], within?: ReadonlySet<string>): Map<string, Card[]> {
  const core = new Map<string, Card[]>();
  const first = new Map<string, Card>();
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.key) || c.about === undefined || c.about.length === 0) continue;
    seen.add(c.key);
    for (const t of c.about) {
      if (within !== undefined && !within.has(t)) continue;
      if (c.core === true) { const list = core.get(t); if (list === undefined) core.set(t, [c]); else list.push(c); }
      else if (!first.has(t)) first.set(t, c);
    }
  }
  for (const [t, c] of first) if (!core.has(t)) core.set(t, [c]);
  return core;
}

/** Die Karten von „Sprawdź, co wiesz“: jede Kernkarte einmal (eine Karte für mehrere Themen nur einmal). */
export function selfCheckCards(cards: readonly Card[], within?: ReadonlySet<string>): Card[] {
  const out: Card[] = [];
  const seen = new Set<string>();
  for (const list of coreCardsByTopic(cards, within).values()) for (const c of list) if (!seen.has(c.key)) { seen.add(c.key); out.push(c); }
  return out;
}

/** Ist eine Karte jetzt eine Lücke? Beantwortet und nicht gewusst (zuletzt falsch, vergessen); nie beantwortet: nein. */
export const cardGap = (state: CardState | null, now: number): boolean => state !== null && !(knownessAt(state, now) >= FORGOTTEN);

/**
 * DIE LÜCKEN: Themen, deren Kernkarte schon beantwortet und jetzt nicht gewusst ist — `checked`: Themen mit mindestens einer
 * beantworteten Kernkarte (ohne sie sagt „Luki“: erst prüfen).
 */
export function gapTopics(cards: readonly Card[], state: (key: string) => CardState | null, now: number, within?: ReadonlySet<string>): { readonly gaps: Set<string>; readonly checked: Set<string> } {
  const gaps = new Set<string>();
  const checked = new Set<string>();
  for (const [t, list] of coreCardsByTopic(cards, within)) {
    for (const c of list) {
      const st = state(c.key);
      if (st === null) continue;
      checked.add(t);
      if (cardGap(st, now)) gaps.add(t);
    }
  }
  return { gaps, checked };
}

/**
 * „UZUPEŁNIJ LUKI“: alle Karten, die etwas zu den Lücken fragen, und dazu je anderem geprüften Thema eine Karte, die nicht seine
 * Kernkarte ist (eine Stichprobe — vielleicht war die Kernfrage geraten). Ohne Lücken: leer.
 */
export function fillCards(cards: readonly Card[], gaps: ReadonlySet<string>, checked: ReadonlySet<string>, seed: string, spot = 1): Card[] {
  if (gaps.size === 0) return [];
  const coreKeys = new Set([...coreCardsByTopic(cards).values()].flat().map((c) => c.key));
  const seen = new Set<string>();
  const out: Card[] = [];
  for (const c of cards) {
    if (seen.has(c.key)) continue;
    if (topicsOfCard(c).some((t) => gaps.has(t))) { seen.add(c.key); out.push(c); }
  }
  const rest = cards.filter((c) => !seen.has(c.key) && !coreKeys.has(c.key) && topicsOfCard(c).some((t) => checked.has(t) && !gaps.has(t)));
  for (const c of sampleByTopic(rest, spot, seed)) if (!seen.has(c.key)) { seen.add(c.key); out.push(c); }
  return out;
}

export interface TopicVerdict {
  readonly topic: string;
  /** Die in diesem Lauf gefragten Karten des Themas. */
  readonly keys: readonly string[];
  readonly gap: boolean;
  /** Die erste Erklärung der ersten nicht ganz richtigen Karte (meist eine Folie) — für „Zobacz w opowieści“. */
  readonly explain: string | null;
}

/** DIE ÜBERSICHT JE THEMA am Ende: welche Themen dieser Lauf fragte, und ob eine Karte davon nicht ganz richtig war. */
export function topicVerdicts(cards: readonly Card[], asked: readonly string[], missed: ReadonlySet<string>): TopicVerdict[] {
  const byKey = new Map(cards.map((c) => [c.key, c] as const));
  const out = new Map<string, { keys: string[]; gap: boolean; explain: string | null }>();
  for (const key of asked) {
    const c = byKey.get(key);
    if (c === undefined) continue;
    for (const t of topicsOfCard(c)) {
      const v = out.get(t) ?? { keys: [], gap: false, explain: null };
      v.keys.push(key);
      if (missed.has(key)) { v.gap = true; if (v.explain === null) v.explain = c.explain[0] ?? null; }
      out.set(t, v);
    }
  }
  return [...out].map(([topic, v]) => ({ topic, ...v })).sort((a, b) => Number(b.gap) - Number(a.gap));
}
