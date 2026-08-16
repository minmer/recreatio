import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A full-screen layer over the reader.
 *
 * Portalled to document.body, and that is not a detail: the reader's page is a
 * transformed track, and `position: fixed` inside a transformed ancestor
 * resolves against that ancestor rather than the viewport, so an overlay left
 * inside the page would be clipped into its slide. Leaving the page also leaves
 * the `.ev` element that declares the palette, so the theme tokens are copied
 * across by value — without that every `var(--ev-…)` in here resolves to
 * nothing and the text falls back to the body colour.
 *
 * Opening pushes a history entry, so the phone's back gesture closes the layer
 * instead of leaving the event.
 */

const THEME_TOKENS = [
  '--ev-accent',
  '--ev-ink',
  '--ev-ground',
  '--ev-muted',
  '--ev-line',
  '--ev-line-2',
  '--ev-surface',
  '--ev-surface-2',
  '--ev-chrome',
  '--ev-chrome-2',
  '--ev-field',
  '--ev-on-accent'
];

/** Reads the live palette off the reader so the portal can carry it. */
export function readThemeTokens(): CSSProperties {
  const host = document.querySelector('.ev');
  if (!host) return {};

  const computed = getComputedStyle(host);
  const carried: Record<string, string> = {};
  for (const token of THEME_TOKENS) {
    const value = computed.getPropertyValue(token).trim();
    if (value.length > 0) carried[token] = value;
  }
  return carried as CSSProperties;
}

export function Fullscreen({
  label,
  onClose,
  children
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [theme] = useState<CSSProperties>(() => readThemeTokens());
  // Mounted closed for one frame, then opened: a transition needs two states,
  // and an element that appears already at its end state simply pops.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPopState = () => onClose();

    window.history.pushState({ evLayer: true }, '');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('popstate', onPopState);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
      // Closed by the button or Escape rather than by going back: drop the
      // entry we pushed, so back does not have to be pressed twice.
      if (window.history.state?.evLayer) window.history.back();
    };
  }, [onClose]);

  return createPortal(
    <div
      className={`ev-layer-full ${entered ? 'is-open' : ''}`}
      style={theme}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button type="button" className="ev-layer-close" onClick={onClose} aria-label="Zamknij">
        ✕
      </button>
      {children}
    </div>,
    document.body
  );
}
