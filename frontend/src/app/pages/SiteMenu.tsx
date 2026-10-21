/**
 * DAS MENÜ ÜBER DER SEITE (0054) — ein Baum, wie ihn die Kanzlei im Editor
 * gebaut hat, und es gilt für die Seite und alle darunter.
 *
 * <b>Am Schreibtisch eine Leiste</b>, Untereinträge klappen darunter auf (per
 * Klick, nicht nur per Maus — ein Telefon hat keine). <b>Auf dem Telefon ein
 * Knopf „Menu"</b>, darunter der ganze Baum eingerückt: eine Leiste mit fünf
 * Einträgen passt nicht in eine Handbreite.
 *
 * <b>Wo man gerade ist, ist markiert</b> — und zwar einmal: der Eintrag, der
 * genau auf diese Seite zeigt (`aria-current="page"`), sonst der Abschnitt,
 * unter dem sie liegt. Das Dach darüber wird mitmarkiert, damit der Weg auch
 * dann zu sehen ist, wenn das Untermenü zugeklappt ist.
 *
 * <b>Seit 0056 steht dasselbe Menü auf vielen Seiten</b>, und damit ist der
 * zweite Fall der häufige: nicht jede Seite hat einen eigenen Eintrag, aber
 * jede liegt unter einem. Wer auf „parish/oaza/terminy" steht, soll „Oaza"
 * hervorgehoben sehen — die Rechnung dazu steht in `menuPath.ts`.
 */

import { useEffect, useRef, useState } from 'react';

import { hrefOf } from './menu';
import { hereIn, menuImageOf, under, type Spot } from './menuPath';
import { type MenuItem } from './page';
import { imageUrl } from './slides/slideLook';

export function SiteMenu({ items, from, here }: {
  items: readonly MenuItem[];
  /** Die Seite, die das Menü trägt — von ihr aus gelten relative Ziele. */
  from: string;
  /** Die Seite, auf der man steht. */
  here: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const nav = useRef<HTMLElement | null>(null);

  /* Ein Klick daneben oder Esc schliesst, was aufgeklappt ist. */
  useEffect(() => {
    if (open === null) return undefined;
    const onDown = (e: MouseEvent) => { if (nav.current !== null && !nav.current.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (items.length === 0) return null;

  /* Einmal für das ganze Menü: zwei Einträge können nicht beide „hier" sein. */
  const spot = hereIn(items, from, here);

  /*
     2026-10-21 — DAS ZEICHEN VORNE: ist der erste Eintrag ein Bild ohne
     Untereinträge (das Logo, das nach Hause führt), steht er vor der Leiste —
     auf dem Telefon neben „Menu", nicht erst im aufgeklappten Blatt.
  */
  const brand = menuImageOf(items[0].image) !== null && items[0].children.length === 0 ? items[0] : null;

  return (
    <nav ref={nav} className={`wk-sitemenu${mobile ? ' is-open' : ''}${brand === null ? '' : ' has-brand'}`} aria-label="Menu strony">
      {brand !== null && <Brand item={brand} from={from} current={spot !== null && spot.exact && spot.at === '0'} />}
      <button type="button" className="wk-sitemenu-toggle" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
        <span aria-hidden="true">☰</span> Menu
      </button>

      <ul className="wk-sitemenu-list">
        {items.map((item, i) => (brand !== null && i === 0 ? null : (
          <Entry key={`${i}-${item.label}`} item={item} from={from} spot={spot} depth={0}
            path={String(i)} open={open} onOpen={setOpen} />
        )))}
      </ul>
    </nav>
  );
}

/** 2026-10-21 — das Logo vorne: ein Verweis mit dem Bild, der Name ist sein Text für den Bildschirmleser. */
function Brand({ item, from, current }: { item: MenuItem; from: string; current: boolean }) {
  const href = hrefOf(item, from);
  const external = item.kind === 'url' && /^https?:/i.test(item.target);
  return (
    <a className="wk-sitemenu-brand" href={href ?? undefined} aria-current={current ? 'page' : undefined}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <img className="wk-sitemenu-logo" src={imageUrl(menuImageOf(item.image)!)} alt={item.label} />
    </a>
  );
}

function Entry({ item, from, spot, depth, path, open, onOpen }: {
  item: MenuItem;
  from: string;
  /** Wo man ist — für das ganze Menü einmal ausgerechnet. */
  spot: Spot | null;
  depth: number;
  path: string;
  open: string | null;
  onOpen: (path: string | null) => void;
}) {
  const href = hrefOf(item, from);

  /*
     „Hier" IST dieser Eintrag, wenn die Stelle er selbst ist und genau passt;
     „im Weg" ist er, wenn die Seite unter ihm liegt — als Abschnitt oder als
     Dach über dem Eintrag, der gemeint ist.
  */
  const current = spot !== null && spot.exact && spot.at === path;
  const within = spot !== null && !current && (spot.at === path || under(path, spot.at));
  const expanded = open !== null && (open === path || open.startsWith(`${path}.`));
  const external = item.kind === 'url' && /^https?:/i.test(item.target);
  /* 2026-10-21 — ein Logo statt des Namens; der Name bleibt sein Text für den Bildschirmleser. */
  const image = menuImageOf(item.image);
  const face = image === null ? item.label : <img className="wk-sitemenu-logo" src={imageUrl(image)} alt={item.label} />;

  const link = href === null ? (
    <button type="button" className={`wk-sitemenu-link${within ? ' is-within' : ''}`} aria-expanded={expanded}
      onClick={() => onOpen(expanded ? null : path)}>
      {face}<span className="wk-sitemenu-caret" aria-hidden="true">▾</span>
    </button>
  ) : (
    <a className={`wk-sitemenu-link${within ? ' is-within' : ''}`} href={href}
      aria-current={current ? 'page' : undefined}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => onOpen(null)}>
      {face}{external && <span className="wk-sitemenu-out" aria-hidden="true"> ↗</span>}
    </a>
  );

  return (
    <li className={`wk-sitemenu-item${item.children.length > 0 ? ' has-sub' : ''}${expanded ? ' is-expanded' : ''}${image === null ? '' : ' has-logo'}`}>
      <span className="wk-sitemenu-row">
        {link}
        {item.children.length > 0 && href !== null && (
          <button type="button" className="wk-sitemenu-sub" aria-expanded={expanded}
            aria-label={`${expanded ? 'Zwiń' : 'Rozwiń'}: ${item.label}`} onClick={() => onOpen(expanded ? null : path)}>
            ▾
          </button>
        )}
      </span>

      {item.children.length > 0 && (
        <ul className={`wk-sitemenu-list is-sub is-depth-${depth + 1}`}>
          {item.children.map((child, i) => (
            <Entry key={`${i}-${child.label}`} item={child} from={from} spot={spot} depth={depth + 1}
              path={`${path}.${i}`} open={open} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default SiteMenu;
