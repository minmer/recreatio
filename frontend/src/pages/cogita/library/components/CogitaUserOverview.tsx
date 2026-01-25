import { forwardRef } from 'react';
import type { Copy } from '../../../../content/types';

export const CogitaUserOverview = forwardRef<HTMLElement, {
  copy: Copy;
  totalCards: number;
  totalTags: number;
  onAccount: () => void;
  onOpenLibrary: () => void;
}>(function CogitaUserOverview({ copy, totalCards, totalTags, onAccount, onOpenLibrary }, ref) {
  return (
    <section className="cogita-section cogita-user" ref={ref}>
      <div className="cogita-user-panel">
        <p className="cogita-user-kicker">Cogita</p>
        <h1 className="cogita-user-title">{copy.cogita.title}</h1>
        <p className="cogita-user-subtitle">{copy.cogita.subtitle}</p>
        <ul className="cogita-user-list">
          {copy.cogita.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="cogita-user-note">{copy.cogita.note}</p>
        <div className="cogita-user-metrics">
          <span>{totalCards} cards ready</span>
          <span>{totalTags} tag sets</span>
        </div>
        <div className="cogita-user-actions">
          <button type="button" className="cta" onClick={onAccount}>
            {copy.nav.account}
          </button>
          <button type="button" className="cta ghost" onClick={onOpenLibrary}>
            Open index card library
          </button>
        </div>
      </div>
    </section>
  );
});
