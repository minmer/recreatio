/**
 * DER RAHMEN DES ARBEITSPLATZES — links die Seitenleiste (am Telefon unten die
 * Leiste), oben eine schmale Kopfleiste mit Suche und Glocke, über dem Inhalt
 * der Weg (ab der zweiten Stufe). Siehe `Frame.tsx` für die beiden leichten
 * Rahmen.
 *
 * 2026-10-17 — eine eigene Datei, damit eine öffentliche Seite ihn nicht
 * mitlädt: er kommt mit dem Arbeitsplatz (`WorkspaceShell`, `lazy`).
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { Crumbs } from './Crumbs';
import { leadsNoPage } from '../workspace/desk';
import { HeaderSlotContext } from '../ui/headerSlot';
import { HeldLinkBar } from '../links/HeldLinkBar';
import { current as notifyNow, subscribe as notifySubscribe } from '../notify/notify';
import { NotifyBell } from '../notify/NotifyBell';
import { NowPlayingBar } from '../chat/NowPlayingBar';
import { PhoneBar } from './PhoneBar';
import { tilesPath, viewPath, type Spot, type View } from '../routes';
import { SEARCH_EVENT, SearchPalette } from './SearchPalette';
import type { Who } from '../core/session';
import { UiHosts } from '../ui/dialogs';
import { Icon, type IconName } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { DESK_EVENT, deskNow, useLoaded } from '../workspace/viewData';
import { ViewGuard } from './ViewGuard';
import { phoneHere, usePhoneShown } from '../phone/here';

/* -- Die Orte ----------------------------------------------------------------------------- */

export type Place = View | 'home';

export interface NavEntry {
  readonly place: Place;
  readonly label: string;
  readonly icon: IconName;
  readonly href: string;
  readonly count?: number;
}

export interface Nav {
  /** Was man jeden Tag braucht. */
  readonly main: readonly NavEntry[];
  /** Die Pfarrei: Messen, Reservierungen, Kartoteka. */
  readonly parish: readonly NavEntry[];
  /** Bibliothek und Nauka. */
  readonly knowledge: readonly NavEntry[];
  /** Für die, die bauen: alle Bausteine, Rollen, Adressen. */
  readonly settings: readonly NavEntry[];
}

const entry = (place: Place, label: string, icon: IconName, count?: number): NavEntry => ({
  place, label, icon, count: count !== undefined && count > 0 ? count : undefined,
  href: place === 'home' ? tilesPath() : viewPath(place)
});

/**
 * Was im Menü steht — und für wen.
 *
 * 0106: wer KEINE Seite führt (ein Animator, ein Kandydat mit Konto), arbeitet
 * auf Seiten, die jemand anderes vorbereitet hat; Formulare, Seiten und Werkzeuge
 * zum Bauen hätte er nur als leere Orte. Er sieht, was er braucht.
 */
