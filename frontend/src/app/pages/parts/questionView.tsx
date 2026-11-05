/**
 * 2026-10-21 — DIE FRAGE, wie sie sich zeigt (`question.tsx`): die Karte von
 * Cogita (`CardFace` — Antworten, Prüfen, Urteil), danach das Wyjaśnienie und
 * in einer Präsentation „Dalej" dorthin, wohin das Ergebnis führt.
 *
 * <b>Die Antwort zählt</b>, wo der Przebieg läuft (`StoryContext`): im Browser
 * oder in Cogita. Die Karte heisst wie der Baustein (`ctx.moduleId`) — so
 * erkennen Tore und Bedingungen sie wieder („odpowiedziano dobrze na …").
 *
 * <b>Wer zurückkommt, fragt neu</b>: mit jeder Ankunft auf ihrer Szene
 * (`ShowArrival` — etwa nach einer falschen Antwort „noch einmal") steht die
 * Frage leer da.
 */

import { useContext, useEffect, useMemo, useState } from 'react';

import { useT } from '../../core/i18n';
import { CardFace } from '../../cogita/CardFace';
import { questionCard } from '../../cogita/cards';
import { SlidePhase } from '../motion/MotionBox';
import type { PartContext } from '../part';
import { ShowArrival, ShowClock, ShowPieceKey, StoryContext } from '../presentation/showContext';
import { storyCard } from '../presentation/storyCard';
import { Loading } from '../../ui/Loading';
import { questionData, type QuestionConfig } from './question';

export default function QuestionView({ config, ctx }: { config: QuestionConfig; ctx: PartContext }) {
  const t = useT();
  const story = useContext(StoryContext);
  const clock = useContext(ShowClock);
  const pieceKey = useContext(ShowPieceKey);
  const phase = useContext(SlidePhase);
  const arrival = useContext(ShowArrival);
  const own = useMemo(() => questionCard({ id: ctx.moduleId, kinds: ['question'], data: questionData(config) }, ''), [config, ctx.moduleId]);
  /* 2026-11-03 (G) — eine echte Frage der Baza (ihre Karte), oder die eigene, die für „about" mitzählt. */
  const card = useMemo(() => storyCard(story, own, config.question, config.about), [story, own, config.question, config.about.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = config.question !== '' && story !== null && story.card === undefined;
  const [result, setResult] = useState<boolean | null>(null);

  /* Eine neue Ankunft: eine neue Runde. */
  useEffect(() => { setResult(null); }, [arrival]);

  if (waiting) return <Loading />;
  if (card === null) return <p className="wk-card-muted">{t('moduleDataLearn.qNotReady')}</p>;

  /* In einer Präsentation: weiter, wohin das Ergebnis auf dieser Szene führt (`story.ts`). */
  const next = clock === null || pieceKey === null || result === null
    ? undefined
    : () => clock.go(`answer:${pieceKey}:${result ? 'right' : 'wrong'}`);

  return (
    /* `data-pz-hold`: wer in die Frage tippt, blättert die Präsentation nicht weiter. */
    <div className="pz-question" data-pz-hold="">
      <CardFace
        key={arrival}
        card={card}
        autoFocus={phase === 'here'}
        onAnswered={(outcome, given) => {
          setResult(outcome.correct);
          story?.record(card, outcome.correctness, given === undefined ? undefined : typeof given === 'string' ? given : JSON.stringify(given));
        }}
        onNext={next}
        nextLabel={t('common.next')}
      />
      {result !== null && config.explain !== '' && <p className="pz-question-explain">{config.explain}</p>}
    </div>
  );
}
