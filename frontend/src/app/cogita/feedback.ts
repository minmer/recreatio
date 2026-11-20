/**
 * 2026-11-20 (Eigentümer: „an Folien, Fragen und Karten Kommentare hinterlassen — mit Arten (gut, verbessern, Sprache …) und einem
 * längeren Text —, die der MCP-Server liest, damit die KI, die die Welt baut, sie beim nächsten Update nutzt") — RÜCKMELDUNGEN.
 *
 * <b>Ein Dokument je Rückmeldung</b> (`feedback` in der Baza): worauf sie zeigt (eine Karte, eine Frage, eine Folie, ein Eintrag),
 * welche Art, der Text, wann, offen oder erledigt. Schreiben darf, wer in der Baza schreibt (wer sie baut und prüft). Kein Name,
 * keine Kennung eines Kontos: nur, was über den Inhalt gesagt ist.
 *
 * <b>Für die KI</b> steht jede offene Rückmeldung in der Abschrift des Dostęp dla AI (`aiSnapshot.ts` → `setup.feedback`) mit den
 * bleibenden Namen (`@…`) — dieselben, die ein Import benutzt; MCP: `get_feedback`. Nie im JSON des Kurses (Export/Import).
 */

import { texts } from '../core/i18n';
import type { Card } from './cardBasics';
import type { CogitaLibrary } from './store';

