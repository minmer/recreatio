import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getCogitaLiveRevisionPublicState, type CogitaLiveRevisionPublicState } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';

export function CogitaLiveRevisionPresenterPage(props: {
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
  const liveCopy = props.copy.cogita.library.revision.live;
  const [state, setState] = useState<CogitaLiveRevisionPublicState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [layoutMode, setLayoutMode] = useState<'window' | 'fullscreen'>('fullscreen');
  const [localViewMode, setLocalViewMode] = useState<'follow-host' | 'question' | 'score'>('follow-host');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const participantViewMode = state?.participantViewMode ?? 'question';
  const effectiveViewMode =
    localViewMode === 'follow-host'
      ? (participantViewMode === 'score' ? 'score' : 'question')
      : localViewMode;
  const stage =
    state?.status === 'finished' || state?.status === 'closed'
      ? 'finished'
      : state?.status && state.status !== 'lobby'
        ? 'active'
        : 'lobby';
  const showQuestionPanel = effectiveViewMode !== 'score';
  const showScorePanel = effectiveViewMode !== 'question' || stage === 'finished';
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
  const joinUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/#/cogita/public/live-revision/${encodeURIComponent(code)}` : ''),
    [code]
  );

  useEffect(() => {
    if (participantViewMode === 'fullscreen' && stage !== 'lobby') {
      setLayoutMode('fullscreen');
    }
  }, [participantViewMode, stage]);

  useEffect(() => {
    if (stage !== 'active' || promptTimerEndMs == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [promptTimerEndMs, stage]);

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
    poll();
    const id = window.setInterval(poll, 1200);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [code]);

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard cogita-live-layout-shell" data-layout={layoutMode}>
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-live-layout-controls cogita-live-layout-controls--global">
              <label className="cogita-field">
                <span>{liveCopy.participantViewModeLabel}</span>
                <select value={localViewMode} onChange={(event) => setLocalViewMode(event.target.value as 'follow-host' | 'question' | 'score')}>
                  <option value="follow-host">{liveCopy.participantViewFollowHost}</option>
                  <option value="question">{liveCopy.participantViewQuestion}</option>
                  <option value="score">{liveCopy.participantViewScore}</option>
                </select>
              </label>
              <label className="cogita-field">
                <span>{liveCopy.viewModeLabel}</span>
                <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as 'window' | 'fullscreen')}>
                  <option value="fullscreen">{liveCopy.viewModeFullscreen}</option>
                  <option value="window">{liveCopy.viewModeWindow}</option>
                </select>
              </label>
            </div>
            <div className="cogita-library-grid cogita-live-session-layout" data-stage={stage} data-participant-view={effectiveViewMode}>
              {showQuestionPanel ? (
              <div className={`cogita-library-panel ${participantViewMode === 'fullscreen' ? 'cogita-live-fullscreen-panel' : ''}`}>
                <p className="cogita-user-kicker">{liveCopy.hostKicker}</p>
                <h2 className="cogita-detail-title">{status === 'error' ? liveCopy.connectionError : liveCopy.statusLobby}</h2>
                {state?.status === 'lobby' ? (
                  <>
                    <div className="cogita-field"><span>{liveCopy.joinCodeLabel}</span><input readOnly value={code} /></div>
                    <div className="cogita-field"><span>{liveCopy.joinUrlLabel}</span><input readOnly value={joinUrl} /></div>
                    <div className="cogita-field">
                      <span>{liveCopy.qrLabel}</span>
                      <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: '#fff' }}>
                        <QRCodeSVG value={joinUrl} size={176} marginSize={2} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {stage === 'active' && prompt && prompt.actionTimerEnabled && promptTimerEndMs != null ? (
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
                    <CogitaCheckcardSurface
                      className="cogita-live-card-container"
                      feedbackToken={reveal ? `correct-${state?.revealVersion ?? 0}` : 'idle'}
                    >
                      <CogitaLivePromptCard
                        prompt={prompt}
                        revealExpected={revealExpected}
                        mode="readonly"
                        labels={{
                          answerLabel: props.copy.cogita.library.revision.answerLabel,
                          correctAnswerLabel: props.copy.cogita.library.revision.correctAnswerLabel,
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
                  </>
                )}
              </div>
              ) : null}
              {showScorePanel ? (
              <div className="cogita-library-panel cogita-live-scoreboard-panel">
                <p className="cogita-user-kicker">{state?.status === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle}</p>
                <div className="cogita-share-list">
                  {(state?.scoreboard ?? []).map((row) => (
                    <div className="cogita-share-row" key={`presenter-score:${row.participantId}`}>
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
