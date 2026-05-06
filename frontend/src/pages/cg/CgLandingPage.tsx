import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import '../../styles/cg.css';

interface Props {
  copy: Copy;
  onAuthAction: () => void;
  onNavigate: (route: RouteKey) => void;
}

export function CgLandingPage({ copy, onAuthAction, onNavigate }: Props) {
  const t = copy.cg.landing;

  return (
    <div className="cg-landing">
      <p className="cg-landing-logo">{t.logo}</p>

      <h1 className="cg-landing-title">
        {t.headline}<br />
        <span>{t.headlineAccent}</span>
      </h1>

      <p className="cg-landing-sub">{t.sub}</p>

      <div className="cg-landing-features">
        {t.features.map((f) => (
          <div key={f.title} className="cg-landing-feature">
            <div className="cg-landing-feature-icon">{f.icon}</div>
            <p className="cg-landing-feature-title">{f.title}</p>
            <p className="cg-landing-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="cg-landing-cta">
        <button className="cg-btn cg-btn-primary" onClick={onAuthAction} type="button">
          {t.cta}
        </button>
      </div>

      <div className="cg-landing-links">
        <button className="cg-landing-link" onClick={() => onNavigate('cogita')} type="button">
          {t.linkCogita}
        </button>
        <button className="cg-landing-link" onClick={() => onNavigate('home')} type="button">
          {t.linkHome}
        </button>
      </div>
    </div>
  );
}
