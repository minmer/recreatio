import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getCogitaLiveRevisionPublicState, type CogitaLiveRevisionPublicState } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';

type LivePrompt = Record<string, unknown> & {
  kind?: string;
  title?: string;
  prompt?: string;
  options?: string[];
  multiple?: boolean;
  columns?: string[][];
  before?: string;
  after?: string;
};

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
  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const joinUrl = useMemo(
    () => (typeof window !== 'undefined' ? `${window.location.origin}/#/cogita/public/live-revision/${encodeURIComponent(code)}` : ''),
    [code]
  );

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

  const renderPrompt = () => {
    if (!prompt) {
      return <p className="cogita-help">{liveCopy.waitingForHostQuestion}</p>;
    }
    const kind = String(prompt.kind ?? '');
    const isRevealed = Boolean(reveal);
    const selectionExpected = Array.isArray(revealExpected)
      ? revealExpected.map((x) => Number(x)).filter(Number.isFinite)
      : [];

    if (kind === 'citation-fragment') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>
            <span style={{ opacity: 0.7 }}>{String(prompt.before ?? '')}</span>
            <strong> [ ... ] </strong>
            <span style={{ opacity: 0.7 }}>{String(prompt.after ?? '')}</span>
          </p>
          {isRevealed ? <p>{String(revealExpected ?? '')}</p> : null}
        </div>
      );
    }

    if (kind === 'text') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          {isRevealed ? <p>{String(revealExpected ?? '')}</p> : null}
        </div>
      );
    }

    if (kind === 'boolean') {
      const expected = Boolean(revealExpected);
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-form-actions">
            <button type="button" className={`cta ghost ${isRevealed && expected ? 'live-correct-answer' : ''}`} disabled>{liveCopy.trueLabel}</button>
            <button type="button" className={`cta ghost ${isRevealed && !expected ? 'live-correct-answer' : ''}`} disabled>{liveCopy.falseLabel}</button>
          </div>
        </div>
      );
    }

    if (kind === 'selection') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-share-list">
            {(Array.isArray(prompt.options) ? prompt.options : []).map((option, index) => (
              <label
                className="cogita-share-row"
                data-state={isRevealed && selectionExpected.includes(index) ? 'correct' : undefined}
                key={`${index}-${option}`}
              >
                <span>{option}</span>
                <input type={prompt.multiple ? 'checkbox' : 'radio'} disabled checked={isRevealed ? selectionExpected.includes(index) : false} readOnly />
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (kind === 'ordering') {
      const options = Array.isArray((isRevealed ? revealExpected : prompt.options))
        ? (isRevealed ? (revealExpected as unknown[]) : (prompt.options as unknown[])).map(String)
        : [];
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-share-list">
            {options.map((option, index) => (
              <div className="cogita-share-row" data-state={isRevealed ? 'correct' : undefined} key={`${index}-${option}`}>
                <span>{option}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (kind === 'matching') {
      const columns = Array.isArray(prompt.columns) ? (prompt.columns as unknown[][]) : [];
      const revealPaths = (revealExpected as { paths?: number[][] } | undefined)?.paths ?? [];
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          {isRevealed ? (
            <div className="cogita-share-list">
              {revealPaths.map((path, pathIndex) => (
                <div key={`path-${pathIndex}`} className="cogita-share-row" data-state="correct">
                  <span>
                    {path.map((selectedIndex, columnIndex) => {
                      const col = Array.isArray(columns[columnIndex]) ? columns[columnIndex] : [];
                      const label = String(col[selectedIndex] ?? selectedIndex);
                      return `${columnIndex > 0 ? ' -> ' : ''}${label}`;
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    return <p className="cogita-help">{liveCopy.unsupportedPromptType}</p>;
  };

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid cogita-live-session-layout" data-stage={state?.status === 'lobby' ? 'lobby' : 'active'}>
              <div className="cogita-library-panel">
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
                  <CogitaCheckcardSurface
                    className="cogita-live-card-container"
                    feedbackToken={reveal ? `correct-${state?.revealVersion ?? 0}` : 'idle'}
                  >
                    {renderPrompt()}
                  </CogitaCheckcardSurface>
                )}
              </div>
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
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
