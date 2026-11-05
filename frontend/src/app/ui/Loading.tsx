/**
 * PLATZHALTER, SOLANGE GELADEN WIRD — statt des Wortes „Wczytywanie…".
 *
 * Drei blasse Zeilen nehmen ungefähr den Platz ein, den das Geladene braucht:
 * das Bild springt nicht, wenn es kommt. Vorgelesen wird trotzdem ein Satz.
 */

import { useT } from '../core/i18n';


export function Loading({ label, lines = 3 }: { label?: string; lines?: number }) {
  const t = useT();
  return (
    <div className="ui-loading" role="status" aria-live="polite">
      {Array.from({ length: Math.max(1, Math.min(lines, 3)) }, (_, i) => <span key={i} className="ui-loading-line" />)}
      <span className="ui-loading-label">{label ?? t('common.loading')}</span>
    </div>
  );
}

export default Loading;
