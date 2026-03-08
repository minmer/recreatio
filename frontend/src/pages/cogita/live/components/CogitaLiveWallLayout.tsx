import type { ReactNode } from 'react';
import '../../../../styles/cogita.css';
import { useScreenWakeLock } from '../useScreenWakeLock';

export function CogitaLiveWallLayout({
  title,
  subtitle,
  left,
  right,
  actions
}: {
  title: string;
  subtitle?: string;
  left: ReactNode;
  right: ReactNode;
  actions?: ReactNode;
}) {
  useScreenWakeLock(true);

  return (
    <section className="cogita-live-wall">
      <header className="cogita-live-wall-header">
        <div>
          {subtitle ? <p className="cogita-user-kicker">{subtitle}</p> : null}
          <h1 className="cogita-detail-title">{title}</h1>
        </div>
        {actions ? <div className="cogita-live-wall-actions">{actions}</div> : null}
      </header>
      <div className="cogita-live-wall-split">
        <article className="cogita-live-wall-panel">{left}</article>
        <article className="cogita-live-wall-panel">{right}</article>
      </div>
    </section>
  );
}
