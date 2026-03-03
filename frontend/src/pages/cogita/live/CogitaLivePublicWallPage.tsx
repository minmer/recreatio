import { useEffect, useMemo, useRef, useState } from 'react';
import { getCogitaLiveRevisionPublicState, type CogitaLiveRevisionPublicState } from '../../../lib/api';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';

export function CogitaLivePublicWallPage({
  copy,
  code
}: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  code: string;
}) {
  const liveCopy = copy.cogita.library.revision.live;
  const [state, setState] = useState<CogitaLiveRevisionPublicState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const promptTimerEndMs = useMemo(() => {
    const raw = typeof prompt?.actionTimerEndsUtc === 'string' ? Date.parse(prompt.actionTimerEndsUtc) : NaN;
    return Number.isFinite(raw) ? raw : null;
  }, [prompt?.actionTimerEndsUtc]);
  const promptTimerTotalSeconds = useMemo(() => {
    const raw = Number(prompt?.actionTimerSeconds ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.max(1, Math.min(600, Math.round(raw)));
  }, [prompt?.actionTimerSeconds]);
  const timerRemainingMs = promptTimerEndMs == null ? null : Math.max(0, promptTimerEndMs - nowTick);
  const timerProgress =
    timerRemainingMs == null || promptTimerTotalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, timerRemainingMs / (promptTimerTotalSeconds * 1000)));
  const scoringByParticipant = useMemo(
    () =>
      reveal && typeof reveal === 'object'
        ? ((reveal.roundScoring as Record<string, { points?: number; factors?: string[]; streak?: number }> | undefined) ?? null)
        : null,
    [reveal]
  );

  useEffect(() => {
    if (promptTimerEndMs == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [promptTimerEndMs]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const next = await getCogitaLiveRevisionPublicState({ code });
        if (!mounted) return;
        setState(next);
        setStatus('ready');
      } catch {
        if (!mounted) return;
        setStatus('error');
      }
    };
    void poll();
    const id = window.setInterval(poll, 1200);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [code]);

  useEffect(() => {
    const rows = state?.scoreboard ?? [];
    if (rows.length === 0) {
      prevScoresRef.current = new Map();
      prevRanksRef.current = new Map();
      setScoreFxByParticipant({});
      return;
    }
    const currentScores = new Map<string, number>();
    const currentRanks = new Map<string, number>();
    rows.forEach((row, index) => {
      currentScores.set(row.participantId, row.score);
      currentRanks.set(row.participantId, index);
    });
    const prevScores = prevScoresRef.current;
    const prevRanks = prevRanksRef.current;
    const nextFx: Record<string, { delta: number; rankShift: number; token: number }> = {};
    rows.forEach((row, index) => {
      const previousScore = prevScores.get(row.participantId);
      const previousRank = prevRanks.get(row.participantId);
      if (typeof previousScore !== 'number' || typeof previousRank !== 'number') return;
      const delta = row.score - previousScore;
      const rankShift = previousRank - index;
      if (delta !== 0 || rankShift !== 0) {
        nextFx[row.participantId] = { delta, rankShift, token: Date.now() + index };
      }
    });
    if (Object.keys(nextFx).length > 0) {
      setScoreFxByParticipant(nextFx);
      window.setTimeout(() => setScoreFxByParticipant({}), 1400);
    }
    prevScoresRef.current = currentScores;
    prevRanksRef.current = currentRanks;
  }, [state?.revealVersion, state?.scoreboard]);

  return (
    <CogitaLiveWallLayout
      title={liveCopy.hostTitle}
      subtitle={liveCopy.hostKicker}
      left={
        <div className="cogita-live-wall-stack">
          {prompt && prompt.actionTimerEnabled && promptTimerEndMs != null ? (
            <div className="cogita-live-timer">
              <div className="cogita-live-timer-head">
                <span>{liveCopy.timerLabel}</span>
                <strong>{`${Math.max(0, Math.ceil((timerRemainingMs ?? 0) / 1000))}s`}</strong>
              </div>
              <div className="cogita-live-timer-track">
                <span style={{ width: `${Math.round(timerProgress * 100)}%` }} />
              </div>
            </div>
          ) : null}
          <CogitaCheckcardSurface className="cogita-live-card-container" feedbackToken={reveal ? `correct-${state?.revealVersion ?? 0}` : 'idle'}>
            <CogitaLivePromptCard
              prompt={prompt}
              revealExpected={reveal?.expected}
              mode="readonly"
              labels={{
                answerLabel: copy.cogita.library.revision.answerLabel,
                correctAnswerLabel: copy.cogita.library.revision.correctAnswerLabel,
                trueLabel: liveCopy.trueLabel,
                falseLabel: liveCopy.falseLabel,
                fragmentLabel: liveCopy.fragmentLabel,
                correctFragmentLabel: liveCopy.correctFragmentLabel,
                participantAnswerPlaceholder: liveCopy.participantAnswerPlaceholder,
                unsupportedPromptType: liveCopy.unsupportedPromptType,
                waitingForReveal: liveCopy.waitingForRevealLabel,
                selectedPaths: liveCopy.selectedPathsLabel,
                removePath: liveCopy.removePathAction,
                columnPrefix: liveCopy.columnPrefixLabel
              }}
            />
          </CogitaCheckcardSurface>
        </div>
      }
      right={
        <div className="cogita-live-wall-stack">
          <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p>
          <div className="cogita-share-list">
            {(state?.scoreboard ?? []).map((row) => {
              const scoreFx = scoreFxByParticipant[row.participantId];
              const scoring = scoringByParticipant?.[row.participantId];
              const factors = Array.isArray(scoring?.factors) ? scoring?.factors.map(String) : [];
              const isIncorrect = factors.includes('wrong') || factors.includes('first-wrong');
              const isCorrect = !isIncorrect && factors.some((factor) => factor === 'base' || factor === 'first' || factor === 'speed' || factor === 'streak');
              const rankState = scoreFx?.rankShift ? (scoreFx.rankShift > 0 ? 'up' : 'down') : undefined;
              const flashState = isCorrect ? 'correct' : isIncorrect ? 'incorrect' : undefined;
              return (
                <div className="cogita-share-row" key={row.participantId} data-flash={flashState} data-rank-change={rankState}>
                  <div><strong>{row.displayName}</strong></div>
                  <div className="cogita-share-meta">
                    {`${row.score} ${liveCopy.scoreUnit}`}
                    {scoreFx?.delta ? (
                      <span key={`delta:${row.participantId}:${scoreFx.token}`} className="cogita-score-delta" data-sign={scoreFx.delta > 0 ? 'plus' : 'minus'}>
                        {scoreFx.delta > 0 ? ` +${scoreFx.delta}` : ` ${scoreFx.delta}`}
                      </span>
                    ) : null}
                    {rankState ? (
                      <span key={`rank:${row.participantId}:${scoreFx?.token ?? 0}`} className="cogita-score-rank" data-rank={rankState}>
                        {rankState === 'up' ? ' ↑' : ' ↓'}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {status === 'error' ? <p>{liveCopy.connectionError}</p> : null}
            {status === 'ready' && (state?.scoreboard.length ?? 0) === 0 ? <p>{liveCopy.noParticipants}</p> : null}
          </div>
        </div>
      }
    />
  );
}
