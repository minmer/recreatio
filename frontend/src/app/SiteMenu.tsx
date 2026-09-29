/**
 * DAS MENÜ ÜBER DER SEITE (0054) — ein Baum, wie ihn die Kanzlei im Editor
 * gebaut hat, und es gilt für die Seite und alle darunter.
 *
 * <b>Am Schreibtisch eine Leiste</b>, Untereinträge klappen darunter auf (per
 * Klick, nicht nur per Maus — ein Telefon hat keine). <b>Auf dem Telefon ein
 * Knopf „Menu"</b>, darunter der ganze Baum eingerückt: eine Leiste mit fünf
 * Einträgen passt nicht in eine Handbreite.
 *
 * Wo man gerade ist, ist markiert (`aria-current`) — auch am Dach, unter dem
 * die Seite liegt.
 */

import { useEffect, useRef, useState } from 'react';

import { hrefOf, leadsTo, registryPath, type MenuItem } from './menu';

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

  return (
    <nav ref={nav} className={`wk-sitemenu${mobile ? ' is-open' : ''}`} aria-label="Menu strony">
      <button type="button" className="wk-sitemenu-toggle" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
        <span aria-hidden="true">☰</span> Menu
      </button>

      <ul className="wk-sitemenu-list">
        {items.map((item, i) => (
          <Entry key={`${i}-${item.label}`} item={item} from={from} here={here} depth={0}
            path={String(i)} open={open} onOpen={setOpen} />
        ))}
      </ul>
    </nav>
  );
}

function Entry({ item, from, here, depth, path, open, onOpen }: {
  item: MenuItem;
  from: string;
  here: string;
  depth: number;
  path: string;
  open: string | null;
  onOpen: (path: string | null) => void;
}) {
  const href = hrefOf(item, from);
  const current = registryPath(item, from) === here;
  const within = !current && leadsTo(item, from, here);
  const expanded = open !== null && (open === path || open.startsWith(`${path}.`));
  const external = item.kind === 'url' && /^https?:/i.test(item.target);

  const link = href === null ? (
    <button type="button" className={`wk-sitemenu-link${within ? ' is-within' : ''}`} aria-expanded={expanded}
      onClick={() => onOpen(expanded ? null : path)}>
      {item.label}<span className="wk-sitemenu-caret" aria-hidden="true">▾</span>
    </button>
  ) : (
    <a className={`wk-sitemenu-link${within ? ' is-within' : ''}`} href={href}
      aria-current={current ? 'page' : undefined}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => onOpen(null)}>
      {item.label}{external && <span className="wk-sitemenu-out" aria-hidden="true"> ↗</span>}
    </a>
  );

  return (
    <li className={`wk-sitemenu-item${item.children.length > 0 ? ' has-sub' : ''}${expanded ? ' is-expanded' : ''}`}>
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
            <Entry key={`${i}-${child.label}`} item={child} from={from} here={here} depth={depth + 1}
              path={`${path}.${i}`} open={open} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default SiteMenu;
