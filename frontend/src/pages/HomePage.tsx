import type { Copy } from '../content/types';
import type { RouteKey } from '../types/navigation';

export function HomePage({
  copy,
  onNavigate,
  onPrimary,
  onSecondary,
  accessMain,
  accessPanel
}: {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
  onPrimary: () => void;
  onSecondary: () => void;
  accessMain: React.ReactNode;
  accessPanel: React.ReactNode;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="tag">ReCreatio</p>
          <h1>{copy.hero.headline}</h1>
          <p className="lead">{copy.hero.subtitle}</p>
          <div className="hero-actions">
            <button type="button" className="cta" onClick={onPrimary}>
              {copy.hero.ctaPrimary}
            </button>
            <button type="button" className="ghost" onClick={onSecondary}>
              {copy.hero.ctaSecondary}
            </button>
          </div>
        </div>
        <div className="hero-card">
          <h3>{copy.modules.title}</h3>
          <div className="module-grid">
            {copy.modules.items.map((item) => (
              <button key={item.title} type="button" className="module" onClick={() => onNavigate(item.route)}>
                <span className="module-tag">{item.tag}</span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="access">
        <div className="access-copy">
          <h2>{copy.access.title}</h2>
          <p>{copy.access.subtitle}</p>
          {accessMain}
        </div>
        {accessPanel}
      </section>
    </>
  );
}
