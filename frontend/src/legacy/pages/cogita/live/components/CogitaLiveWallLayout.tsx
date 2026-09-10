import type { ReactNode } from 'react';
import '../../../../styles/cogita.css';
import { useScreenWakeLock } from '../useScreenWakeLock';

export function CogitaLiveWallLayout({
  title,
  subtitle,
  top,
  left,
  right,
  actions,
  className
}: {
  title: string;
  subtitle?: string;
  top?: ReactNode;
  left: ReactNode;
  right: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  useScreenWakeLock(true);

  return (
    <section className={['cogita-live-wall', className].filter(Boolean).join(' ')}>
      <header className="cogita-live-wall-header">
        <div>
          {subtitle ? <p className="cogita-user-kicker">{subtitle}</p> : null}
          <h1 className="cogita-detail-title">{title}</h1>
        </div>
        {actions ? <div className="cogita-live-wall-actions">{actions}</div> : null}
      </header>
      {top ? <div className="cogita-live-wall-top">{top}</div> : null}
      <div className="cogita-live-wall-split">
        <article className="cogita-live-wall-panel">{left}</article>
        <article className="cogita-live-wall-panel">{right}</article>
      </div>
    </section>
  );
}
