/**
 * 2026-11-22 (Homer-Einheit) — DIE ANTWORT AUF EINE LEKTÜRE-FRAGE: der Abschnitt aus der Bibliothek, Zeile für Zeile
 * nummeriert, mit dem Słowniczek; je Art
 * <code>
 *   lines   Zeilen antippen (wählen / abwählen)
 *   label   unter jeder markierten Zeile die Rollen — eine wählen
 *   span    erste und letzte Zeile antippen (ein drittes Tippen beginnt neu)
 * </code>
 * Nach der Prüfung bleibt alles stehen: richtig gewählt grün ✓, falsch gewählt rot ✗, übersehen bernsteinfarben (nie nur
 * Farbe). Ist der Text hier nicht zu haben, sagt die Karte es und lässt weitergehen („Pomiń").
 */

import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useT } from '../../core/i18n';
import { Loading } from '../../ui/Loading';
import type { Card } from '../cardBasics';
import type { Outcome } from '../check';
import { givenLines, givenSpan, rangesText, spanOverlap, type GlossaryEntry, type ReadingSpec } from './readingSpec';
import { GlossLine, useGlossary, usePassage } from './PassageLines';
import './reading.css';

export function ReadingAnswer({ card, locked, reveal, onSubmit, action }: {
  card: Card;
  locked: boolean;
  reveal?: { readonly given: unknown; readonly outcome: Outcome };
  onSubmit: (given: unknown) => void;
  /** Statt „Sprawdź": „Dalej" nach der Prüfung (aus `AnswerInput`). */
  action?: ReactNode;
}) {
  const t = useT();
  const a = card.answer as ReadingSpec;
  const passage = usePassage(a.passage);
  const glossary = useGlossary();
  const [chosen, setChosen] = useState<readonly number[]>([]);
  const [roles, setRoles] = useState<readonly number[]>(() => (a.form === 'label' ? a.marked.map(() => -1) : []));
  const [span, setSpan] = useState<readonly [number, number] | null>(null);
  const [gloss, setGloss] = useState<GlossaryEntry | null>(null);
  useEffect(() => { setChosen([]); setRoles(a.form === 'label' ? a.marked.map(() => -1) : []); setSpan(null); setGloss(null); }, [card.key, card.fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = reveal !== undefined;
  const mineLines = shown ? givenLines(reveal.given) : chosen;
  const mineRoles = shown ? (Array.isArray(reveal.given) ? reveal.given.map((g) => (typeof g === 'number' ? g : -1)) : []) : roles;
  const mineSpan = shown ? givenSpan(reveal.given) : span;
  const ask = t(`cogitaReading.ask.${a.form}`);

  const button = action ?? (
    <button key="check" type="button" className="wk-btn" data-read-check=""
      disabled={locked || (a.form === 'lines' ? chosen.length === 0 : a.form === 'label' ? !roles.some((r) => r >= 0) : span === null)}
      onClick={() => onSubmit(a.form === 'lines' ? [...chosen] : a.form === 'label' ? [...roles] : span === null ? null : [span[0], span[1]])}>
      {t('cogitaLearnRun.card.check')}
    </button>
  );

  if (passage.status === 'loading') return <div className="cg-answer cg-read" data-read="loading"><Loading lines={3} label={t('cogitaReading.opening')} /></div>;
  if (passage.status === 'missing') {
    return (
      <div className="cg-answer cg-read" data-read="missing">
        <p className="wk-empty">{t('cogitaReading.missing')}</p>
        {action ?? <button type="button" className="wk-btn wk-btn-line" disabled={locked} data-read-skip="" onClick={() => onSubmit(null)}>{t('cogitaReading.skip')}</button>}
      </div>
    );
  }

  const lines = passage.lines;
  const want = new Set(a.form === 'lines' && shown ? a.correct : []);
  const markedAt = new Map(a.form === 'label' ? a.marked.map((l, i) => [l, i] as const) : []);
  const inSpan = (n: number, s: readonly [number, number] | null) => s !== null && n >= s[0] && n <= s[1];
  const rightSpans = a.form === 'span' && shown ? a.spans : [];

  const tapLine = (n: number) => {
    if (locked || shown) return;
    if (a.form === 'lines') setChosen((was) => (was.includes(n) ? was.filter((x) => x !== n) : [...was, n].sort((x, y) => x - y)));
    if (a.form === 'span') setSpan((was) => (was === null || was[0] !== was[1] ? [n, n] : n < was[0] ? [n, was[0]] : [was[0], n]));
  };
  const key = (n: number) => (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tapLine(n); } };

  const lineClass = (n: number): string => {
    if (a.form === 'lines') {
      const on = mineLines.includes(n);
      if (!shown) return on ? ' is-on' : '';
      return on ? (want.has(n) ? ' is-right' : ' is-wrong') : want.has(n) ? ' is-missed' : '';
    }
    if (a.form === 'span') {
      const on = inSpan(n, mineSpan);
      if (!shown) return on ? ' is-on' : '';
      const right = rightSpans.some((s) => inSpan(n, s));
      return on ? (right ? ' is-right' : ' is-wrong') : right ? ' is-missed' : '';
    }
    return markedAt.has(n) ? ' is-marked' : '';
  };
  const glyph = (n: number): string => {
    if (!shown) return '';
    if (a.form === 'lines') return mineLines.includes(n) ? (want.has(n) ? '✓' : '✗') : want.has(n) ? '•' : '';
    if (a.form === 'span') return inSpan(n, mineSpan) ? (rightSpans.some((s) => inSpan(n, s)) ? '✓' : '✗') : rightSpans.some((s) => inSpan(n, s)) ? '•' : '';
    const i = markedAt.get(n);
    return i === undefined ? '' : mineRoles[i] === a.correct[i] ? '✓' : '✗';
  };

  const selectable = a.form !== 'label' && !locked && !shown;
  const status = a.form === 'lines' ? (mineLines.length === 0 ? '' : t('cogitaReading.chosenLines', { list: rangesText(mineLines) }))
    : a.form === 'span' ? (mineSpan === null ? '' : t('cogitaReading.chosenSpan', { range: mineSpan[0] === mineSpan[1] ? String(mineSpan[0]) : `${mineSpan[0]}–${mineSpan[1]}` }))
      : t('cogitaReading.labelled', { k: mineRoles.filter((r) => r >= 0).length, n: a.form === 'label' ? a.marked.length : 0 });
  const spanScore = a.form === 'span' && shown && mineSpan !== null ? Math.max(0, ...a.spans.map((s) => spanOverlap(s, mineSpan))) : null;

  return (
    <div className={`cg-answer cg-read is-${a.form}${shown ? ' is-revealed' : ''}`} data-read={a.form} data-read-lines={lines.length}>
      <p className="cg-read-ask">{ask}</p>
      <ol className="cg-read-lines" aria-label={t('cogitaReading.passage')}>
        {lines.map((text, i) => {
          const n = i + 1;
          const at = markedAt.get(n);
          return (
            <li key={n} className={`cg-read-line${lineClass(n)}${selectable ? ' is-tappable' : ''}`} data-read-line={n}
              {...(selectable ? { role: 'checkbox', tabIndex: 0, 'aria-checked': a.form === 'lines' ? mineLines.includes(n) : inSpan(n, mineSpan), onClick: () => tapLine(n), onKeyDown: key(n) } : {})}>
              <span className="cg-read-no" aria-hidden="true">{n}</span>
              <span className="cg-read-text"><GlossLine text={text} glossary={glossary} workId={passage.workId} onWord={setGloss} /></span>
              <span className="cg-read-mark" aria-hidden="true">{glyph(n)}</span>
              {a.form === 'label' && at !== undefined && (
                <span className="cg-read-roles" role="radiogroup" aria-label={t('cogitaReading.roleOf', { n })} data-read-roles={n}>
                  {a.roles.map((role, r) => {
                    const on = mineRoles[at] === r;
                    const right = shown && a.correct[at] === r;
                    return (
                      <button key={r} type="button" role="radio" aria-checked={on} disabled={locked || shown}
                        className={`cg-read-role${on ? ' is-on' : ''}${shown && on ? (right ? ' is-right' : ' is-wrong') : ''}${shown && !on && right ? ' is-missed' : ''}`}
                        data-read-role={r} onClick={() => setRoles((was) => was.map((x, k) => (k === at ? (x === r ? -1 : r) : x)))}>{role}</button>
                    );
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {gloss !== null && (
        <div className="cg-gloss-box" role="status" data-gloss-open={gloss.id}>
          <strong>{gloss.word}</strong> — {gloss.meaning}
          <button type="button" className="wk-link-btn" onClick={() => setGloss(null)} aria-label={t('cogitaReading.closeGloss')}>×</button>
        </div>
      )}
      <div className="cg-row-between cg-read-foot">
        <span className="cg-muted" data-read-status="">{status}{spanScore !== null && spanScore < 1 && spanScore > 0 ? ` · ${t('cogitaReading.overlap', { pct: Math.round(spanScore * 100) })}` : ''}</span>
        {button}
      </div>
      {shown && a.form !== 'label' && <p className="cg-muted cg-read-legend">{t('cogitaReading.legend')}</p>}
    </div>
  );
}
