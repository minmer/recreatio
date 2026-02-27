import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createCogitaLiveRevisionReloginRequest,
  getCogitaLiveRevisionPublicState,
  getCogitaLiveRevisionReloginRequest,
  joinCogitaLiveRevision,
  submitCogitaLiveRevisionAnswer,
  type CogitaLiveRevisionPublicState
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';

function tokenStorageKey(code: string) {
  return `cogita.live.join.${code}`;
}

export function CogitaLiveRevisionJoinPage(props: {
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
  const { code } = props;
  const revisionCopy = props.copy.cogita.library.revision;
  const liveCopy = revisionCopy.live;
  const [joinName, setJoinName] = useState('');
  const [participantToken, setParticipantToken] = useState<string | null>(() =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(tokenStorageKey(code))
  );
  const [state, setState] = useState<CogitaLiveRevisionPublicState | null>(null);
  const [status, setStatus] = useState<'idle' | 'joining' | 'ready' | 'error'>('idle');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectionAnswer, setSelectionAnswer] = useState<number[]>([]);
  const [boolAnswer, setBoolAnswer] = useState<boolean | null>(null);
  const [orderingAnswer, setOrderingAnswer] = useState<string[]>([]);
  const [matchingRows, setMatchingRows] = useState<number[][]>([]);
  const [matchingSelection, setMatchingSelection] = useState<Array<number | null>>([]);
  const [reloginRequestId, setReloginRequestId] = useState<string | null>(null);
  const [reloginPending, setReloginPending] = useState(false);

  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const sessionStage =
    state?.status === 'finished' || state?.status === 'closed'
      ? 'finished'
      : state?.status && state.status !== 'lobby'
        ? 'active'
        : 'lobby';
  const participantViewMode = state?.participantViewMode ?? 'question';
  const showJoinPanel = participantViewMode !== 'fullscreen' || sessionStage === 'lobby' || !participantToken;
  const showQuestionPanel = participantViewMode !== 'score';
  const showScorePanel = participantViewMode !== 'question' || sessionStage === 'finished';
  const promptKey = useMemo(
    () => `${state?.currentRoundIndex ?? 0}:${state?.revealVersion ?? 0}:${String(prompt?.cardKey ?? '')}`,
    [prompt?.cardKey, state?.currentRoundIndex, state?.revealVersion]
  );

  useEffect(() => {
    setTextAnswer('');
    setSelectionAnswer([]);
    setBoolAnswer(null);
    setOrderingAnswer(Array.isArray(prompt?.options) ? [...(prompt.options ?? [])] : []);
    const matchingWidth = Array.isArray(prompt?.columns) ? Math.max(2, prompt.columns.length) : 0;
    setMatchingRows([]);
    setMatchingSelection(matchingWidth > 0 ? new Array(matchingWidth).fill(null) : []);
  }, [promptKey]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const next = await getCogitaLiveRevisionPublicState({ code, participantToken });
        if (!mounted) return;
        setState(next);
        if (participantToken) setStatus('ready');
      } catch {
        if (mounted && status !== 'joining') setStatus('error');
      }
    };
    poll();
    const id = window.setInterval(poll, 1200);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [code, participantToken, status]);

  useEffect(() => {
    if (!reloginRequestId || !reloginPending || participantToken) return;
    let canceled = false;
    const id = window.setInterval(async () => {
      try {
        const request = await getCogitaLiveRevisionReloginRequest({ code, requestId: reloginRequestId });
        if (canceled) return;
        if (request.status === 'approved') {
          setReloginPending(false);
          setStatus('idle');
        }
      } catch {
        // keep polling until approved
      }
    }, 1200);
    return () => {
      canceled = true;
      window.clearInterval(id);
    };
  }, [code, participantToken, reloginPending, reloginRequestId]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const joined = await joinCogitaLiveRevision({ code, name: joinName });
      setParticipantToken(joined.participantToken);
      localStorage.setItem(tokenStorageKey(code), joined.participantToken);
      setReloginPending(false);
      setReloginRequestId(null);
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const relogin = await createCogitaLiveRevisionReloginRequest({ code, name: joinName });
          setReloginRequestId(relogin.requestId);
          setReloginPending(true);
          setStatus('ready');
          return;
        } catch {
          setStatus('error');
          return;
        }
      }
      setStatus('error');
    }
  };

  const toggleSelection = (index: number) => {
    const multiple = Boolean(prompt?.multiple);
    if (multiple) {
      setSelectionAnswer((prev) => (prev.includes(index) ? prev.filter((x) => x !== index) : [...prev, index].sort((a, b) => a - b)));
      return;
    }
    setSelectionAnswer([index]);
  };

  const moveOrdering = (index: number, delta: -1 | 1) => {
    setOrderingAnswer((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleMatchingPick = (columnIndex: number, optionIndex: number) => {
    const columns = Array.isArray(prompt?.columns) ? prompt.columns : [];
    const width = Math.max(2, columns.length);
    setMatchingSelection((prev) => {
      const next = Array.from({ length: width }, (_, index) => prev[index] ?? null);
      next[columnIndex] = next[columnIndex] === optionIndex ? null : optionIndex;
      if (next.some((value) => value == null)) {
        return next;
      }
      const completed = next.map((value) => Number(value));
      setMatchingRows((existing) => [...existing, completed]);
      return new Array(width).fill(null);
    });
  };

  const submitAnswer = async () => {
    if (!participantToken || !prompt || typeof prompt.cardKey !== 'string') return;

    let answer: unknown = null;
    switch (prompt.kind) {
      case 'selection':
        answer = selectionAnswer;
        break;
      case 'boolean':
        answer = boolAnswer;
        break;
      case 'ordering':
        answer = orderingAnswer;
        break;
      case 'matching':
        answer = { paths: matchingRows };
        break;
      case 'citation-fragment':
      case 'text':
      default:
        answer = textAnswer;
        break;
    }

    try {
      await submitCogitaLiveRevisionAnswer({
        code,
        participantToken,
        roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
        cardKey: prompt.cardKey,
        answer
      });
      const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
      setState(refreshed);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div
              className="cogita-library-grid cogita-live-session-layout"
              data-stage={sessionStage}
              data-participant-view={participantViewMode}
            >
              {showJoinPanel ? (
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.joinKicker}</p>
                <h2 className="cogita-detail-title">{liveCopy.joinTitle}</h2>
                {!participantToken ? (
                  <>
                    <label className="cogita-field">
                      <span>{liveCopy.participantNameLabel}</span>
                      <input value={joinName} onChange={(event) => setJoinName(event.target.value)} />
                    </label>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleJoin} disabled={!joinName.trim() || status === 'joining'}>
                        {status === 'joining' ? liveCopy.joiningAction : liveCopy.joinAction}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cogita-help">{liveCopy.joinedWaiting}</p>
                )}
                {reloginPending ? (
                  <p className="cogita-help">Relogin request sent. Wait for host approval and join again.</p>
                ) : null}
                {status === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
                {sessionStage === 'lobby' ? (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.scoreboardTitle}</p>
                    <div className="cogita-share-list">
                      {state?.scoreboard.map((row) => (
                        <div className="cogita-share-row" key={row.participantId}>
                          <div><strong>{row.displayName}</strong></div>
                          <div className="cogita-share-meta">{row.score} {liveCopy.scoreUnit}</div>
                        </div>
                      ))}
                      {state && state.scoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
              ) : null}
              {showQuestionPanel ? (
              <div className={`cogita-library-panel ${participantViewMode === 'fullscreen' ? 'cogita-live-fullscreen-panel' : ''}`}>
                <p className="cogita-user-kicker">{liveCopy.questionTitle}</p>
                <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : liveCopy.waitingForPublishedRound}</h3>
                {prompt ? (
                  <>
                    <CogitaCheckcardSurface
                      className="cogita-live-card-container"
                      feedbackToken={reveal ? `correct-${state?.revealVersion ?? 0}` : 'idle'}
                    >
                      <CogitaLivePromptCard
                        prompt={prompt}
                        revealExpected={revealExpected}
                        mode="interactive"
                        labels={{
                          answerLabel: revisionCopy.answerLabel,
                          correctAnswerLabel: revisionCopy.correctAnswerLabel,
                          trueLabel: liveCopy.trueLabel,
                          falseLabel: liveCopy.falseLabel,
                          fragmentLabel: liveCopy.fragmentLabel,
                          correctFragmentLabel: liveCopy.correctFragmentLabel,
                          participantAnswerPlaceholder: liveCopy.participantAnswerPlaceholder,
                          unsupportedPromptType: liveCopy.unsupportedPromptType,
                          waitingForReveal: 'Waiting for reveal.',
                          selectedPaths: 'Selected paths',
                          removePath: 'Remove',
                          columnPrefix: 'Column'
                        }}
                        answers={{
                          text: textAnswer,
                          selection: selectionAnswer,
                          booleanAnswer: boolAnswer,
                          ordering: orderingAnswer,
                          matchingRows,
                          matchingSelection
                        }}
                        onTextChange={setTextAnswer}
                        onSelectionToggle={toggleSelection}
                        onBooleanChange={setBoolAnswer}
                        onOrderingMove={moveOrdering}
                        onMatchingPick={handleMatchingPick}
                        onMatchingRemovePath={(pathIndex) =>
                          setMatchingRows((prev) => prev.filter((_, idx) => idx !== pathIndex))
                        }
                      />
                    </CogitaCheckcardSurface>
                    <div className="cogita-form-actions">
                      <button
                        type="button"
                        className="cta"
                        onClick={submitAnswer}
                        disabled={!participantToken || !prompt.cardKey || state?.answerSubmitted}
                      >
                        {state?.answerSubmitted ? liveCopy.submitted : liveCopy.submitAnswer}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cogita-help">{liveCopy.waitingForHostQuestion}</p>
                )}
              </div>
              ) : null}
              {sessionStage !== 'lobby' && showScorePanel ? (
                <div className="cogita-library-panel cogita-live-scoreboard-panel">
                  <p className="cogita-user-kicker">{sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle}</p>
                  <div className="cogita-share-list">
                    {state?.scoreboard.map((row) => (
                      <div className="cogita-share-row" key={`score:${row.participantId}`}>
                        <div><strong>{row.displayName}</strong></div>
                        <div className="cogita-share-meta">{row.score} {liveCopy.scoreUnit}</div>
                      </div>
                    ))}
                    {state && state.scoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
