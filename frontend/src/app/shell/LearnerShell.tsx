/**
 * 2026-11-22 — DIE KLEINE WERKSTATT: wer über den QR-Code einer Klasse ein Konto angelegt hat, sieht nur die Nauka — seine
 * Klassen, die Karte, die Lekcja, das Konto (Sprache, Wygląd, Bezpieczeństwo). Keine Seitenleiste, keine Werkzeuge, kein
 * Bereich; eine Adresse ausserhalb führt zurück auf die Startseite (`learnShellAllows`). Die ganze Werkstatt ist im Menü
 * („Pełna wersja aplikacji") — für den, der doch mehr will; zurück geht es dort über „Widok ucznia".
 */

import { lazy, Suspense, useEffect, useState } from 'react';

import { useT } from '../core/i18n';
import type { Who } from '../core/session';
import { learnShellAllows } from '../cogita/classes/classModel';
import { chooseShell } from '../cogita/classes/shellChoice';
import { viewPath, type Spot } from '../routes';
import { UiHosts } from '../ui/dialogs';
import { HeaderSlotContext } from '../ui/headerSlot';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { MenuButton } from '../ui/Menu';
import { Workspace } from '../workspace/Workspace';
import { ViewGuard } from './ViewGuard';

const LearnerHome = lazy(() => import('../cogita/classes/LearnerHome').then((m) => ({ default: m.LearnerHome })));

/** Die Startseite der kleinen Werkstatt. */
const HOME = viewPath('learn');

export default function LearnerShell({ who, spot, onSignOut, cut = false }: { who: Who; spot: Spot; onSignOut?: () => void; cut?: boolean }) {
  const t = useT();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const view = spot.kind === 'view' ? spot.view : null;
  const trail = spot.kind === 'view' ? spot.trail : [];
  const home = spot.kind !== 'view' || (view === 'learn' && trail.length === 0);
  const allowed = !home && learnShellAllows(view, trail);

  /* Eine Adresse der grossen Werkstatt (ein alter Link, ein Lesezeichen): zurück auf die Startseite. */
  useEffect(() => {
    if (!home && !allowed) window.location.hash = HOME.slice(1);
  }, [home, allowed]);

  const go = (path: string) => () => { window.location.hash = path.slice(1); };
  return (
    <div className="wk-root wk-learner" data-learner-shell="">
      <header className="wk-bar cl-bar" data-app-head="">
        <a className="wk-brandmark" href={HOME}><b>RE</b>creatio</a>{/* i18n-ignore: Marke */}
        <a className="cl-bar-title" href={HOME}>{t('cogitaClass.shell.title')}</a>
        <span className="wk-bar-fill" />
        <div className="wk-top-menu" ref={setSlot} />
        {cut && <span className="wk-bar-cut" role="status">{t('shell.alone.state.cut')}</span>}
        <MenuButton
          label={t('shell.account.menu', { login: who.loginId })}
          className="cl-me"
          trigger={<><Icon name="user" /><span className="cl-me-name">{who.loginId}</span><Icon name="more" /></>}
          items={[
            { label: t('cogitaClass.shell.home'), icon: 'home', onSelect: go(HOME) },
            { label: t('i18n.title'), icon: 'globe', onSelect: go(viewPath('account', 'jezyk')) },
            { label: t('appearance.title'), icon: 'eye', onSelect: go(viewPath('account', 'wyglad')) },
            { label: t('shell.account.security'), icon: 'shield', onSelect: go(viewPath('account', 'bezpieczenstwo')) },
            { label: t('cogitaClass.shell.full'), icon: 'grid', onSelect: () => { void chooseShell(who.accountId, 'full').then(() => { window.location.hash = '/workspace'; }); } },
            onSignOut !== undefined && { label: t('shell.account.signOut'), icon: 'logout', onSelect: onSignOut }
          ]}
        />
      </header>
      <main className="wk-main cl-main">
        <HeaderSlotContext.Provider value={slot}>
          <ViewGuard>
            <Suspense fallback={<Loading />}>
              {home || !allowed ? <LearnerHome who={who} /> : <Workspace spot={spot} who={who} />}
            </Suspense>
          </ViewGuard>
        </HeaderSlotContext.Provider>
      </main>
      <UiHosts />
    </div>
  );
}
