/**
 * 2026-11-01 — DIE EIGENE STATISTIK IM BAUSTEIN AUF DER SEITE: der Lernende sieht, wo seine Karten stehen — dieselben
 * Diagramme wie in Nauka → Postępy (`KnowCharts.tsx`: Kacheln, wo die Karten stehen, Tag für Tag, was fällig wird,
 * Themen, Rodzaje pytań, das Schwerste) und seine Antworten eine nach der anderen (`AnswerLog.tsx`). Aus seinen eigenen
 * Antworten — als Person, als Platz aus dem Link oder in diesem Browser —, für die Karten dieses Bausteins.
 *
 * Geladen erst, wenn er sie öffnet (`cogitaViews.tsx`): eine Seite mit einer Powtórka zieht die Diagramme nicht mit.
 */

import { useMemo } from 'react';

import { AnswerLog } from './AnswerLog';
import type { Card } from './cardBasics';
import { KnowledgeStats } from './KnowCharts';
/* 2026-11-05 (Durchsicht) — die Abstände dieses Lernenden, nicht die Vorgabe. */
import { spacingFor } from './spacing';
import { renamer, type Learner } from './learn';
import { answerIndex } from './measures';
import type { CogitaLibrary } from './store';
import { rich, useT } from '../core/i18n';
import { TexText } from '../ui/tex/Tex';

export function ModuleStats({ lib, learner, cards, title, onBack }: {
  lib: CogitaLibrary;
  learner: Learner | null;
  /** Die Karten dieses Bausteins (seiner Powtórka) — `null`: werden noch gerechnet. */
  cards: readonly Card[] | null;
  title: string;
  onBack: () => void;
}) {
  const t = useT();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  /* Neu, sobald eine Antwort dazukommt (der Fortschritt ist dann eine neue Map). */
  const answered = learner?.progress.answers.size ?? 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const byCard = useMemo(() => (learner === null ? null : answerIndex(learner.progress, rename)), [learner, rename, answered]);
  return (
    <div className="cg" data-module-stats="">
      <div className="cg-run-head">
        <span>{rich(t('cogitaViewsStats.module.title', { title }), { b: () => <strong><TexText text={title} /></strong> })}</span>
        <button type="button" className="wk-link-btn" onClick={onBack} data-module-stats-back="">{t('cogitaViewsStats.module.back')}</button>
      </div>
      {learner === null || byCard === null ? <p className="wk-card-muted">{t('cogitaViewsStats.module.loading')}</p>
        : cards === null ? <p className="wk-card-muted">{t('cogitaViewsStats.module.countingCards')}</p> : (
          <>
            {learner.holder.kind === 'local' && <p className="wk-card-muted">{t('cogitaViewsStats.module.local')}</p>}
            <KnowledgeStats lib={lib} cards={cards} answers={byCard} spacing={spacingFor(lib, learner)} />
            <details className="cg-card" data-module-answers="">
              <summary>{t('cogitaViewsStats.module.myAnswers', { count: learner.progress.answers.size })}</summary>
              <AnswerLog progress={learner.progress} cards={cards} shown={cards} />
            </details>
          </>
        )}
    </div>
  );
}
