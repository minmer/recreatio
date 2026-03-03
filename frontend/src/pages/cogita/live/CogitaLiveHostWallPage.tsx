import { useEffect, useMemo, useState } from 'react';
import {
  getCogitaLiveRevisionSession,
  scoreCogitaLiveRevisionRound,
  updateCogitaLiveRevisionHostState,
  type CogitaLiveRevisionAnswer,
  type CogitaLiveRevisionParticipant,
  type CogitaLiveRevisionSession
} from '../../../lib/api';
import { clampInt, parseLiveRules } from './liveSessionRules';
import { evaluateCheckcardAnswer } from '../library/checkcards/checkcardRuntime';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';

function normalizeAnswer(answer: unknown, prompt: LivePrompt | null) {
  if (!prompt) return {};
  const kind = String(prompt.kind ?? '');
  if (kind === 'selection') return { selection: Array.isArray(answer) ? answer.map((x) => Number(x)).filter(Number.isFinite) : [] };
  if (kind === 'boolean') return { booleanAnswer: typeof answer === 'boolean' ? answer : null };
  if (kind === 'ordering') return { ordering: Array.isArray(answer) ? answer.map(String) : [] };
  if (kind === 'matching') {
    const root = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {};
    const paths = Array.isArray(root.paths) ? root.paths.map((row) => (Array.isArray(row) ? row.map((x) => Number(x)).filter(Number.isFinite) : [])) : [];
    return { matchingPaths: paths };
  }
  return { text: String(answer ?? '') };
}

