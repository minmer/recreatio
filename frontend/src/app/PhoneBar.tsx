/**
 * DER STREIFEN UNTEN AM TELEFON (0094) — fünf Wege, die man mit dem Daumen
 * erreicht: Teraz, Kalendarz, Rozmowy, Szukaj, Więcej.
 *
 * Nur im Arbeitsplatz und nur schmal (CSS, `.wk-phone-bar`): auf dem
 * Bildschirm eines Rechners stehen dieselben Wege oben und auf der Seite des
 * Warsztat. „Więcej" öffnet die Liste aller Teile — die Kacheln, die es auf
 * dem Telefon sonst nur ganz unten gäbe.
 */

import { useState, useSyncExternalStore } from 'react';

import { Modal } from './Modal';
import { current as notifyNow, subscribe as notifySubscribe } from './notify';
import { tilesPath, VIEWS, viewPath, type Spot, type View } from './routes';
import { SEARCH_EVENT } from './SearchPalette';

const MORE: readonly View[] = ['areas', 'tasks', 'modules', 'pages', 'bookings', 'masses', 'library', 'registry', 'account'];

export function PhoneBar({ spot }: { spot: Spot }) {
  const { digest } = useSyncExternalStore(notifySubscribe, notifyNow);
  const [more, setMore] = useState(false);
  const at = spot.kind === 'view' ? spot.view : spot.kind === 'tiles' ? 'home' : null;
  const unread = digest?.chats.unread ?? 0;

  return (
    <>
      <nav className="wk-phone-bar" aria-label="Na skróty">
        <a href={tilesPath()} aria-current={at === 'home' || at === 'widok' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1Z" /></svg>
          <span>Teraz</span>
        </a>
        <a href={viewPath('calendar')} aria-current={at === 'calendar' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
          <span>Kalendarz</span>
        </a>
        <a href={viewPath('chat')} aria-current={at === 'chat' ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>
          <span>Rozmowy</span>
          {unread > 0 && <span className="wk-phone-badge" aria-label={`${unread} nieprzeczytanych`}>{unread > 99 ? '99+' : unread}</span>}
        </a>
        <button type="button" onClick={() => window.dispatchEvent(new Event(SEARCH_EVENT))}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <span>Szukaj</span>
        </button>
        <button type="button" aria-expanded={more} data-phone-more="" onClick={() => setMore(true)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg>
          <span>Więcej</span>
        </button>
      </nav>

      {more && (
        <Modal title="Warsztat" onClose={() => setMore(false)}>
          <ul className="wk-phone-more">
            {MORE.map((view) => (
              <li key={view}><a href={viewPath(view)} onClick={() => setMore(false)}>{VIEWS[view]}</a></li>
            ))}
            <li><a href={viewPath('account', 'widok')} onClick={() => setMore(false)}>Wygląd warsztatu</a></li>
          </ul>
        </Modal>
      )}
    </>
  );
}

export default PhoneBar;
