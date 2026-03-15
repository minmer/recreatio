import { useEffect, useId, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type CogitaOverlayActionVariant = 'ghost' | 'cta';
type CogitaOverlaySize = 'narrow' | 'normal' | 'wide' | 'full';

export type CogitaOverlayAction = {
  key?: string;
  label: string;
  to?: string;
  onClick?: () => void;
  closeOnClick?: boolean;
  disabled?: boolean;
  title?: string;
  variant?: CogitaOverlayActionVariant;
};

export type CogitaOverlayView = {
  key: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  badge?: string;
};

export function CogitaOverlay({
  open,
  title,
  subtitle,
  description,
  closeLabel,
  onClose,
  dismissOnBackdrop = true,
  size = 'normal',
  workspaceActionLabel,
  workspaceActionTo,
  onWorkspaceAction,
  workspaceActionCloseOnClick = true,
  headerActions,
  footerActions,
  views,
  activeViewKey,
  initialViewKey,
  onViewChange,
  viewNavLabel = 'Overlay views',
  children
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  closeLabel: string;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  size?: CogitaOverlaySize;
  workspaceActionLabel?: string;
  workspaceActionTo?: string;
  onWorkspaceAction?: () => void;
  workspaceActionCloseOnClick?: boolean;
  headerActions?: CogitaOverlayAction[];
  footerActions?: CogitaOverlayAction[];
  views?: CogitaOverlayView[];
  activeViewKey?: string;
  initialViewKey?: string;
  onViewChange?: (key: string) => void;
  viewNavLabel?: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const hasViews = Array.isArray(views) && views.length > 0;
  const defaultViewKey = useMemo(() => {
    if (!hasViews || !views) return null;
    if (initialViewKey && views.some((view) => view.key === initialViewKey)) {
      return initialViewKey;
    }
    return views[0]?.key ?? null;
  }, [hasViews, initialViewKey, views]);
  const [internalViewKey, setInternalViewKey] = useState<string | null>(defaultViewKey);

  useEffect(() => {
    if (!open) return;
    setInternalViewKey(defaultViewKey);
  }, [defaultViewKey, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const resolvedViewKey = activeViewKey ?? internalViewKey;
  const activeView = hasViews && views ? views.find((view) => view.key === resolvedViewKey) ?? views[0] : null;
  const body = activeView ? activeView.content : children;

  const overlayClass = [
    'cogita-overlay',
    size === 'narrow'
      ? 'cogita-overlay--narrow'
      : size === 'wide'
        ? 'cogita-overlay--wide'
        : size === 'full'
          ? 'cogita-overlay--full'
          : 'cogita-overlay--normal'
  ].join(' ');

  const runAction = (action: CogitaOverlayAction) => {
    action.onClick?.();
    if (action.closeOnClick !== false) {
      onClose();
    }
  };

  const runActionFromLink = (event: MouseEvent<HTMLAnchorElement>, action: CogitaOverlayAction) => {
    if (action.disabled) {
      event.preventDefault();
      return;
    }
    runAction(action);
  };

  const hasWorkspaceAction = Boolean(workspaceActionLabel && (workspaceActionTo || onWorkspaceAction));
  const workspaceActionClass = 'ghost';
  const workspaceActionClick = () => {
    onWorkspaceAction?.();
    if (workspaceActionCloseOnClick) {
      onClose();
    }
  };

  const selectView = (key: string) => {
    if (onViewChange) {
      onViewChange(key);
      return;
    }
    setInternalViewKey(key);
  };

  return (
    <div
      className={overlayClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={() => {
        if (dismissOnBackdrop) {
          onClose();
        }
      }}
    >
      <section className="cogita-overlay-card" onClick={(event) => event.stopPropagation()}>
        <header className="cogita-overlay-header">
          <div className="cogita-overlay-title-wrap">
            {subtitle ? <p className="cogita-core-run-kicker">{subtitle}</p> : null}
            <h3 id={titleId}>{title}</h3>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <div className="cogita-overlay-actions">
            {hasWorkspaceAction && workspaceActionLabel ? (
              workspaceActionTo ? (
                <Link to={workspaceActionTo} className={workspaceActionClass} onClick={workspaceActionClick}>
                  {workspaceActionLabel}
                </Link>
              ) : (
                <button type="button" className={workspaceActionClass} onClick={workspaceActionClick}>
                  {workspaceActionLabel}
                </button>
              )
            ) : null}
            {headerActions?.map((action, index) => {
              const key = action.key ?? `overlay-header-action:${index}:${action.label}`;
              const className = action.variant === 'cta' ? 'cta' : 'ghost';
              if (action.to) {
                return (
                  <Link
                    key={key}
                    to={action.to}
                    className={className}
                    title={action.title}
                    onClick={(event) => runActionFromLink(event, action)}
                    aria-disabled={action.disabled ? 'true' : undefined}
                    tabIndex={action.disabled ? -1 : undefined}
                  >
                    {action.label}
                  </Link>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  title={action.title}
                  onClick={() => runAction(action)}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              );
            })}
            <button type="button" className="ghost" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </header>

        {hasViews && views ? (
          <nav className="cogita-overlay-view-nav" aria-label={viewNavLabel}>
            {views.map((view) => (
              <button
                key={view.key}
                type="button"
                className="ghost"
                onClick={() => selectView(view.key)}
                disabled={view.disabled}
                data-active={activeView?.key === view.key ? 'true' : undefined}
              >
                <span>{view.label}</span>
                {view.badge ? <small>{view.badge}</small> : null}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="cogita-overlay-body">{body}</div>

        {footerActions && footerActions.length > 0 ? (
          <footer className="cogita-overlay-footer">
            {footerActions.map((action, index) => {
              const key = action.key ?? `overlay-footer-action:${index}:${action.label}`;
              const className = action.variant === 'cta' ? 'cta' : 'ghost';
              if (action.to) {
                return (
                  <Link
                    key={key}
                    to={action.to}
                    className={className}
                    title={action.title}
                    onClick={(event) => runActionFromLink(event, action)}
                    aria-disabled={action.disabled ? 'true' : undefined}
                    tabIndex={action.disabled ? -1 : undefined}
                  >
                    {action.label}
                  </Link>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  title={action.title}
                  onClick={() => runAction(action)}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              );
            })}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
