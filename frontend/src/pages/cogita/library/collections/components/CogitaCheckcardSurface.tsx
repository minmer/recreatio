import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  const [variant, setVariant] = useState<'a' | 'b'>('a');
  const lastTokenRef = useRef(resolvedFeedbackToken);

  useEffect(() => {
    if (lastTokenRef.current === resolvedFeedbackToken) return;
    lastTokenRef.current = resolvedFeedbackToken;
    setVariant((prev) => (prev === 'a' ? 'b' : 'a'));
  }, [resolvedFeedbackToken]);

  return (
    <section
      className={className ? `cogita-revision-card ${className}` : 'cogita-revision-card'}
      data-feedback={resolvedFeedbackToken}
      data-feedback-variant={variant}
    >
      {children}
    </section>
  );
}