export function CogitaLiveHostWallPage({
  copy,
  libraryId,
  revisionId,
  sessionId,
  hostSecret
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
  libraryId: string;
  revisionId: string;
  sessionId: string;
  hostSecret: string;
}) {
  const liveCopy = copy.cogita.library.revision.live;
  const [session, setSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'none' | 'reveal' | 'score' | 'next'>('none');
  const prompt = (session?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (session?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const rules = useMemo(() => parseLiveRules(session?.sessionSettings), [session?.sessionSettings]);
  const participantById = useMemo(() => new Map((session?.participants ?? []).map((p) => [p.participantId, p])), [session?.participants]);
  const scoresById = useMemo(() => new Map((session?.scoreboard ?? []).map((row) => [row.participantId, row.score])), [session?.scoreboard]);
  const roundAnswers = useMemo(() => {
    const currentRound = session?.currentRoundIndex ?? 0;
    const cardKey = String(prompt?.cardKey ?? '');
    return (session?.currentRoundAnswers ?? []).filter((row) => row.roundIndex === currentRound && (!cardKey || String(row.cardKey ?? '') === cardKey));
  }, [prompt?.cardKey, session?.currentRoundAnswers, session?.currentRoundIndex]);
  const revealExpected = reveal?.expected;

  const pollSession = async () => {
    try {
      const next = await getCogitaLiveRevisionSession({ libraryId, sessionId, hostSecret });
      setSession(next);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    void pollSession();
    const id = window.setInterval(pollSession, 1200);
    return () => window.clearInterval(id);
  }, [libraryId, sessionId, hostSecret]);

  const projected = useMemo(() => {
    if (!prompt || !revealExpected) return [] as Array<{ participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean }>;
    const firstAnsweredParticipantId = roundAnswers[0]?.participantId ?? null;
    const processed = roundAnswers.map((row) => {
      const participant = participantById.get(row.participantId);
      if (!participant) return null;
      const check = evaluateCheckcardAnswer({
        prompt: prompt as unknown as Record<string, unknown>,
        expected: revealExpected,
        answer: normalizeAnswer(row.answer, prompt)
      }).correct;
      const wrongPenalty = !check ? clampInt(rules.scoring.wrongAnswerPenalty, 0, 500000) : 0;
      const firstWrongPenalty =
        !check && firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId
          ? clampInt(rules.scoring.firstWrongPenalty, 0, 500000)
          : 0;
      const base = check ? rules.scoring.baseCorrect : -(wrongPenalty + firstWrongPenalty);
      const current = scoresById.get(row.participantId) ?? participant.score ?? 0;
      return {
        participant,
        current,
        predicted: current + base,
        correct: check
      };
    }).filter((row): row is { participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean } => Boolean(row));
    return processed.sort((a, b) => b.predicted - a.predicted);
  }, [participantById, prompt, revealExpected, roundAnswers, rules.scoring.baseCorrect, rules.scoring.firstWrongPenalty, rules.scoring.wrongAnswerPenalty, scoresById]);

  const revealRound = async () => {
    if (!session) return;
    setBusy('reveal');
    try {
      const next = await updateCogitaLiveRevisionHostState({
        libraryId,
        sessionId: session.sessionId,
        hostSecret,
        status: 'revealed',
        currentRoundIndex: session.currentRoundIndex,
        revealVersion: session.revealVersion + 1,
        currentPrompt: session.currentPrompt,
        currentReveal: session.currentReveal
      });
      setSession(next);
    } finally {
      setBusy('none');
    }
  };

  const scoreRound = async () => {
    if (!session || !prompt || !revealExpected) return;
    setBusy('score');
    try {
      const firstAnsweredParticipantId = roundAnswers[0]?.participantId ?? null;
      const payload = roundAnswers.map((row) => {
        const correct = evaluateCheckcardAnswer({
          prompt: prompt as unknown as Record<string, unknown>,
          expected: revealExpected,
          answer: normalizeAnswer(row.answer, prompt)
        }).correct;
        const wrongPenalty = !correct ? clampInt(rules.scoring.wrongAnswerPenalty, 0, 500000) : 0;
        const firstWrongPenalty =
          !correct && firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId
            ? clampInt(rules.scoring.firstWrongPenalty, 0, 500000)
            : 0;
        return {
          participantId: row.participantId,
          isCorrect: correct,
          pointsAwarded: correct ? rules.scoring.baseCorrect : -(wrongPenalty + firstWrongPenalty)
        };
      });
      const next = await scoreCogitaLiveRevisionRound({
        libraryId,
        sessionId: session.sessionId,
        hostSecret,
        scores: payload
      });
      setSession(next);
    } finally {
      setBusy('none');
    }
  };

  const nextRound = async () => {
    if (!session) return;
    setBusy('next');
    try {
      const next = await updateCogitaLiveRevisionHostState({
        libraryId,
        sessionId: session.sessionId,
        hostSecret,
        status: 'running',
        currentRoundIndex: session.currentRoundIndex + 1,
        revealVersion: session.revealVersion + 1,
        currentPrompt: null,
        currentReveal: null
      });
      setSession(next);
    } finally {
      setBusy('none');
    }
  };

  return (
    <CogitaLiveWallLayout
      title={liveCopy.hostTitle}
      subtitle={liveCopy.hostKicker}
      actions={
        <div className="cogita-form-actions">
          <button type="button" className="cta" onClick={() => void revealRound()} disabled={busy !== 'none'}>{liveCopy.checkAndReveal}</button>
          <button type="button" className="ghost" onClick={() => void scoreRound()} disabled={busy !== 'none'}>{liveCopy.optionRevealScore}</button>
          <button type="button" className="ghost" onClick={() => void nextRound()} disabled={busy !== 'none'}>{liveCopy.nextQuestionAction}</button>
        </div>
      }
      left={
        <div className="cogita-live-wall-stack">
          <CogitaCheckcardSurface className="cogita-live-card-container" feedbackToken={reveal ? `correct-${session?.revealVersion ?? 0}` : 'idle'}>
            <CogitaLivePromptCard
              prompt={prompt}
              revealExpected={revealExpected}
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
          <div className="cogita-share-list">
            {roundAnswers.map((row: CogitaLiveRevisionAnswer) => {
              const participant = participantById.get(row.participantId);
              const isCorrect =
                prompt && revealExpected
                  ? evaluateCheckcardAnswer({
                      prompt: prompt as unknown as Record<string, unknown>,
                      expected: revealExpected,
                      answer: normalizeAnswer(row.answer, prompt)
                    }).correct
                  : false;
              return (
                <div className="cogita-share-row" data-state={isCorrect ? 'correct' : 'incorrect'} key={`${row.participantId}:${row.submittedUtc}`}>
                  <div>
                    <strong>{participant?.displayName ?? row.participantId}</strong>
                    <div className="cogita-share-meta">{formatAnswer(row.answer)}</div>
                  </div>
                </div>
              );
            })}
            {status === 'error' ? <p>{liveCopy.connectionError}</p> : null}
          </div>
        </div>
      }
      right={
        <div className="cogita-live-wall-stack">
          <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p>
          <div className="cogita-share-list">
            {(session?.scoreboard ?? []).map((row) => {
              const pred = projected.find((entry) => entry.participant.participantId === row.participantId);
              return (
                <div className="cogita-share-row" key={row.participantId} data-state={pred?.correct ? 'correct' : undefined}>
                  <div>
                    <strong>{row.displayName}</strong>
                    {pred ? <div className="cogita-share-meta">{`→ ${pred.predicted} ${liveCopy.scoreUnit}`}</div> : null}
                  </div>
                  <div className="cogita-share-meta">{`${row.score} ${liveCopy.scoreUnit}`}</div>
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}
  const formatAnswer = (answer: unknown) => {
    if (answer == null) return '—';
    if (typeof answer === 'string') return answer;
    if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer);
    try {
      return JSON.stringify(answer);
    } catch {
      return String(answer);
    }
  };
