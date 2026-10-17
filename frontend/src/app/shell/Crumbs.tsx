/**
 * Der Weg über dem Titel — „Formularze › Bierzmowanie 2026".
 *
 * <b>Er beginnt bei der Ansicht</b> (2026-10-16). Nach Hause führt die
 * Seitenleiste, die immer da ist; „Warsztat ›" davor war ein zweiter Weg zum
 * selben Ort. Deshalb erscheint er erst ab der zweiten Stufe: auf „Kalendarz"
 * sagt die Leiste schon, wo man ist.
 *
 * <b>Er steht über dem Titel und nicht in der Kopfleiste.</b> Dort teilte er
 * sich den Platz mit der Marke, der Suche und dem Konto und brach am Telefon
 * in eine zweite Zeile um.
 *
 * <b>Am Telefon nur eine Stufe hinauf</b> — „‹ Formularze". Der ganze Weg
 * passt dort nicht, und gebraucht wird fast immer nur der Schritt zurück. Der
 * Pfeil „←" vor dem Weg ist damit fort; zwei Pfeile für denselben Schritt
 * waren einer zu viel.
 *
 * <b>Die letzte Stufe ist kein Verweis</b>, und wo Geschwister sind, wird eine
 * Stufe zum Menü (`beside`).
 */

import { useEffect, useRef, useState } from 'react';

import { stepUp, trailOf, useDeepCrumbs, type Crumb } from './crumbTrail';
import type { Spot } from '../routes';
import { Icon } from '../ui/icons';

export function Crumbs({ spot }: { spot: Spot }) {
  const trail = trailOf(spot, useDeepCrumbs());
  if (trail.length < 2) return null;

  const up = stepUp(trail);
  const parent = [...trail.slice(0, -1)].reverse().find((one) => one.href === up);

  return (
    <nav className="wk-crumbs" aria-label="Gdzie jesteś">
      {up !== null && (
        <a className="wk-crumb-back" href={up}>
          <Icon name="prev" />
          {parent?.label ?? 'Wróć'}
        </a>
      )}

      <ol>
        {trail.map((crumb, at) => (
          <li key={`${at}-${crumb.label}`}>
            {at > 0 && <span className="wk-crumb-sep" aria-hidden="true"><Icon name="next" /></span>}
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
        <Icon name="chevron" />
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
