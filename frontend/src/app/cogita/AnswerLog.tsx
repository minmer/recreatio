/**
 * 2026-11-01 — WAS GEANTWORTET WURDE: jede Antwort mit der Frage, dem Gegebenen in Worten, wie richtig, wann und wie
 * lange — die jüngste zuerst. Für die Lehrerin (je Uczący się in Postępy) und für den Lernenden selbst (im Baustein
 * auf der Seite, `ModuleStats.tsx`). Eine eigene kleine Datei: eine Seite lädt damit nicht die ganze Kanzlei.
 *
 * 2026-11-01 (Lemma) — dazu, wie viele Podpowiedzi aufgedeckt waren, und bei einer Frage mit Parametern, welche Zahlen
 * gezogen waren; die Frage setzt ihre Wzory (`cardLine`).
 */

import { useMemo } from 'react';

import type { Card } from './cardBasics';
import { givenText } from './CardFace';
import { renamer, type AnswerRecord, type Progress } from './learn';
import { spanText } from './measures';
import { hasTex, plainWithTex } from '../core/tex';
import { TexText } from '../ui/tex/Tex';
import { plainOf } from './schema';
import { clipTex } from './texClip';
import { entityName, entityNameTex, useCtx } from './ui';

/** Gespeichert ist, was die Karte bekam (bei einer Auswahl die Nummer) — hier steht es in Worten. Nur die Karten von `shown`. */
export function AnswerLog({ progress, cards, shown }: { progress: Progress; cards: readonly Card[]; shown: readonly Card[] }) {
  const { lib } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const byKey = useMemo(() => new Map(cards.map((c) => [c.key, c] as const)), [cards]);
  const inScope = useMemo(() => new Set(shown.map((c) => c.key)), [shown]);
  const name = (id: string) => entityNameTex(lib, id);
  const all = [...progress.answers.values()]
    .map((a) => ({ a, card: byKey.get(rename === undefined ? a.key : rename(a.key)) }))
    .filter((x) => x.card === undefined || inScope.has(x.card.key))
    .sort((x, y) => y.a.at - x.a.at);
  if (all.length === 0) return <span className="cg-muted">Brak odpowiedzi w tym zakresie.</span>;
  const withHints = all.some(({ a }) => (a.hints ?? 0) > 0);
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-answer-log={all.length}>
        <thead><tr><th>Kiedy</th><th>Pytanie</th><th>Odpowiedź</th><th>Wynik</th>{withHints && <th>Podpowiedzi</th>}<th>Czas</th></tr></thead>
        <tbody>
          {all.slice(0, 300).map(({ a, card }) => (
            <tr key={a.id} className={a.correctness >= 0.999 ? 'is-known' : a.correctness >= 0.5 ? 'is-learning' : 'is-unseen'}>
              <td>{new Date(a.at).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td className="cg-stats-q">
                {card === undefined ? a.question.slice(0, 60) : <TexText text={cardLine(card, name, 140)} />}
                {/* 2026-11-01 — eine Frage mit Parametern: welche Fassung gefragt wurde. */}
                {a.params !== undefined && <div className="cg-muted" data-answer-params="">{paramsText(a.params, (id) => { const e = lib.entity(id); return e === undefined ? null : lib.label(e); })}</div>}
                {/* 2026-11-03 — z którego losowania: ten sam numer daje dokładnie to samo zadanie. */}
                {a.seed !== undefined && <div className="cg-muted" data-answer-seed={a.seed}>los: {a.seed}</div>}
              </td>
              <td className="cg-stats-q" data-answer-given="">{shownGiven(card, a.given)}</td>
              <td>{a.correctness >= 0.999 ? '✓ dobrze' : a.correctness >= 0.5 ? '½ częściowo' : '✗ źle'}</td>
              {withHints && <td data-answer-hints={a.hints ?? 0}>{(a.hints ?? 0) > 0 ? `${a.hints}` : '—'}</td>}
              <td>{a.ms === undefined ? '—' : spanText(a.ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {all.length > 300 && <span className="cg-muted">Pokazano 300 najnowszych z {all.length}.</span>}
    </div>
  );
}

/**
 * 2026-11-01 — die gezogenen Werte einer Antwort, kurz: „a = 37 · n = 5". 2026-11-03 — auch Listen und gezogene
 * Einträge (`@kennung`, mit ihrem Namen, wenn `name` ihn kennt): „kation = Glin · zd = [Bitwa pod Grunwaldem, …]".
 */
export function paramsText(params: NonNullable<AnswerRecord['params']>, name?: (id: string) => string | null): string {
  const one = (v: number | string): string => {
    if (typeof v === 'number') return String(Number(v.toPrecision(10))).replace('.', ',');
    if (v.startsWith('@') && name !== undefined) return name(v.slice(1)) ?? v;
    return v;
  };
  return Object.entries(params).map(([k, v]) => `${k} = ${Array.isArray(v) ? `[${v.map(one).join(', ')}]` : one(v as number | string)}`).join(' · ');
}

/** Das Gegebene in Worten — gespeichert ist, was die Karte bekam: Text, oder als JSON eine Nummer, eine Liste. */
export function shownGiven(card: Card | undefined, raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') return '—';
  if (card === undefined) return raw;
  const form = card.answer.form;
  if (form === 'text' || form === 'number' || form === 'date' || (form === 'gap' && card.answer.gaps === undefined)) return raw;
  if (form === 'flash') return raw === 'knew' ? 'umiałem' : raw === 'partly' ? 'częściowo' : raw === 'not' ? 'nie umiałem' : raw;
  try {
    const text = givenText(card, JSON.parse(raw) as unknown);
    return text === '' ? raw : text;
  } catch {
    return raw;
  }
}

/** Was eine Karte fragt, in Worten — für die Listen (eine Zeile ohne LaTeX: Titel, Suche, Hinweise). */
export function cardText(card: Card, name: (id: string) => string): string {
  /* 2026-11-01 — eine Lücke fragt mit ihrem Text („…" statt [[Wort]]), nicht mit dem Namen der Frage (der verriete das Wort). */
  const prompt = card.answer.form === 'gap' ? plainWithTex(card.answer.shown) : card.prompt.map((p) => p.text).join(' ').trim();
  const base = prompt !== '' ? prompt : card.entity !== undefined ? name(card.entity) : card.question;
  return card.label === undefined ? base : `${base}: ${card.label}`;
}

/**
 * 2026-11-01 — WAS EINE KARTE FRAGT, als eine Zeile MIT Wzory (für `TexText`): die Frage eines Pytania trägt ihre
 * Wzory als `$…$` (ein Wzór für sich wird einer im Satz), `name` gibt den Namen eines Eintrags ebenso. Höchstens
 * `limit` Zeichen — nie mitten in einem Wzór geschnitten.
 */
export function cardLine(card: Card, name: (id: string) => string, limit = 140): string {
  const texts = card.answer.form === 'gap' ? [card.answer.shown] : card.prompt.map((p) => p.text);
  const parts = texts.map((t) => (hasTex(t) ? plainOf(t, 'inline') : t.split('$').join('\\$'))).join(' ').replace(/\s+/g, ' ').trim();
  const base = parts !== '' ? parts : card.entity !== undefined ? name(card.entity) : card.question;
  return clipTex(card.label === undefined ? base : `${base}: ${card.label}`, limit);
}

/** 2026-11-01 — dieselbe Zeile für einen Namen ohne LaTeX (wo nur Text geht: `title`, Optionen). */
export const cardTitle = (card: Card, lib: Parameters<typeof entityName>[0]): string => cardText(card, (id) => entityName(lib, id));
