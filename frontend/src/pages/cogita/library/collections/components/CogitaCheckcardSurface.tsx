import type { ReactNode } from 'react';

export function CogitaCheckcardSurface({
  children,
  flashState,
  flashTick = 0,
  feedbackToken,
  className
}: {
  children: ReactNode;
  flashState?: 'correct' | 'incorrect' | null;
  flashTick?: number;
  feedbackToken?: string;
  className?: string;
}) {
  const resolvedFeedbackToken = feedbackToken ?? (flashState ? `${flashState}-${flashTick}` : 'idle');
  return (
    <section
      className={className ? `cogita-revision-card ${className}` : 'cogita-revision-card'}
      data-feedback={resolvedFeedbackToken}
    >
      {children}
    </section>
  );
}
