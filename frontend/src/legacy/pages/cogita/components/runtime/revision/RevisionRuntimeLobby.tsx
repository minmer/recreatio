import { type ReactNode } from 'react';

export function RevisionRuntimeLobby({
  title,
  description,
  canSelectNext,
  onSelectNext,
  actionLabel,
  children
}: {
  title: string;
  description: string;
  canSelectNext: boolean;
  onSelectNext: () => void;
  actionLabel: string;
  children?: ReactNode;
}) {
  return (
    <article className="cogita-core-run-card">
      <p className="cogita-core-run-kicker">{title}</p>
      <p>{description}</p>
      {children}
      <button type="button" className="ghost" disabled={!canSelectNext} onClick={onSelectNext}>
        {actionLabel}
      </button>
    </article>
  );
}
