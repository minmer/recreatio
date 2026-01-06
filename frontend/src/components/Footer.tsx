import type { Copy } from '../content/types';
import type { RouteKey } from '../types/navigation';

export function Footer({ copy, onNavigate }: { copy: Copy; onNavigate: (route: RouteKey) => void }) {
  return (
    <footer className="footer">
      <div>
        <h3>{copy.footer.headline}</h3>
        <p>{copy.footer.contact}</p>
      </div>
      <div className="footer-links">
        <button type="button" onClick={() => onNavigate('legal')}>
          {copy.footer.imprint}
        </button>
        <button type="button" onClick={() => onNavigate('faq')}>
          {copy.footer.security}
        </button>
      </div>
    </footer>
  );
}