export const FEEDBACK_KINDS = ['good', 'wrong', 'answer', 'language', 'unclear', 'hard', 'easy', 'display', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_LABEL: Readonly<Record<FeedbackKind, string>> = texts({
  good: 'cogitaFeedback.kind.good', wrong: 'cogitaFeedback.kind.wrong', answer: 'cogitaFeedback.kind.answer', language: 'cogitaFeedback.kind.language',
  unclear: 'cogitaFeedback.kind.unclear', hard: 'cogitaFeedback.kind.hard', easy: 'cogitaFeedback.kind.easy', display: 'cogitaFeedback.kind.display', other: 'cogitaFeedback.kind.other'
});
/** Was die Art für die KI heisst (englisch, fest — nicht übersetzt: ein Schlüssel, den eine KI liest). */
export const FEEDBACK_MEANS: Readonly<Record<FeedbackKind, string>> = {
  good: 'works well — keep it as it is',
  wrong: 'content is wrong (fact, answer key or explanation)',
  answer: 'the answer check is unfair (a right answer counted wrong, or a wrong one right)',
  language: 'language problem (grammar, spelling, wording, wrong language)',
  unclear: 'unclear — the question or slide is hard to understand',
  hard: 'too hard for this place in the course',
  easy: 'too easy or trivial',
  display: 'display problem (layout, formula, picture, graphic)',
  other: 'other'
};
export const isFeedbackKind = (v: unknown): v is FeedbackKind => typeof v === 'string' && (FEEDBACK_KINDS as readonly string[]).includes(v);

export type FeedbackTargetKind = 'card' | 'question' | 'slide' | 'entry';

/** Worauf eine Rückmeldung zeigt: die Kennungen, die die Baza kennt, und wie es hiess (zum Lesen, falls es sich ändert). */
export interface FeedbackTarget {
  readonly kind: FeedbackTargetKind;
  /** Der Eintrag (eine Frage, eine Folie, ein Eintrag, aus dem eine Vorlage die Karte macht). */
  readonly entity?: string;
  /** Die Vorlage einer Karte (fehlt: eine Frage, die selbst ihre Karte ist). */
  readonly template?: string;
  /** Der Schlüssel der Karte (eine Fassung einer Frage, ein Paar einer Liste …). */
  readonly card?: string;
  /** Wie es dastand. */
  readonly label: string;
}

export interface Feedback {
  readonly id: string;
  readonly target: FeedbackTarget;
  readonly category: FeedbackKind;
  readonly text: string;
  readonly at: string;
  readonly state: 'open' | 'done';
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const FEEDBACK_TEXT_MAX = 4000;

export function readFeedback(id: string, data: Readonly<Record<string, unknown>>): Feedback | null {
  const tg = typeof data.target === 'object' && data.target !== null ? data.target as Record<string, unknown> : null;
  if (tg === null || !isFeedbackKind(data.category)) return null;
  const kind = (['card', 'question', 'slide', 'entry'] as const).find((k) => k === tg.kind) ?? 'entry';
  const target: FeedbackTarget = {
    kind,
    ...(str(tg.entity) === '' ? {} : { entity: str(tg.entity) }),
    ...(str(tg.template) === '' ? {} : { template: str(tg.template) }),
    ...(str(tg.card) === '' ? {} : { card: str(tg.card) }),
    label: str(tg.label).slice(0, 300)
  };
  return { id, target, category: data.category, text: str(data.text).slice(0, FEEDBACK_TEXT_MAX), at: str(data.at), state: data.state === 'done' ? 'done' : 'open' };
}

export function feedbackData(f: Omit<Feedback, 'id'>): Record<string, unknown> {
  return { target: { ...f.target }, category: f.category, text: f.text.trim().slice(0, FEEDBACK_TEXT_MAX), at: f.at, state: f.state };
}

/** Eine Karte als Ziel: eine Frage (ohne Vorlage) oder eine Karte aus einer Vorlage. */
export function cardTarget(card: Card): FeedbackTarget {
  const label = (card.label ?? '').slice(0, 300);
  return card.template === undefined
    ? { kind: 'question', ...(card.entity === undefined ? {} : { entity: card.entity }), card: card.key, label }
    : { kind: 'card', ...(card.entity === undefined ? {} : { entity: card.entity }), template: card.template, card: card.key, label };
}

/** Gehört eine Rückmeldung zu diesem Ziel? Dieselbe Karte — oder (bei einer Frage, einer Folie) derselbe Eintrag. */
export function sameTarget(a: FeedbackTarget, b: FeedbackTarget): boolean {
  if (a.card !== undefined && b.card !== undefined) return a.card === b.card;
  return a.entity !== undefined && a.entity === b.entity && (a.template ?? '') === (b.template ?? '');
}

export const feedbackOf = (lib: CogitaLibrary): Feedback[] =>
  lib.docs('feedback').map((d) => readFeedback(d.id, d.data)).filter((f): f is Feedback => f !== null).sort((a, b) => (a.at < b.at ? 1 : -1));

/**
 * FÜR DIE KI (Abschrift → MCP `get_feedback`): jede Rückmeldung mit bleibenden Namen (`named`: Kennung → Name ohne „@"), der Art
 * als Schlüssel und in Worten, offen zuerst. Ohne Rückmeldung: nichts.
 */
export function feedbackForAi(lib: CogitaLibrary, named: (id: string) => string): Record<string, unknown>[] {
  const all = feedbackOf(lib);
  return [...all.filter((f) => f.state === 'open'), ...all.filter((f) => f.state === 'done')].map((f) => ({
    id: f.id,
    state: f.state,
    category: f.category,
    means: FEEDBACK_MEANS[f.category],
    target: {
      kind: f.target.kind,
      ...(f.target.entity === undefined ? {} : { entity: `@${named(f.target.entity)}`, entityTitle: lib.entity(f.target.entity) === undefined ? null : lib.label(lib.entity(f.target.entity)!) }),
      ...(f.target.template === undefined ? {} : { template: `@${named(f.target.template)}`, templateName: lib.templates().find((x) => x.id === f.target.template)?.name ?? null }),
      ...(f.target.card === undefined ? {} : { card: f.target.card }),
      shownAs: f.target.label
    },
    text: f.text,
    at: f.at
  }));
}

/** Kurz, für eine Zeile: „Język · 2026-11-20". */
export const feedbackLine = (f: Feedback): string => `${FEEDBACK_LABEL[f.category]}${f.at === '' ? '' : ` · ${f.at.slice(0, 10)}`}`;
