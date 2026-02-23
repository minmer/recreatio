import { useEffect, useMemo, useState } from 'react';
import {
  getCogitaLiveRevisionPublicState,
  joinCogitaLiveRevision,
  submitCogitaLiveRevisionAnswer,
  type CogitaLiveRevisionPublicState
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';

type LivePrompt = Record<string, unknown> & {
  kind?: string;
  title?: string;
  prompt?: string;
  options?: string[];
  multiple?: boolean;
  inputType?: string;
  columns?: string[][];
  before?: string;
  after?: string;
  fragmentId?: string;
  roundIndex?: number;
  cardKey?: string;
};

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
  const [matchingPaths, setMatchingPaths] = useState<number[][]>([]);

  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const promptKey = useMemo(
    () => `${state?.currentRoundIndex ?? 0}:${state?.revealVersion ?? 0}:${String(prompt?.cardKey ?? '')}`,
    [prompt?.cardKey, state?.currentRoundIndex, state?.revealVersion]
  );

  useEffect(() => {
    setTextAnswer('');
    setSelectionAnswer([]);
    setBoolAnswer(null);
    setOrderingAnswer(Array.isArray(prompt?.options) ? [...(prompt.options ?? [])] : []);
    setMatchingPaths([]);
  }, [promptKey, prompt?.options]);

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

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const joined = await joinCogitaLiveRevision({ code, name: joinName });
      setParticipantToken(joined.participantToken);
      localStorage.setItem(tokenStorageKey(code), joined.participantToken);
      setStatus('ready');
    } catch {
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

  const addMatchingPath = () => {
    const columns = Array.isArray(prompt?.columns) ? prompt.columns : [];
    setMatchingPaths((prev) => [...prev, columns.map(() => 0)]);
  };

  const updateMatchingPath = (rowIndex: number, columnIndex: number, value: number) => {
    setMatchingPaths((prev) =>
      prev.map((row, ri) => (ri !== rowIndex ? row : row.map((current, ci) => (ci === columnIndex ? value : current))))
    );
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
        answer = { paths: matchingPaths };
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
            <div className="cogita-library-grid">
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">Live Revision</p>
                <h2 className="cogita-detail-title">Join session</h2>
                {!participantToken ? (
                  <>
                    <label className="cogita-field">
                      <span>Name</span>
                      <input value={joinName} onChange={(event) => setJoinName(event.target.value)} />
                    </label>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleJoin} disabled={!joinName.trim() || status === 'joining'}>
                        {status === 'joining' ? 'Joining…' : 'Join'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cogita-help">Joined. Waiting for host.</p>
                )}
                {status === 'error' ? <p className="cogita-help">Connection error or invalid session.</p> : null}
                <p className="cogita-user-kicker">Scoreboard</p>
                <div className="cogita-share-list">
                  {state?.scoreboard.map((row) => (
                    <div className="cogita-share-row" key={row.participantId}>
                      <div><strong>{row.displayName}</strong></div>
                      <div className="cogita-share-meta">{row.score} pt</div>
                    </div>
                  ))}
                  {state && state.scoreboard.length === 0 ? <p className="cogita-help">No participants yet.</p> : null}
                </div>
              </div>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">Question</p>
                <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : 'Waiting for host'}</h3>
                {prompt ? (
                  <>
                    {prompt.kind === 'citation-fragment' ? (
                      <>
                        <p>
                          <span style={{ opacity: 0.7 }}>{String(prompt.before ?? '')}</span>
                          <strong> [ ... ] </strong>
                          <span style={{ opacity: 0.7 }}>{String(prompt.after ?? '')}</span>
                        </p>
                        <label className="cogita-field">
                          <span>Fragment</span>
                          <input value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} />
                        </label>
                      </>
                    ) : null}
                    {prompt.kind === 'text' ? (
                      <>
                        <p>{String(prompt.prompt ?? '')}</p>
                        <label className="cogita-field">
                          <span>Answer</span>
                          <input
                            type={prompt.inputType === 'number' ? 'number' : prompt.inputType === 'date' ? 'date' : 'text'}
                            value={textAnswer}
                            onChange={(event) => setTextAnswer(event.target.value)}
                          />
                        </label>
                      </>
                    ) : null}
                    {prompt.kind === 'boolean' ? (
                      <>
                        <p>{String(prompt.prompt ?? '')}</p>
                        <div className="cogita-form-actions">
                          <button type="button" className="cta ghost" onClick={() => setBoolAnswer(true)}>True</button>
                          <button type="button" className="cta ghost" onClick={() => setBoolAnswer(false)}>False</button>
                        </div>
                      </>
                    ) : null}
                    {prompt.kind === 'selection' ? (
                      <>
                        <p>{String(prompt.prompt ?? '')}</p>
                        <div className="cogita-share-list">
                          {(Array.isArray(prompt.options) ? prompt.options : []).map((option, index) => (
                            <label className="cogita-share-row" key={`${index}-${option}`}>
                              <span>{option}</span>
                              <input
                                type={prompt.multiple ? 'checkbox' : 'radio'}
                                name="live-selection"
                                checked={selectionAnswer.includes(index)}
                                onChange={() => toggleSelection(index)}
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {prompt.kind === 'ordering' ? (
                      <>
                        <p>{String(prompt.prompt ?? '')}</p>
                        <div className="cogita-share-list">
                          {orderingAnswer.map((option, index) => (
                            <div className="cogita-share-row" key={`${index}-${option}`}>
                              <span>{option}</span>
                              <div className="cogita-form-actions">
                                <button type="button" className="ghost" onClick={() => moveOrdering(index, -1)}>↑</button>
                                <button type="button" className="ghost" onClick={() => moveOrdering(index, 1)}>↓</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {prompt.kind === 'matching' ? (
                      <>
                        <p>{String(prompt.prompt ?? '')}</p>
                        <div className="cogita-form-actions">
                          <button type="button" className="cta ghost" onClick={addMatchingPath}>Add path</button>
                        </div>
                        {matchingPaths.map((row, rowIndex) => (
                          <div className="cogita-form-actions" key={`path-${rowIndex}`}>
                            {(Array.isArray(prompt.columns) ? prompt.columns : []).map((column, columnIndex) => (
                              <select
                                key={`path-${rowIndex}-col-${columnIndex}`}
                                value={row[columnIndex] ?? 0}
                                onChange={(event) => updateMatchingPath(rowIndex, columnIndex, Number(event.target.value))}
                              >
                                {column.map((option, optionIndex) => (
                                  <option key={`${columnIndex}-${optionIndex}`} value={optionIndex}>
                                    {optionIndex}: {option}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        ))}
                      </>
                    ) : null}
                    <div className="cogita-form-actions">
                      <button
                        type="button"
                        className="cta"
                        onClick={submitAnswer}
                        disabled={!participantToken || !prompt.cardKey || state?.answerSubmitted}
                      >
                        {state?.answerSubmitted ? 'Submitted' : 'Submit answer'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cogita-help">Waiting for host to publish a question.</p>
                )}
                {state?.currentReveal ? (
                  <>
                    <p className="cogita-user-kicker">Reveal</p>
                    <pre className="cogita-json-preview">{JSON.stringify(state.currentReveal, null, 2)}</pre>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}