export function useNav(): Nav {
  const { digest } = useSyncExternalStore(notifySubscribe, notifyNow);
  const [stamp, setStamp] = useState(0);
  useEffect(() => {
    const again = () => setStamp((n) => n + 1);
    window.addEventListener(DESK_EVENT, again);
    return () => window.removeEventListener(DESK_EVENT, again);
  }, []);
  const desk = useLoaded(() => deskNow(), [stamp]);
  const basic = desk !== undefined && desk !== null && leadsNoPage(desk);

  const chats = digest?.chats.unread ?? 0;
  const fresh = digest?.registrations.count ?? 0;
  const bookings = digest?.bookings?.count ?? 0;

  /* 2026-10-17 — SMS und Kontakte (Ausgabe „sms"): neben den Rozmowy, nicht in ihnen. Auf dem Telefon steht SMS unten in der Leiste. */
  const phone = usePhoneShown() ? [entry('sms', 'SMS', 'phone'), entry('contacts', 'Kontakty', 'users'), entry('lamps', 'Lampy', 'bulb')] : [];

  if (basic) {
    return {
      main: [entry('home', 'Teraz', 'home'), entry('calendar', 'Kalendarz', 'calendar'), entry('chat', 'Rozmowy', 'chat', chats), ...phone, entry('areas', 'Obszary', 'layers')],
      parish: [],
      knowledge: [entry('learn', 'Nauka', 'cap')],
      settings: []
    };
  }

  return {
    main: [
      entry('home', 'Teraz', 'home'),
      entry('calendar', 'Kalendarz', 'calendar'),
      entry('chat', 'Rozmowy', 'chat', chats),
      ...phone,
      entry('forms', 'Formularze', 'form', fresh),
      entry('areas', 'Obszary', 'layers'),
      entry('pages', 'Strony', 'globe')
    ],
    parish: [
      entry('masses', 'Msze i nabożeństwa', 'cross'),
      entry('bookings', 'Rezerwacje', 'key', bookings),
      entry('registry', 'Kartoteka i kolęda', 'place')
    ],
    /* 2026-10-23 — drei Teile: Źródła (Biblioteka), Pisanie (Skryptorium), Wiedza (Nauka). */
    knowledge: [entry('library', 'Biblioteka', 'book'), entry('scriptorium', 'Skryptorium', 'compose'), entry('learn', 'Nauka', 'cap')],
    settings: [entry('modules', 'Moduły', 'blocks'), entry('roles', 'Role', 'badge'), entry('addresses', 'Adresy i domeny', 'at')]
  };
}

/** Welcher Ort im Menü gerade offen ist. */
export function placeOf(spot: Spot): Place | null {
  if (spot.kind === 'tiles') return 'home';
  if (spot.kind !== 'view') return null;
  if (spot.view === 'tasks') return 'calendar';
  if (spot.view === 'widok') return 'home';
  return spot.view;
}

export const openSearch = (): void => { window.dispatchEvent(new Event(SEARCH_EVENT)); };

