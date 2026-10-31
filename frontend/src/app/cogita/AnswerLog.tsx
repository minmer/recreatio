/**
 * 2026-11-01 — WAS GEANTWORTET WURDE: jede Antwort mit der Frage, dem Gegebenen in Worten, wie richtig, wann und wie
 * lange — die jüngste zuerst. Für die Lehrerin (je Uczący się in Postępy) und für den Lernenden selbst (im Baustein
 * auf der Seite, `ModuleStats.tsx`). Eine eigene kleine Datei: eine Seite lädt damit nicht die ganze Kanzlei.
 */

import { useMemo } from 'react';

import type { Card } from './cardBasics';
import { givenText } from './CardFace';
import { renamer, type Progress } from './learn';
import { spanText } from './measures';
import { entityName, useCtx } from './ui';

/** Gespeichert ist, was die Karte bekam (bei einer Auswahl die Nummer) — hier steht es in Worten. Nur die Karten von `shown`. */
export function AnswerLog({ progress, cards, shown }: { progress: Progress; cards: readonly Card[]; shown: readonly Card[] }) {
  const { lib } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c] as const)), [cards]);
  const inScope = useMemo(() => new Set(shown.map((c) => c.key)), [shown]);
  const name = (id: string) => entityName(lib, id);
  const all = [...progress.answers.values()]
    .map((a) => ({ a, card: byKey.get(rename === undefined ? a.key : rename(a.key)) }))
    .filter((x) => x.card === undefined || inScope.has(x.card.key))
    .sort((x, y) => y.a.at - x.a.at);
  if (all.length === 0) return <span className="cg-muted">Brak odpowiedzi w tym zakresie.</span>;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-answer-log={all.length}>
        <thead><tr><th>Kiedy</th><th>Pytanie</th><th>Odpowiedź</th><th>Wynik</th><th>Czas</th></tr></thead>
        <tbody>
          {all.slice(0, 300).map(({ a, card }) => (
            <tr key={a.id} className={a.correctness >= 0.999 ? 'is-known' : a.correctness >= 0.5 ? 'is-learning' : 'is-unseen'}>
              <td>{new Date(a.at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td className="cg-stats-q">{card === undefined ? a.question.slice(0, 60) : cardText(card, name).slice(0, 140)}</td>
              <td className="cg-stats-q" data-answer-given="">{shownGiven(card, a.given)}</td>
              <td>{a.correctness >= 0.999 ? '✓ dobrze' : a.correctness >= 0.5 ? '½ częściowo' : '✗ źle'}</td>
              <td>{a.ms === undefined ? '—' : spanText(a.ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {all.length > 300 && <span className="cg-muted">Pokazano 300 najnowszych z {all.length}.</span>}
    </div>
  );
}

/** Das Gegebene in Worten — gespeichert ist, was die Karte bekam: Text, oder als JSON eine Nummer, eine Liste. */
export function shownGiven(card: Card | undefined, raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') return '—';
  if (card === undefined) return raw;
  const form = card.answer.form;
  if (form === 'text' || form === 'gap' || form === 'number' || form === 'date') return raw;
  if (form === 'flash') return raw === 'knew' ? 'umiałem' : raw === 'partly' ? 'częściowo' : raw === 'not' ? 'nie umiałem' : raw;
  try {
    const text = givenText(card, JSON.parse(raw) as unknown);
    return text === '' ? raw : text;
  } catch {
    return raw;
  }
}

/** Was eine Karte fragt, in Worten — für die Listen. */
export function cardText(card: Card, name: (id: string) => string): string {
  const prompt = card.prompt.map((p) => p.text).join(' ').trim();
  const base = prompt !== '' ? prompt : card.entity !== undefined ? name(card.entity) : card.question;
  return card.label === undefined ? base : `${base}: ${card.label}`;
}
