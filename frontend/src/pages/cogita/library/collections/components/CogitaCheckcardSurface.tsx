import type { ReactNode } from 'react';

export function CogitaCheckcardSurface({
  children,
  flashState,
  flashTick = 0,
  className
}: {
  children: ReactNode;
  flashState?: 'correct' | 'incorrect' | null;
  flashTick?: number;
  className?: string;
}) {
  const feedbackToken = flashState ? `${flashState}-${flashTick}` : 'idle';
  return (
    <section
      className={className ? `cogita-revision-card ${className}` : 'cogita-revision-card'}
      data-feedback={feedbackToken}
    >
      {children}
    </section>
  );
}

