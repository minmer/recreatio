import '../../styles/cg.css';

interface Props {
  onAuthAction: () => void;
  onNavigate: (route: string) => void;
}

export function CgLandingPage({ onAuthAction, onNavigate }: Props) {
  return (
    <div className="cg-landing">
      <p className="cg-landing-logo">Cogita Graph</p>

      <h1 className="cg-landing-title">
        Your knowledge,<br />
        as a <span>connected graph</span>
      </h1>

      <p className="cg-landing-sub">
        Build vocabulary lists, phonebooks, structured lessons and anything in between
        using a flexible node-graph model. Every piece of information connects.
      </p>

      <div className="cg-landing-features">
        <div className="cg-landing-feature">
          <div className="cg-landing-feature-icon">📖</div>
          <p className="cg-landing-feature-title">Vocabulary</p>
          <p className="cg-landing-feature-desc">
            Bilingual word pairs in any language combination, ready for revision.
          </p>
        </div>
        <div className="cg-landing-feature">
          <div className="cg-landing-feature-icon">📇</div>
          <p className="cg-landing-feature-title">Phonebook</p>
          <p className="cg-landing-feature-desc">
            Contacts with multiple phones, emails and notes — always searchable.
          </p>
        </div>
        <div className="cg-landing-feature">
          <div className="cg-landing-feature-icon">🎓</div>
          <p className="cg-landing-feature-title">Lesson</p>
          <p className="cg-landing-feature-desc">
            Concepts, questions and topics wired together into a structured session.
          </p>
        </div>
        <div className="cg-landing-feature">
          <div className="cg-landing-feature-icon">◉</div>
          <p className="cg-landing-feature-title">Any graph</p>
          <p className="cg-landing-feature-desc">
            Define your own node types, fields and relationships from scratch.
          </p>
        </div>
      </div>

      <div className="cg-landing-cta">
        <button className="cg-btn cg-btn-primary" onClick={onAuthAction} type="button">
          Sign in to start
        </button>
      </div>

      <div className="cg-landing-links">
        <button className="cg-landing-link" onClick={() => onNavigate('cogita')} type="button">
          ← Back to Cogita (classic)
        </button>
        <button className="cg-landing-link" onClick={() => onNavigate('home')} type="button">
          Recreatio home
        </button>
      </div>
    </div>
  );
}
