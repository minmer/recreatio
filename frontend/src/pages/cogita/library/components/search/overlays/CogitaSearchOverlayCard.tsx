import type { ReactNode } from 'react';

export function CogitaSearchOverlayCard({
  open,
  title,
  closeLabel,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="cogita-overlay" role="dialog" aria-modal="true">
      <div className="cogita-overlay-card">
        <div className="cogita-detail-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="ghost" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
