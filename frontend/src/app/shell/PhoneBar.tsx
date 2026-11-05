/**
 * DIE LEISTE UNTEN AM TELEFON (0094, 2026-10-16) — dieselben Orte wie die
 * Seitenleiste, für den Daumen: Teraz, Kalendarz, Rozmowy, Formularze (wer
 * keine Seite führt: Obszary) und „Więcej" für den Rest.
 *
 * Nur im Arbeitsplatz und nur, solange keine Seitenleiste steht (CSS,
 * `.wk-phone-bar`). „Więcej" zeigt die übrigen Orte in denselben Gruppen wie
 * links am Rechner — und das Konto. Die Suche steht oben in der Kopfleiste.
 */

import { useState } from 'react';
import { useT } from '../core/i18n';

import type { Nav, NavEntry } from './WorkspaceFrame';
import { placeOf } from './WorkspaceFrame';
import { StudiumItems } from './StudiumItems';
import { Modal } from '../ui/Modal';
import { viewPath, type Spot } from '../routes';
import type { Who } from '../core/session';
import { Icon } from '../ui/icons';

export function PhoneBar({ spot, nav, who, onSignOut }: { spot: Spot; nav: Nav; who: Who; onSignOut?: () => void }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const at = placeOf(spot);

  /* Vier Orte unten; was davon nicht unten steht, steht unter „Więcej". */
  const bar = nav.main.slice(0, 4);
  const rest = nav.main.slice(4);
  const inMore = [...rest, ...nav.parish, ...nav.knowledge, ...nav.settings].some((one) => one.place === at);

  const go = (one: NavEntry) => (
    <a key={one.place} href={one.href} aria-current={at === one.place ? 'page' : undefined} data-phone={one.place}>
      <Icon name={one.icon} />
      <span>{one.label}</span>
      {one.count !== undefined && <span className="wk-count" aria-label={t('shell.nav.newCount', { count: one.count })}>{one.count > 99 ? '99+' : one.count}</span>}
    </a>
  );

  const list = (entries: readonly NavEntry[]) => entries.map((one) => (
    <li key={one.place}>
      <a href={one.href} aria-current={at === one.place ? 'page' : undefined} onClick={() => setMore(false)}>
        <Icon name={one.icon} />
        <span>{one.label}</span>
        {one.count !== undefined && <span className="wk-count">{one.count}</span>}
      </a>
    </li>
  ));

  return (
    <>
      <nav className="wk-phone-bar" aria-label={t('shell.phone.label')}>
        {bar.map(go)}
        <button type="button" aria-expanded={more} data-phone-more="" aria-current={inMore ? 'page' : undefined} onClick={() => setMore(true)}>
          <Icon name="menu" />
          <span>{t('common.more')}</span>
        </button>
      </nav>

      {more && (
        <Modal title={t('common.more')} onClose={() => setMore(false)}>
          <ul className="wk-phone-more">
            {list(rest)}
            {nav.parish.length > 0 && <li className="wk-nav-label">{t('shell.nav.parish')}</li>}
            {list(nav.parish)}
            {nav.knowledge.length > 0 && <li className="wk-nav-label">{t('shell.nav.studium')}</li>}
            <StudiumItems entries={nav.knowledge} renderItems={list} />
            {nav.settings.length > 0 && <li className="wk-nav-label">{t('shell.nav.settings')}</li>}
            {list(nav.settings)}
            <li className="wk-nav-label">{t('shell.account.named', { login: who.loginId })}</li>
            <li><a href={viewPath('account')} onClick={() => setMore(false)}><Icon name="user" /><span>{t('shell.account.account')}</span></a></li>
            <li><a href={viewPath('account', 'widok')} onClick={() => setMore(false)}><Icon name="bell" /><span>{t('shell.account.notifications')}</span></a></li>
            {onSignOut !== undefined && (
              <li><button type="button" onClick={() => { setMore(false); onSignOut(); }}><Icon name="logout" /><span>{t('shell.account.signOut')}</span></button></li>
            )}
          </ul>
        </Modal>
      )}
    </>
  );
}

export default PhoneBar;
