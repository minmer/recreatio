import type { Copy } from '../content/types';

export function CogitaPage({ copy, onLogin }: { copy: Copy; onLogin: () => void }) {
  return (
    <section className="portal cogita">
      <div className="portal-hero">
        <div>
          <p className="tag">{copy.nav.cogita}</p>
          <h2>{copy.cogita.title}</h2>
          <p className="lead">{copy.cogita.subtitle}</p>
          <div className="cogita-logo">
            <img src="/Cogita.svg" alt="Cogita" />
          </div>
          <button type="button" className="cta" onClick={onLogin}>
            {copy.cogita.loginCta}
          </button>
        </div>
        <div className="portal-card">
          <h3>{copy.cogita.title}</h3>
          <ul>
            {copy.cogita.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="note">{copy.cogita.note}</p>
        </div>
      </div>
    </section>
  );
}
