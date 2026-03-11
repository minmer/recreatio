import { useCallback, useEffect, useMemo, useState } from 'react';
import '../../../styles/cogita.css';
import {
  createCogitaCoreRun,
  getCogitaCoreNextCard,
  getCogitaCoreRunState,
  getCogitaCoreRunStatistics,
  issueCsrf,
  joinCogitaCoreRun,
  setCogitaCoreRunStatus,
  submitCogitaCoreRunAttempt,
  type CogitaCoreNextCard,
  type CogitaCoreReveal,
  type CogitaCoreRunParticipant,
  type CogitaCoreRunState,
  type CogitaCoreRunStatistics
} from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';

const DISPLAY_NAME_STORAGE_KEY = 'cogita.core.displayName';

function participantStorageKey(libraryId: string, runId: string) {
  return `cogita.core.participant.${libraryId}.${runId}`;
}

export function CogitaCoreRunPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  runId
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
  runId: string;
}) {
  const coreCopy = copy.cogita.core.run;
  const [runState, setRunState] = useState<CogitaCoreRunState | null>(null);
  const [participant, setParticipant] = useState<CogitaCoreRunParticipant | null>(null);
  const [nextCard, setNextCard] = useState<CogitaCoreNextCard | null>(null);
  const [reveal, setReveal] = useState<CogitaCoreReveal | null>(null);
  const [statistics, setStatistics] = useState<CogitaCoreRunStatistics | null>(null);
  const [answer, setAnswer] = useState('');
  const [promptShownUtc, setPromptShownUtc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participantKey = useMemo(() => participantStorageKey(libraryId, runId), [libraryId, runId]);

  const refreshRunState = useCallback(
    async (participantId?: string | null) => {
      const response = await getCogitaCoreRunState({ libraryId, runId, participantId: participantId ?? undefined });
      setRunState(response);
      return response;
    },
    [libraryId, runId]
  );

  const refreshStatistics = useCallback(async () => {
    const response = await getCogitaCoreRunStatistics({ libraryId, runId });
    setStatistics(response);
    return response;
  }, [libraryId, runId]);

  const initializeParticipant = useCallback(
    async (state: CogitaCoreRunState) => {
      const sharedEphemeral = state.run.runScope === 'shared';
      const existingParticipantId = !sharedEphemeral ? localStorage.getItem(participantKey) : null;
      if (sharedEphemeral) {
        localStorage.removeItem(participantKey);
      }

      if (existingParticipantId) {
        const cached = state.participants.find((item) => item.participantId === existingParticipantId);
        if (cached) {
          setParticipant(cached);
          return cached;
        }
      }

      const fallbackDisplayName = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? coreCopy.defaultParticipantName;
      const joined = await joinCogitaCoreRun({
        libraryId,
        runId,
        displayName: fallbackDisplayName,
        isHost: false
      });
      if (!sharedEphemeral) {
        localStorage.setItem(participantKey, joined.participantId);
      }
      localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, joined.displayName || fallbackDisplayName);
      setParticipant(joined);
      return joined;
    },
    [coreCopy.defaultParticipantName, libraryId, participantKey, runId]
  );

  const loadNextCard = useCallback(async (participantIdOverride?: string | null) => {
    const participantId = participantIdOverride ?? participant?.participantId ?? null;
    if (!participantId) {
      return;
    }
    const response = await getCogitaCoreNextCard({
      libraryId,
      runId,
      participantId,
      participantSeed: participantId
    });
    setNextCard(response);
    setReveal(null);
    setAnswer('');
    setPromptShownUtc(new Date().toISOString());
  }, [libraryId, participant, runId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await issueCsrf();
        if (runId === 'new') {
          const created = await createCogitaCoreRun({
            libraryId,
            runScope: 'solo',
            title: coreCopy.generatedRunTitle,
            status: 'lobby'
          });
          if (typeof window !== 'undefined') {
            window.location.hash = `#/cogita/core/runs/${encodeURIComponent(libraryId)}/${encodeURIComponent(created.runId)}`;
          }
          return;
        }

        const state = await refreshRunState();
        const joined = await initializeParticipant(state);
        if (cancelled) return;

        if (state.run.status === 'draft' || state.run.status === 'lobby') {
          await setCogitaCoreRunStatus({
            libraryId,
            runId,
            status: 'active',
            reason: 'participant-joined'
          });
        }

        const updatedState = await refreshRunState(joined.participantId);
        if (cancelled) return;
        await refreshStatistics();

        if (updatedState.run.status !== 'finished' && updatedState.run.status !== 'archived') {
          await loadNextCard(joined.participantId);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : coreCopy.initFailed;
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    coreCopy.generatedRunTitle,
    coreCopy.initFailed,
    initializeParticipant,
    libraryId,
    loadNextCard,
    refreshRunState,
    refreshStatistics,
    runId
  ]);

  const submitOutcome = useCallback(
    async (outcomeClass: 'correct' | 'wrong' | 'blank_timeout') => {
      if (!participant || !nextCard?.cardKey || typeof nextCard.roundIndex !== 'number') {
        return;
      }

      setWorking(true);
      setError(null);
      try {
        const start = promptShownUtc ? Date.parse(promptShownUtc) : Date.now();
        const duration = Number.isFinite(start) ? Math.max(0, Date.now() - start) : null;
        const result = await submitCogitaCoreRunAttempt({
          libraryId,
          runId,
          participantId: participant.participantId,
          roundIndex: nextCard.roundIndex,
          cardKey: nextCard.cardKey,
          answer: answer.trim().length > 0 ? answer.trim() : null,
          outcomeClass,
          responseDurationMs: duration,
          promptShownUtc,
          revealedUtc: new Date().toISOString()
        });

        setReveal(result.reveal);
        await Promise.all([
          refreshRunState(participant.participantId),
          refreshStatistics()
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : coreCopy.submitFailed;
        setError(message);
      } finally {
        setWorking(false);
      }
    },
    [answer, coreCopy.submitFailed, libraryId, nextCard, participant, promptShownUtc, refreshRunState, refreshStatistics, runId]
  );

  const handleNext = useCallback(async () => {
    if (!participant) return;
    setWorking(true);
    setError(null);
    try {
      await loadNextCard(participant.participantId);
      await refreshRunState(participant.participantId);
    } catch (err) {
      const message = err instanceof Error ? err.message : coreCopy.nextFailed;
      setError(message);
    } finally {
      setWorking(false);
    }
  }, [coreCopy.nextFailed, loadNextCard, participant, refreshRunState]);

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-core-run">
        <header className="cogita-core-run-header">
          <div>
            <p className="cogita-core-run-kicker">{coreCopy.kicker}</p>
            <h1>{runState?.run.title ?? `${coreCopy.defaultRunTitle} ${runId}`}</h1>
            <p>
              {coreCopy.scopeLabel}: <strong>{runState?.run.runScope ?? '-'}</strong> · {coreCopy.statusLabel}: <strong>{runState?.run.status ?? '-'}</strong>
            </p>
            {participant ? <p>{coreCopy.participantLabel}: {participant.displayName}</p> : null}
          </div>
          <div className="cogita-core-run-actions">
            <a className="ghost" href="/#/">{coreCopy.returnToRecreatio}</a>
            <a className="ghost" href="/#/cogita">{coreCopy.backToCogita}</a>
          </div>
        </header>

        {loading ? <p>{coreCopy.loading}</p> : null}
        {error ? <p className="cogita-core-run-error">{error}</p> : null}

        {!loading && nextCard?.cardKey ? (
          <article className="cogita-core-run-card">
            <p className="cogita-core-run-kicker">{coreCopy.currentPrompt}</p>
            <h2>{nextCard.cardKey}</h2>
            {nextCard.reasonTrace.length > 0 ? (
              <p className="cogita-core-run-trace">{nextCard.reasonTrace.join(' · ')}</p>
            ) : null}

            <label className="cogita-core-run-label" htmlFor="core-answer">
              {coreCopy.answerLabel}
            </label>
            <textarea
              id="core-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={working}
              placeholder={coreCopy.answerPlaceholder}
              rows={4}
            />

            <div className="cogita-core-run-outcomes">
              <button type="button" className="ghost" disabled={working} onClick={() => void submitOutcome('correct')}>
                {coreCopy.correctAction}
              </button>
              <button type="button" className="ghost" disabled={working} onClick={() => void submitOutcome('wrong')}>
                {coreCopy.wrongAction}
              </button>
              <button type="button" className="ghost" disabled={working} onClick={() => void submitOutcome('blank_timeout')}>
                {coreCopy.blankTimeoutAction}
              </button>
            </div>
          </article>
        ) : null}

        {!loading && !nextCard?.cardKey && !reveal ? (
          <article className="cogita-core-run-card">
            <p>{coreCopy.noCardSelected}</p>
            <button type="button" className="ghost" disabled={working} onClick={() => void handleNext()}>
              {coreCopy.selectNextCardAction}
            </button>
          </article>
        ) : null}

        {reveal ? (
          <article className="cogita-core-run-reveal">
            <p className="cogita-core-run-kicker">{coreCopy.revealTitle}</p>
            <h2>{reveal.cardKey}</h2>
            <p>
              {coreCopy.correctAnswerLabel}: <strong>{reveal.correctAnswer ?? '-'}</strong>
            </p>
            <p>
              {coreCopy.participantAnswerLabel}: <strong>{reveal.participantAnswer ?? '-'}</strong>
            </p>
            <p>
              {coreCopy.distributionLabel}: {reveal.outcomeDistribution.correctPct.toFixed(1)}% {coreCopy.correctLabel.toLowerCase()} · {reveal.outcomeDistribution.wrongPct.toFixed(1)}% {coreCopy.wrongLabel.toLowerCase()} ·{' '}
              {reveal.outcomeDistribution.blankTimeoutPct.toFixed(1)}% {coreCopy.blankLabel.toLowerCase()}
            </p>
            {reveal.scoreFactors.length > 0 ? (
              <p>
                {coreCopy.scoreFactorsLabel}:{' '}
                {reveal.scoreFactors
                  .map((factor) => `${factor.factor} ${factor.points >= 0 ? '+' : ''}${factor.points}`)
                  .join(' · ')}
              </p>
            ) : null}
            <p>{coreCopy.totalPointsLabel}: {reveal.totalPoints}</p>
            <button type="button" className="ghost" disabled={working} onClick={() => void handleNext()}>
              {coreCopy.nextCardAction}
            </button>
          </article>
        ) : null}

        {statistics ? (
          <article className="cogita-core-run-stats">
            <p className="cogita-core-run-kicker">{coreCopy.statsTitle}</p>
            <p>
              {coreCopy.attemptsLabel}: {statistics.totalAttempts} · {coreCopy.correctLabel}: {statistics.totalCorrect} · {coreCopy.wrongLabel}: {statistics.totalWrong} · {coreCopy.blankLabel}: {statistics.totalBlankTimeout}
            </p>
            <p>
              {coreCopy.knownessLabel}: {statistics.knownessScore.toFixed(2)}% · {coreCopy.pointsLabel}: {statistics.totalPoints}
            </p>
            {statistics.participants.length > 0 ? (
              <div className="cogita-core-run-participants">
                {statistics.participants.map((item) => (
                  <div key={item.participantId} className="cogita-core-run-participant-row">
                    <strong>{item.displayName}</strong>
                    <span>
                      {item.correctCount}/{item.attemptCount} {coreCopy.correctLabel.toLowerCase()} · {coreCopy.knownessLabel.toLowerCase()} {item.knownessScore.toFixed(1)} · {coreCopy.pointsLabel.toLowerCase()} {item.totalPoints}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </CogitaShell>
  );
}
