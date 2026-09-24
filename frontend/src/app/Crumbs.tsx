/**
 * Der Weg im Kopf der Seite — „Warsztat › Obszary › Parafia › Schola".
 *
 * <b>Er steht neben der Marke und nicht über dem Inhalt.</b> Oben ist die eine
 * Stelle, die auf jedem Bild dieselbe ist; ein Weg, der je nach Ansicht mal da
 * ist und mal nicht, ist keiner, auf den man sich verlässt.
 *
 * <b>Die ersten zwei Stufen weiss der Kopf selbst</b> — „Warsztat" und der Name
 * der Ansicht stehen in der Adresse. Alles Tiefere meldet die Ansicht an
 * (`crumbTrail.ts`), denn nur sie kann aus einer Kennung einen Namen machen.
 *
 * <b>Die letzte Stufe ist kein Verweis.</b> Ein Link auf die Stelle, auf der
 * man steht, sieht aus wie ein Weg weiter und ist keiner.
 *
 * <b>Wo Geschwister sind, wird der Weg zum Menü.</b> Wer in einem Unterbereich
 * steht, will meistens in den daneben — hinauf und wieder hinunter sind zwei
 * Klicks für etwas, das einer sein sollte.
 *
 * <b>Und der Pfeil geht EINE Stufe hinauf, nicht nach Hause.</b> Er stand
 * vorher im Inhalt und führte immer auf die Kacheln — aus einem Unterbereich
 * war das ein Sprung über alles hinweg, was dazwischen liegt. Hier steht er
 * am Anfang des Weges und führt dorthin, wo der Weg herkommt: auf die Stufe
 * davor. Wo es keine gibt, steht er nicht — ein Pfeil, der nirgendwohin
 * führt, ist schlimmer als keiner.
 */

import { useEffect, useRef, useState } from 'react';

import { stepUp, trailOf, useDeepCrumbs, type Crumb } from './crumbTrail';
import type { Spot } from './routes';

export function Crumbs({ spot }: { spot: Spot }) {
  const trail = trailOf(spot, useDeepCrumbs());
  const up = stepUp(trail);

  return (
    <nav className="wk-crumbs" aria-label="Gdzie jesteś">
      {up !== null && (
        <a className="wk-crumb-up" href={up} aria-label="O jeden poziom w górę">←</a>
      )}

      <ol>
        {trail.map((crumb, at) => (
          <li key={`${at}-${crumb.label}`}>
            {at > 0 && <span className="wk-crumb-sep" aria-hidden="true">›</span>}
            <Step crumb={crumb} last={at === trail.length - 1} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* -- Eine Stufe ------------------------------------------------------------ */

function Step({ crumb, last }: { crumb: Crumb; last: boolean }) {
  const beside = crumb.beside ?? [];

  const name = crumb.href === null || last
    ? <span className="wk-crumb-here" aria-current={last ? 'page' : undefined}>{crumb.label}</span>
    : <a className="wk-crumb-link" href={crumb.href}>{crumb.label}</a>;

  if (beside.length === 0) return name;

  return (
    <span className="wk-crumb-with">
      {name}
      <Beside label={crumb.label} beside={beside} />
    </span>
  );
}

/**
 * Was auf derselben Stufe noch liegt.
 *
 * <b>Eigenes Auf- und Zumachen statt `<details>`.</b> Ein `<details>` schliesst
 * sich nicht, wenn man danebenklickt — und ein Menü, das offen stehen bleibt,
 * während man längst woanders liest, verdeckt genau das.
 */
function Beside({ label, beside }: {
  label: string;
  beside: readonly { readonly label: string; readonly href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    const away = (e: MouseEvent) => {
      if (box.current !== null && !box.current.contains(e.target as Node)) setOpen(false);
    };

    /* Auch die Flucht-Taste — wer mit der Tastatur arbeitet, hat sonst keinen Weg heraus. */
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);

    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <span className="wk-crumb-beside" ref={box}>
      <button
        type="button"
        className="wk-crumb-more"
        aria-expanded={open}
        aria-label={`Obok „${label}"`}
        onClick={() => setOpen(!open)}
      >
        ▾
      </button>

      {open && (
        <ul className="wk-crumb-menu">
          {beside.map((one) => (
            <li key={one.href}>
              <a href={one.href} onClick={() => setOpen(false)}>{one.label}</a>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

export default Crumbs;
