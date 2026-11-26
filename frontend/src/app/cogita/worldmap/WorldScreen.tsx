/**
 * 2026-11-26 (Eigentümer: „die Weltkarte ist in die Schematy eingebaut — trennt beides: in der Wiedza die Eigenschaften des Schemas,
 * und eine eigene Ansicht der Weltkarte, geöffnet über einen Link; dort alles mit den Klassen") — DIE WELTKARTE ALS EIGENE SEITE der
 * Nauka: <code>#/workspace/learn/&lt;baza&gt;/swiat[/&lt;widok&gt;]</code>.
 *
 * <code>
 *   welche Karte   der Widok aus der Adresse; sonst die Teilwelt der Klasse, die dieser Tab gerade führt; sonst die Weltkarte der Baza
 *   oben          der Name, die anderen Weltkarten (die Teilwelten der Klassen), „Ustawienia widoku" (Wiedza → Schematy, für Autoren)
 *   Na żywo       jede laufende Stunde dieser Baza, wer sie führt, übernehmen, beenden, neu starten (`follow/LivePanel.tsx`)
 *   die Karte     NUR HIER führt sie die Klasse (`hosting`): die Leiste „Na żywo", „Prowadzę / Uczę się", „Prowadź tutaj", „Zadaj"
 * </code>
 * In der Wiedza (Wpisy, Schematy → Sposoby wyświetlania) steht für eine Weltkarte nur ein Link hierher (`EntityList.tsx`).
 */

import { useMemo } from 'react';

import { useT } from '../../core/i18n';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import type { Card } from '../cardBasics';
import { baseWorldViewOf, classViewOf } from '../classes/subWorld';
import { LivePanel } from '../follow/LivePanel';
import { useFollowLive } from '../follow/followHost';
import type { Learner } from '../learn';
import { useRunRewards } from '../RewardsEditor';
import { useCtx } from '../ui';
import { readView } from '../views';
import { WorldLandscape } from './WorldLandscape';
import '../follow/follow.css';

/** Ist dieser Widok eine Weltkarte? */
export const isWorldView = (data: unknown): boolean =>
  typeof data === 'object' && data !== null && ((data as { landscape?: { style?: unknown } }).landscape?.style === 'world');

export function WorldScreen({ trail, learner, cards }: { trail: readonly string[]; learner: Learner | null; cards: readonly Card[] | null }) {
  const t = useT();
  const { lib, me, writes, href } = useCtx();
  const { live } = useFollowLive();
  const views = lib.docs('view');
  const worlds = views.filter((d) => isWorldView(d.data));
  const wanted = trail[0];
  const liveHere = live !== null && live.libraryId.toLowerCase() === lib.libraryId.toLowerCase() ? live.areaId : null;
  const id = wanted !== undefined && views.some((d) => d.id === wanted) ? wanted : liveHere !== null ? classViewOf(lib, liveHere) : baseWorldViewOf(lib);
  const doc = id === null ? undefined : views.find((d) => d.id === id);
  const view = useMemo(() => (doc === undefined ? null : readView(doc.data)), [doc?.id, doc?.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const rewards = useRunRewards();
  const world = doc !== undefined && isWorldView(doc.data);

  return (
    <div className="cg cg-world-screen" data-world-screen={id ?? ''}>
      <div className="cg-world-screen-head">
        <h2 className="wk-h2">{view?.name ?? t('cogitaWorld.screen.title')}</h2>
        {worlds.length > 1 && (
          <nav className="cg-world-screen-views" aria-label={t('cogitaWorld.screen.others')}>
            {worlds.map((w) => (
              <a key={w.id} className={`wk-btn is-small${w.id === id ? '' : ' wk-btn-line'}`} aria-current={w.id === id ? 'page' : undefined} href={href('swiat', w.id)} data-world-screen-view={w.id}>
                {String((w.data as { name?: unknown }).name ?? t('cogitaWorld.screen.title'))}
              </a>
            ))}
          </nav>
        )}
        <span className="cg-world-screen-more">
          {writes && id !== null && <a className="wk-link-btn" href={href('schematy', 'wyswietlanie', id)} data-world-screen-settings=""><Icon name="branch" />{t('cogitaWorld.screen.settings')}</a>}
        </span>
      </div>
      {me !== null && <LivePanel lib={lib} me={me} />}
      {doc === undefined || view === null ? (
        <p className="wk-empty" data-world-screen-none="">
          {t('cogitaWorld.screen.none')}{' '}
          {writes && <a className="wk-link-btn" href={href('schematy', 'wyswietlanie', 'nowy')}>{t('cogitaWorld.screen.make')}</a>}
        </p>
      ) : !world ? (
        <p className="wk-note" data-world-screen-not-world="">
          {t('cogitaWorld.screen.notWorld')} <a className="wk-link-btn" href={href('wpisy', 'widok', doc.id)}>{t('cogitaWorld.screen.inEntries')}</a>
        </p>
      ) : cards === null ? <Loading label={t('cogitaViews.home.countingCards')} /> : (
        <WorldLandscape key={doc.id} view={view} cards={cards} learner={learner} viewKey={doc.id} rewards={rewards} hosting
          onOpen={(entry) => { window.location.hash = href('wpisy', entry); }} />
      )}
    </div>
  );
}
