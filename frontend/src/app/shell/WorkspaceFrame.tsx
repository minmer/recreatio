/**
 * DER RAHMEN DES ARBEITSPLATZES — links die Seitenleiste (am Telefon unten die
 * Leiste), oben eine schmale Kopfleiste mit Suche und Glocke, über dem Inhalt
 * der Weg (ab der zweiten Stufe). Siehe `Frame.tsx` für die beiden leichten
 * Rahmen.
 *
 * 2026-10-17 — eine eigene Datei, damit eine öffentliche Seite ihn nicht
 * mitlädt: er kommt mit dem Arbeitsplatz (`WorkspaceShell`, `lazy`).
 */

import { useT } from '../core/i18n';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { Crumbs } from './Crumbs';
import { leadsNoPage } from '../workspace/desk';
import { HeaderSlotContext } from '../ui/headerSlot';
import { HeldLinkBar } from '../links/HeldLinkBar';
import { current as notifyNow, subscribe as notifySubscribe } from '../notify/notify';
import { NotifyBell } from '../notify/NotifyBell';
import { NowPlayingBar } from '../chat/NowPlayingBar';
import { PhoneBar } from './PhoneBar';
import { StudiumItems } from './StudiumItems';
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
  /** Bibliothek, Cogita (Wiedza und Nauka), Skryptorium. */
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
  const t = useT();
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

  /* 0129–0131 — Sprawy: nur, wenn etwas wartet (oder für den Betreiber, der Meldungen entscheidet). */
  const duties = digest?.duties;
  const sprawy = duties !== undefined && (duties.count > 0 || duties.reports.isOperator || duties.takedowns.length > 0)
    ? [entry('sprawy', t('app.view.sprawy'), 'shield', duties.count)] : [];

  /* 2026-10-17 — SMS und Kontakte (Ausgabe „sms"): neben den Rozmowy, nicht in ihnen. Auf dem Telefon steht SMS unten in der Leiste. */
  const phone = usePhoneShown() ? [entry('sms', t('app.view.sms'), 'phone'), entry('contacts', t('app.view.contacts'), 'users'), entry('lamps', t('app.view.lamps'), 'bulb')] : [];

  if (basic) {
    return {
      main: [entry('home', t('shell.nav.home'), 'home'), entry('calendar', t('app.view.calendar'), 'calendar'), entry('chat', t('app.view.chat'), 'chat', chats), ...phone, entry('areas', t('app.view.areas'), 'layers'), entry('wspolnoty', t('app.view.wspolnoty'), 'users'), ...sprawy],
      parish: [],
      knowledge: [entry('knowledge', t('app.view.knowledge'), 'branch'), entry('learn', t('app.view.learn'), 'cap')],
      settings: []
    };
  }

  return {
    main: [
      entry('home', t('shell.nav.home'), 'home'),
      entry('calendar', t('app.view.calendar'), 'calendar'),
      entry('chat', t('app.view.chat'), 'chat', chats),
      ...phone,
      entry('forms', t('app.view.forms'), 'form', fresh),
      entry('areas', t('app.view.areas'), 'layers'), entry('wspolnoty', t('app.view.wspolnoty'), 'users'),
      entry('pages', t('app.view.pages'), 'globe'),
      ...sprawy
    ],
    parish: [
      entry('masses', t('app.view.masses'), 'cross'),
      entry('bookings', t('app.view.bookings'), 'key', bookings),
      entry('registry', t('app.view.registry'), 'place')
    ],
    /* Cogita groups Wiedza and Nauka between the library and Skryptorium. */
    knowledge: [entry('library', t('app.view.library'), 'book'), entry('knowledge', t('app.view.knowledge'), 'branch'), entry('learn', t('app.view.learn'), 'cap'), entry('scriptorium', t('app.view.scriptorium'), 'compose')],
    settings: [entry('modules', t('app.view.modules'), 'blocks'), entry('roles', t('app.view.roles'), 'badge'), entry('addresses', t('app.view.addresses'), 'at')]
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

function NavList({ entries, at, studium = false }: { entries: readonly NavEntry[]; at: Place | null; studium?: boolean }) {
  const t = useT();
  const renderItems = (items: readonly NavEntry[]) => items.map((one) => (
    <li key={one.place}>
      <a className="wk-nav-item" href={one.href} aria-current={at === one.place ? 'page' : undefined} data-nav={one.place}>
        <Icon name={one.icon} />
        <span>{one.label}</span>
        {one.count !== undefined && <span className="wk-count" aria-label={t('shell.nav.newCount', { count: one.count })}>{one.count > 99 ? '99+' : one.count}</span>}
      </a>
    </li>
  ));

  return (
    <ul className="wk-nav">
      {studium ? <StudiumItems entries={entries} renderItems={renderItems} /> : renderItems(entries)}
    </ul>
  );
}

function Sidebar({ nav, spot, who, onSignOut }: { nav: Nav; spot: Spot; who: Who; onSignOut?: () => void }) {
  const t = useT();
  const at = placeOf(spot);
  const inSettings = nav.settings.some((one) => one.place === at);

  return (
    <aside className="wk-side" aria-label={t('shell.frame.menu')}>
      <a className="wk-brandmark" href={tilesPath()}><b>RE</b>creatio</a>{/* i18n-ignore: Marke */}
      <nav aria-label={t('shell.account.workspace')}>
        <NavList entries={nav.main} at={at} />
        {nav.parish.length > 0 && (
          <>
            <p className="wk-nav-label">{t('shell.nav.parish')}</p>
            <NavList entries={nav.parish} at={at} />
          </>
        )}
        {nav.knowledge.length > 0 && (
          <>
            <p className="wk-nav-label">{t('shell.nav.studium')}</p>
            <NavList entries={nav.knowledge} at={at} studium />
          </>
        )}
      </nav>

      <div className="wk-side-foot">
        {nav.settings.length > 0 && (
          <details className="wk-nav-more" open={inSettings}>
            <summary className="wk-nav-item">
              <Icon name="settings" />
              <span>{t('shell.nav.settings')}</span>
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
  const t = useT();
  return (
    <MenuButton
      label={t('shell.account.menu', { login: who.loginId })}
      className="wk-me"
      trigger={(
        <>
          <span className="wk-avatar" aria-hidden="true">{initials(who.loginId)}</span>
          <span className="wk-me-name">{who.loginId}</span>
          <Icon name="more" />
        </>
      )}
      items={[
        { label: t('shell.account.account'), icon: 'user', onSelect: () => { window.location.hash = viewPath('account').slice(1); } },
        { label: t('shell.account.notifications'), icon: 'bell', onSelect: () => { window.location.hash = viewPath('account', 'widok').slice(1); } },
        { label: t('i18n.title'), icon: 'globe', onSelect: () => { window.location.hash = viewPath('account', 'jezyk').slice(1); } },
        { label: t('shell.account.security'), icon: 'shield', onSelect: () => { window.location.hash = viewPath('account', 'bezpieczenstwo').slice(1); } },
        { label: t('shell.account.transfer'), icon: 'refresh', onSelect: () => { window.location.hash = viewPath('account', 'przeniesienie').slice(1); } },
        onSignOut !== undefined && { label: t('shell.account.signOut'), icon: 'logout', onSelect: onSignOut }
      ]}
    />
  );
}

/* -- Der Arbeitsplatz ------------------------------------------------------------------------ */

export function WorkspaceFrame({ who, spot, onSignOut, cut = false, children }: {
  who: Who;
  spot: Spot;
  onSignOut?: () => void;
  /** 2026-10-28 — der Dienst antwortet gerade nicht: angemeldet bleibt man, und oben steht, was ohne Netz geht. */
  cut?: boolean;
  children: ReactNode;
}) {
  const t = useT();
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
          <a className="wk-brandmark" href={tilesPath()}><b>RE</b>creatio</a>{/* i18n-ignore: Marke */}
          <button type="button" className="wk-find" data-search-open="" onClick={openSearch}>
            <Icon name="search" />
            <span>{t('shell.frame.find')}</span>
            <kbd>{t('shell.frame.findKey')}</kbd>
          </button>
          <span className="wk-bar-fill" />
          <div className="wk-top-menu" ref={setSlot} />
          <NowPlayingBar />
          {cut && <a className="wk-bar-cut" role="status" href={viewPath('learn', 'bez-sieci')} title={t('shell.frame.cutTitle')}>{t('shell.alone.state.cut')}</a>}
          <button type="button" className="wk-bar-btn is-phone" aria-label={t('common.search')} onClick={openSearch}><Icon name="search" /></button>
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
  const t = useT();
  return (
    <>
      <NotifyBell who={who} />
      {onSignOut !== undefined && (
        <MenuButton label={t('shell.account.menu', { login: who.loginId })} icon="user" items={[
          { label: t('shell.account.workspace'), icon: 'home', onSelect: () => { window.location.hash = tilesPath().slice(1); } },
          { label: t('shell.account.signOut'), icon: 'logout', onSelect: onSignOut }
        ]} />
      )}
    </>
  );
}

export default PlainAccount;
