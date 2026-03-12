import { useEffect, useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function CogitaWorkspaceComponentOverlay({
  open,
  title,
  closeLabel,
  onClose,
  workspaceLinkTo,
  workspaceLinkLabel,
  children
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  workspaceLinkTo?: string;
  workspaceLinkLabel?: string;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cogita-workspace-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="cogita-workspace-overlay-card" onClick={(event) => event.stopPropagation()}>
        <div className="cogita-detail-header cogita-workspace-overlay-header">
          <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
          <div className="cogita-workspace-overlay-actions">
            {workspaceLinkTo && workspaceLinkLabel ? (
              <Link to={workspaceLinkTo} className="ghost" onClick={onClose}>
                {workspaceLinkLabel}
              </Link>
            ) : null}
            <button type="button" className="ghost" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