/** Die Buchstaben im Bild des Kontos. */
const initials = (login: string): string => {
  const words = login.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return '·';
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[1][0]}`).toUpperCase();
};

/* -- Die Seitenleiste ---------------------------------------------------------------------- */

function NavList({ entries, at }: { entries: readonly NavEntry[]; at: Place | null }) {
  return (
    <ul className="wk-nav">
      {entries.map((one) => (
        <li key={one.place}>
          <a className="wk-nav-item" href={one.href} aria-current={at === one.place ? 'page' : undefined} data-nav={one.place}>
            <Icon name={one.icon} />
            <span>{one.label}</span>
            {one.count !== undefined && <span className="wk-count" aria-label={`${one.count} nowych`}>{one.count > 99 ? '99+' : one.count}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Sidebar({ nav, spot, who, onSignOut }: { nav: Nav; spot: Spot; who: Who; onSignOut?: () => void }) {
  const at = placeOf(spot);
  const inSettings = nav.settings.some((one) => one.place === at);

  return (
    <aside className="wk-side" aria-label="Menu">
      <a className="wk-brandmark" href={tilesPath()}><b>RE</b>creatio</a>
      <nav aria-label="Warsztat">
        <NavList entries={nav.main} at={at} />
        {nav.parish.length > 0 && (
          <>
            <p className="wk-nav-label">Parafia</p>
            <NavList entries={nav.parish} at={at} />
          </>
        )}
        {nav.knowledge.length > 0 && (
          <>
            <p className="wk-nav-label">Wiedza</p>
            <NavList entries={nav.knowledge} at={at} />
          </>
        )}
      </nav>

      <div className="wk-side-foot">
        {nav.settings.length > 0 && (
          <details className="wk-nav-more" open={inSettings}>
            <summary className="wk-nav-item">
              <Icon name="settings" />
              <span>Ustawienia</span>
              <Icon name="next" className="wk-nav-chev" />
            </summary>
            <NavList entries={nav.settings} at={at} />
          </details>
        )}
        <AccountMenu who={who} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}

/** Das Konto: wer angemeldet ist — und Konto, Powiadomienia, Wyloguj. */
function AccountMenu({ who, onSignOut }: { who: Who; onSignOut?: () => void }) {
  return (
    <MenuButton
      label={`Konto: ${who.loginId}`}
      className="wk-me"
      trigger={(
        <>
          <span className="wk-avatar" aria-hidden="true">{initials(who.loginId)}</span>
          <span className="wk-me-name">{who.loginId}</span>
          <Icon name="more" />
        </>
      )}
      items={[
        { label: 'Konto i hasło', icon: 'user', onSelect: () => { window.location.hash = viewPath('account').slice(1); } },
        { label: 'Powiadomienia', icon: 'bell', onSelect: () => { window.location.hash = viewPath('account', 'widok').slice(1); } },
        { label: 'Bezpieczeństwo i klucze', icon: 'shield', onSelect: () => { window.location.hash = viewPath('account', 'bezpieczenstwo').slice(1); } },
        { label: 'Przeniesienie danych', icon: 'refresh', onSelect: () => { window.location.hash = viewPath('account', 'przeniesienie').slice(1); } },
        onSignOut !== undefined && { label: 'Wyloguj', icon: 'logout', onSelect: onSignOut }
      ]}
    />
  );
}

/* -- Der Arbeitsplatz ------------------------------------------------------------------------ */

export function WorkspaceFrame({ who, spot, onSignOut, children }: {
  who: Who;
  spot: Spot;
  onSignOut?: () => void;
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const nav = useNav();

  /* Ausgabe „sms": kurz nach dem Start das Adressbuch des Telefons auffrischen und archivieren (eigenes Bündel). */
  useEffect(() => {
    if (phoneHere()) void import('../phone/phoneJobs').then((m) => m.startPhone(who));
  }, [who]);

  return (
    <div className="wk-root wk-app">
      <Sidebar nav={nav} spot={spot} who={who} onSignOut={onSignOut} />
      <div className="wk-frame">
        <header className="wk-bar" data-app-head="">
          <a className="wk-brandmark" href={tilesPath()}><b>RE</b>creatio</a>
          <button type="button" className="wk-find" data-search-open="" onClick={openSearch}>
            <Icon name="search" />
            <span>Szukaj osób, formularzy, stron…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <span className="wk-bar-fill" />
          <div className="wk-top-menu" ref={setSlot} />
          <NowPlayingBar />
          <button type="button" className="wk-bar-btn is-phone" aria-label="Szukaj" onClick={openSearch}><Icon name="search" /></button>
          <NotifyBell who={who} />
        </header>
        <main className="wk-main">
          <HeaderSlotContext.Provider value={slot}>
            <HeldLinkBar who={who} />
            <Crumbs spot={spot} />
            <ViewGuard>{children}</ViewGuard>
          </HeaderSlotContext.Provider>
        </main>
      </div>
      <SearchPalette />
      <PhoneBar spot={spot} nav={nav} who={who} onSignOut={onSignOut} />
      <UiHosts />
    </div>
  );
}

/* -- Angemeldet, ohne Arbeitsplatz: Glocke und Konto im leichten Rahmen ------------------------- */

/** Für `PlainFrame` (ein Link, eine Bestätigung) — nachgeladen, nur wenn jemand angemeldet ist. */
export function PlainAccount({ who, onSignOut }: { who: Who; onSignOut?: () => void }) {
  return (
    <>
      <NotifyBell who={who} />
      {onSignOut !== undefined && (
        <MenuButton label={`Konto: ${who.loginId}`} icon="user" items={[
          { label: 'Warsztat', icon: 'home', onSelect: () => { window.location.hash = tilesPath().slice(1); } },
          { label: 'Wyloguj', icon: 'logout', onSelect: onSignOut }
        ]} />
      )}
    </>
  );
}

export default PlainAccount;
