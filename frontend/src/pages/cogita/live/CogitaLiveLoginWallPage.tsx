import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getCogitaLiveRevisionPublicState, type CogitaLiveRevisionPublicState } from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';

export function CogitaLiveLoginWallPage({
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
    void poll();
    const id = window.setInterval(poll, 1200);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [code]);

  return (
    <CogitaLiveWallLayout
      title={liveCopy.joinTitle}
      subtitle={liveCopy.joinKicker}
      left={
        <div className="cogita-live-wall-stack">
          <div className="cogita-field">
            <span>{liveCopy.joinCodeLabel}</span>
            <input readOnly value={code} />
          </div>
          <div className="cogita-field">
            <span>{liveCopy.joinUrlLabel}</span>
            <input readOnly value={joinUrl} />
          </div>
          <div className="cogita-live-wall-qr">
            <QRCodeSVG value={joinUrl} size={260} marginSize={2} />
          </div>
        </div>
      }
      right={
        <div className="cogita-live-wall-stack">
          <p className="cogita-user-kicker">{liveCopy.participantsTitle}</p>
          <div className="cogita-share-list">
            {(state?.scoreboard ?? []).map((row) => (
              <div className="cogita-share-row" key={row.participantId}>
                <div>
                  <strong>{row.displayName}</strong>
                </div>
                <div className="cogita-share-meta">{`${row.score} ${liveCopy.scoreUnit}`}</div>
              </div>
            ))}
            {status === 'error' ? <p>{liveCopy.connectionError}</p> : null}
            {status === 'ready' && (state?.scoreboard.length ?? 0) === 0 ? <p>{liveCopy.noParticipants}</p> : null}
          </div>
        </div>
      }
    />
  );
}

