/**
 * 2026-11-05 (Prompt 23, C1/C6) — DIE ÜBERSICHT JE THEMA am Ende eines Laufs „każda raz“ (z. B. „Sprawdź, co wiesz“): jedes
 * gefragte Thema als „umiesz“ oder „luka“; jede Lücke führt zu ihrem Thema, zu ihrer Folie („Zobacz w opowieści“) und zu
 * „Uzupełnij luki“ (alle Fragen der Lücken und eine Stichprobe der übrigen — `selfCheck.ts`).
 */

import { useMemo } from 'react';

import type { Card } from './cardBasics';
import { baseLang } from './lang';
import { fillCards, topicVerdicts } from './selfCheck';
import { selfCheckWords } from './selfCheckWords';
import { isSlideEntity } from './slideLib';
import { SlideActions } from './SlideView';
import type { CogitaLibrary } from './store';
import { entityNameTex, originPath } from './ui';
import { TexText } from '../ui/tex/Tex';
import './selfCheck.css';

export function SelfCheckSummary({ lib, cards, asked, missed, seed, onTopic, onSlide, onFill }: {
  lib: CogitaLibrary;
  cards: readonly Card[];
  asked: readonly string[];
  /** Was in diesem Lauf nicht ganz richtig war (falsch oder mit Podpowiedź). */
  missed: ReadonlySet<string>;
  seed: string;
  /** Ein Thema zeigen (der Krajobraz: auf der Karte); fehlt es: zum Eintrag. */
  onTopic?: (id: string) => void;
  /** Eine Folie in ihrer Erzählung zeigen (Vorschau); fehlt es: zum Eintrag der Folie. */
  onSlide?: (id: string) => void;
  onFill: (cards: readonly Card[]) => void;
}) {
  const S = selfCheckWords(baseLang(lib));
  const verdicts = useMemo(() => topicVerdicts(cards, asked, missed).filter((v) => lib.entity(v.topic) !== undefined), [cards, asked, missed, lib]);
  if (verdicts.length === 0) return null;
  const gaps = new Set(verdicts.filter((v) => v.gap).map((v) => v.topic));
  const checked = new Set(verdicts.map((v) => v.topic));
  const fill = fillCards(cards, gaps, checked, seed);
  const href = (id: string) => { const from = lib.origin(id); return from === undefined ? undefined : originPath(from, id, 'wpisy'); };
  const link = (id: string, label: string, on?: (id: string) => void, data?: Record<string, string>) => (on !== undefined
    ? <button type="button" className="wk-link-btn" onClick={() => on(id)} {...data}>{label}</button>
    : href(id) !== undefined ? <a className="wk-link" href={href(id)} {...data}>{label}</a> : null);
  return (
    <section className="cg-selfcheck" data-selfcheck={verdicts.length} data-selfcheck-gaps={gaps.size}>
      <h3 className="cg-selfcheck-title">{S.summaryTitle}</h3>
      <p className="cg-muted" data-selfcheck-line="">{S.summaryLine(verdicts.length - gaps.size, gaps.size)}</p>
      <ul className="cg-selfcheck-list">
        {verdicts.map((v) => (
          <li key={v.topic} className={v.gap ? 'is-gap' : 'is-known'} data-selfcheck-topic={v.topic} data-selfcheck-state={v.gap ? 'gap' : 'known'}>
            <span className="cg-selfcheck-mark" aria-hidden>{v.gap ? '○' : '✓'}</span>
            <span className="cg-selfcheck-name"><TexText text={entityNameTex(lib, v.topic)} /></span>
            <span className={`cg-selfcheck-state${v.gap ? ' is-gap' : ''}`}>{v.gap ? S.gap : S.known}</span>
            {v.gap && (
              <span className="cg-selfcheck-links">
                {link(v.topic, S.openTopic, onTopic, { 'data-selfcheck-open': v.topic })}
                {/* 2026-11-05 (Prompt 23, C6/A2) — ohne Gastgeber: die Vorschau der Folie in ihrer Erzählung selbst (`SlideActions`). */}
                {v.explain !== null && isSlideEntity(lib, v.explain) && (onSlide !== undefined ? link(v.explain, S.seeInStory, onSlide, { 'data-selfcheck-slide': v.explain }) : (() => { const e = lib.entity(v.explain!); return e === undefined ? null : <span data-selfcheck-slide={v.explain}><SlideActions lib={lib} entity={e} questions={false} /></span>; })())}
              </span>
            )}
          </li>
        ))}
      </ul>
      {fill.length > 0 && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => onFill(fill)} data-selfcheck-fill={fill.length}>{S.fillN(gaps.size)}</button>
        </div>
      )}
    </section>
  );
}
