/**
 * Abschnitt 7 — fehlende Tatsachen werden SICHTBAR, nie stillschweigend.
 *
 * Der Kern des Auftrags steht in Abschnitt 0: eine Seite, die „Eröffnung im
 * Frühjahr 2027" sagt, obwohl das niemand entschieden hat, ist schlimmer als
 * eine Seite mit einer sichtbaren Lücke. Deshalb gibt es hier kein Bauteil,
 * das einen fehlenden Text durch nichts ersetzt.
 *
 * Zwei Arten von Lücke, und sie sind verschieden:
 *
 *   `SourceText` — der Absatz ist geschrieben, liegt aber beim Eigentümer.
 *                  Was fehlt, ist die ÜBERTRAGUNG hierher.
 *   `FactNeeded` — die Tatsache ist noch nicht entschieden. Was fehlt, ist
 *                  eine ENTSCHEIDUNG.
 *
 * Sie gleich darzustellen hiesse, dem Leser zu verschweigen, worauf gewartet
 * wird — und dem Eigentümer, was von ihm gebraucht wird.
 */

import { isFactNeeded, isSourceText, type Text } from './content/types';
import type { PublicCopy } from './content';

export function PublicText({
  value,
  copy,
  as = 'p'
}: {
  value: Text;
  copy: PublicCopy;
  as?: 'p' | 'span' | 'div';
}) {
  const Tag = as;

  if (isFactNeeded(value)) {
    return (
      <Tag className="pub-gap" data-gap="fact">
        <span className="pub-gap-tag">{copy.factNeeded}</span>
        <span className="pub-gap-text">{value.missing}</span>
      </Tag>
    );
  }

  if (isSourceText(value)) {
    return (
      <Tag className="pub-gap" data-gap="source">
        <span className="pub-gap-tag">{copy.sourceTextNeeded}</span>
        <span className="pub-gap-text">{value.source}</span>
      </Tag>
    );
  }

  return <Tag className="pub-p">{value}</Tag>;
}

/**
 * Ist an dieser Stelle etwas offen?
 *
 * Wird gebraucht, wo eine ganze Gruppe nur dann erscheinen soll, wenn sie
 * etwas zu sagen hat — eine Überschrift über einer Lücke ist eine Überschrift
 * über nichts.
 */
export const isOpen = (value: Text): boolean => isFactNeeded(value) || isSourceText(value);
