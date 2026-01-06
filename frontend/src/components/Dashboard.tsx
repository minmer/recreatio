import type { Copy } from '../content/types';
import type { RouteKey } from '../types/navigation';

export function Dashboard({ copy, onNavigate }: { copy: Copy; onNavigate: (route: RouteKey) => void }) {
  return (
    <div className="dashboard">
      <h3>{copy.dashboard.title}</h3>
      <p>{copy.dashboard.subtitle}</p>
      <div className="dashboard-grid">
        {copy.dashboard.cards.map((card) => (
          <button
            key={card.title}
            type="button"
            className="dashboard-card"
            onClick={() => card.route && onNavigate(card.route)}
          >
            <h4>{card.title}</h4>
            <p>{card.desc}</p>
            <span>{card.action}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
