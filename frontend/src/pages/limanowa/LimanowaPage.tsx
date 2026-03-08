import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import '../../styles/limanowa.css';

export function LimanowaPage({
  copy,
  onNavigate
}: {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
}) {
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
