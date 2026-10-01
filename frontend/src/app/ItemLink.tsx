/**
 * DER KNOPF „WIĘCEJ INFORMACJI" EINES TERMINS (0073) — überall derselbe: im
 * Kalender, in der Liste, im Programm, auf einer Seite, im Widget.
 *
 * Nur `https://…` und Seiten hier (`#/…`) werden ein Link (`safeLink`); was
 * anderes eingetragen ist, bleibt ohne Knopf. Fremde Adressen öffnen in einem
 * neuen Fenster — und aus einem Widget heraus (eine fremde Seite, ein
 * `iframe`) auch die eigenen, damit der Besucher nicht im Rähmchen landet.
 */

import { linkWord, safeLink } from './calendar';

const inFrame = (): boolean => {
  try { return window.self !== window.top; } catch { return true; }
};

export function ItemLink({ url, label, compact = false }: { url: string | null | undefined; label?: string | null; compact?: boolean }) {
  const safe = safeLink(url);
  if (safe === null) return null;
  const framed = !safe.external && inFrame();
  const href = framed ? `${window.location.origin}${window.location.pathname}${safe.href}` : safe.href;
  const away = safe.external || framed;
  return (
    <a
      className={compact ? 'wk-item-link is-compact' : 'wk-btn wk-btn-line wk-item-link'}
      href={href}
      {...(away ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={(e) => e.stopPropagation()}
    >
      {linkWord(label)}{away ? <span aria-hidden="true"> ↗</span> : null}
    </a>
  );
}
