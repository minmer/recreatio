import type { Copy } from '../content/types';

export function AccountPage({ copy, showLogin }: { copy: Copy; showLogin?: () => void }) {
  return (
    <section className="account">
      <h2>{copy.account.title}</h2>
      <p className="lead">{copy.account.subtitle}</p>
      <div className="account-card">
        <p>{copy.account.placeholder}</p>
        {showLogin && (
          <button type="button" className="cta" onClick={showLogin}>
            {copy.nav.login}
          </button>
        )}
      </div>
    </section>
  );
}
