import type { Copy } from '../content/types';

export function ParishPage({ copy, onLogin }: { copy: Copy; onLogin: () => void }) {
  return (
    <section className="portal">
      <div className="portal-hero">
        <div>
          <p className="tag">{copy.nav.parish}</p>
          <h2>{copy.parish.title}</h2>
          <p className="lead">{copy.parish.subtitle}</p>
          <button type="button" className="cta" onClick={onLogin}>
            {copy.parish.loginCta}
          </button>
        </div>
        <div className="portal-card">
          <h3>{copy.parish.title}</h3>
          <ul>
            {copy.parish.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="note">{copy.parish.note}</p>
        </div>
      </div>
    </section>
  );
}
