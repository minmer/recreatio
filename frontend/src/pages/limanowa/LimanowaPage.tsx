import { useEffect, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { claimEventsLimanowaAdmin, getEventsLimanowaAdminStatus } from '../../lib/api';
import '../../styles/limanowa.css';

export function LimanowaPage({
  copy,
  onNavigate,
  showProfileMenu
}: {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
  showProfileMenu: boolean;
}) {
  const [adminStatus, setAdminStatus] = useState<{
    hasAdmin: boolean;
    isCurrentUserAdmin: boolean;
    adminDisplayName?: string | null;
  } | null>(null);
  const [adminStatusPending, setAdminStatusPending] = useState(false);
  const [adminStatusError, setAdminStatusError] = useState<string | null>(null);
  const [claimPending, setClaimPending] = useState(false);

  const loadAdminStatus = async () => {
    setAdminStatusPending(true);
    setAdminStatusError(null);
    try {
      const response = await getEventsLimanowaAdminStatus();
      setAdminStatus(response);
    } catch (error: unknown) {
      setAdminStatusError(error instanceof Error ? error.message : 'Nie udało się pobrać statusu administratora.');
    } finally {
      setAdminStatusPending(false);
    }
  };

  useEffect(() => {
    void loadAdminStatus();
  }, [showProfileMenu]);

  const handleClaimAdmin = async () => {
    setClaimPending(true);
    setAdminStatusError(null);
    try {
      await claimEventsLimanowaAdmin();
      await loadAdminStatus();
    } catch (error: unknown) {
      setAdminStatusError(error instanceof Error ? error.message : 'Nie udało się ustanowić administratora.');
    } finally {
      setClaimPending(false);
    }
  };

  return (
    <div className="portal-page limanowa-page">
      <main className="limanowa-main">
        <article className="limanowa-shell-card">
          <section className="limanowa-hero">
            <p className="tag">REcreatio</p>
            <h1>{copy.limanowa.title}</h1>
            <p>{copy.limanowa.subtitle}</p>
          </section>

          <section className="limanowa-build-card">
            <h2>{copy.limanowa.inBuildTitle}</h2>
            <p>{copy.limanowa.inBuildText}</p>
            {adminStatusPending ? <p>Sprawdzanie statusu administratora...</p> : null}
            {adminStatus ? (
              <p>
                {adminStatus.hasAdmin
                  ? `Administrator: ${adminStatus.adminDisplayName ?? 'użytkownik systemowy'}`
                  : 'Administrator dla Events + Limanowa nie jest jeszcze ustawiony.'}
              </p>
            ) : null}
            {showProfileMenu && adminStatus && !adminStatus.hasAdmin ? (
              <button className="cta" type="button" onClick={() => void handleClaimAdmin()} disabled={claimPending}>
                {claimPending ? 'Ustawianie...' : 'Ustaw mnie administratorem Events + Limanowa'}
              </button>
            ) : null}
            {adminStatusError ? <p className="pilgrimage-error">{adminStatusError}</p> : null}
          </section>
        </article>
      </main>

      <footer className="portal-footer cogita-footer limanowa-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_inv.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
        <a className="ghost limanowa-footer-home" href="/#/section-1" onClick={() => onNavigate('home')}>
          {copy.nav.home}
        </a>
      </footer>
    </div>
  );
}
