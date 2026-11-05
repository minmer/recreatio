/**
 * SZUKAJ (0094) — Ctrl K, die Lupe oben, „Szukaj" unten am Telefon und im Teil
 * „Na skróty" (Ereignis `recreatio:search`): ein Feld, und man ist dort.
 *
 * Gesammelt wird beim Öffnen, aus dem, was die Widoki ohnehin laden
 * (`viewData.ts`, 30 s im Speicher) — keine eigene Suche im Dienst: Namen von
 * Bereichen und Bausteinen kennt der Browser, versiegelte Inhalte bleiben, wo
 * sie sind.
 */

import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';

import { areaPath } from '../areas/area';
import { loadDesk } from '../workspace/desk';
import { Modal } from '../ui/Modal';
import { partLabel } from '../pages/parts/registry';
import { pageSteps, VIEWS, viewPath, type View, modulePath } from '../routes';
import { searchHits, type SearchEntry } from './search';
import { areasNow, chatsNow, modulesNow } from '../workspace/viewData';
import { chatName } from '../workspace/ViewParts';
import { usePhoneShown } from '../phone/here';
import { useT, type T } from '../core/i18n';

/*
 * 2026-11-01 — EIN NAME MIT WZORY (ein Eintrag einer Baza wiedzy, ein Dokument): gesetzt mit `TexText` — erst geladen,
 * wenn ein Treffer ein Dollarzeichen hat; bis dahin steht er als Text da. So trägt die Leiste des Warsztatu nichts davon mit.
 */
const TexText = lazy(() => import('../ui/tex/Tex').then((m) => ({ default: m.TexText })));
const HitLabel = ({ text }: { text: string }) => (text.includes('$') ? <Suspense fallback={text}><TexText text={text} /></Suspense> : <>{text}</>);

export const SEARCH_EVENT = 'recreatio:search';

/** SMS, Kontakte und Lampy nur, wo es das Telefon gibt (`usePhoneShown`). */
const PHONE_VIEWS: ReadonlySet<View> = new Set<View>(['sms', 'contacts', 'lamps']);

const viewEntry = (v: View, t: T): SearchEntry => ({ id: `view:${v}`, label: VIEWS[v], kind: t('shell.search.kind.view'), href: viewPath(v) });

/**
 * Die Teile des Arbeitsplatzes — sie stehen da, bevor etwas geladen ist. 2026-11-05: beim Öffnen gebaut, in der
 * Sprache an dieser Stelle; die Sprachwahl steht in allen drei Sprachen da, damit man sie in jeder findet.
 */
const staticEntries = (t: T): readonly SearchEntry[] => [
  ...(Object.keys(VIEWS) as View[]).filter((v) => v !== 'widok' && !PHONE_VIEWS.has(v)).map((v) => viewEntry(v, t)),
  { id: 'notify', label: t('shell.account.notifications'), kind: t('shell.nav.settings'), href: viewPath('account', 'widok'), hint: t('shell.search.hint.notify') },
  { id: 'language', label: 'Język / Sprache / Language', kind: t('shell.nav.settings'), href: viewPath('account', 'jezyk'), hint: 'język sprache language english deutsch polski' }, // i18n-ignore
  { id: 'security', label: t('shell.account.security'), kind: t('shell.nav.settings'), href: viewPath('account', 'bezpieczenstwo'), hint: t('shell.search.hint.security') },
  { id: 'transfer', label: t('shell.account.transfer'), kind: t('shell.nav.settings'), href: viewPath('account', 'przeniesienie'), hint: t('shell.search.hint.transfer') },
  { id: 'ai-access', label: t('shell.account.aiAccess'), kind: t('shell.nav.settings'), href: viewPath('account', 'dostep-ai'), hint: t('shell.search.hint.aiAccess') }
];

/** Hört auf Ctrl K und das Ereignis; zeigt das Fenster. Einmal im Kopf der Seite. */
export function SearchPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
    };
    const onAsk = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(SEARCH_EVENT, onAsk);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(SEARCH_EVENT, onAsk); };
  }, []);

  return open ? <SearchDialog onClose={() => setOpen(false)} /> : null;
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<readonly SearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [areas, modules, chats, desk, library] = await Promise.all([
        areasNow().catch(() => []), modulesNow().catch(() => []), chatsNow().catch(() => []), loadDesk().catch(() => null),
        /* 0109 — die offenen Bibliotheken; die Rechnung dazu kommt mit Cogita, erst beim Suchen. */
        import('../cogita/search').then((m) => m.libraryHits(), () => [])
      ]);
      if (!live) return;
      setFound([
        /* 2026-10-17 — der Bereich einer Rozmowa zu zweit heisst nur „Rozmowa"; gefunden wird sie selbst, mit dem Namen der anderen Seite. */
        ...areas.filter((a) => a.ownChat !== 'direct').map((a) => ({ id: `area:${a.areaId}`, label: a.name, kind: t('shell.search.kind.area'), href: viewPath('areas', a.areaId), hint: areaPath(areas, a.areaId).full })),
        ...modules.map((m) => ({ id: `module:${m.moduleId}`, label: m.name, kind: partLabel(m.kind), href: modulePath(m.kind, m.moduleId), hint: m.areaName ?? undefined })),
        ...(desk?.pages ?? []).filter((p) => p.aliasOf === null).map((p) => ({
          id: `page:${p.path}`, label: p.path === '' ? 'recreatio.pl' : p.path, kind: t('shell.search.kind.page'), href: viewPath('pages', ...pageSteps(p.path))
        })),
        ...chats.map((c) => ({ id: `chat:${c.chatId}`, label: chatName(c), kind: t('shell.search.kind.chat'), href: viewPath('chat', c.chatId) })),
        /* 0109 — was in den offenen Bibliotheken steht [F5, P12]: Einträge, Wissen, Wiederholungen, Abläufe. */
        ...library
      ]);
      setLoading(false);
    })();
    return () => { live = false; };
    // Die Widoki einmal beim Öffnen — das Fenster lebt kurz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phone = usePhoneShown();
  const hits = useMemo(() => {
    const base = staticEntries(t);
    const fixed = phone ? [...base, ...[...PHONE_VIEWS].map((v) => viewEntry(v, t))] : base;
    return query.trim() === '' ? fixed.slice(0, 8) : searchHits(query, [...fixed, ...found]);
  }, [query, found, phone, t]);
  const at = Math.min(active, Math.max(hits.length - 1, 0));

  const go = (entry: SearchEntry | undefined) => {
    if (entry === undefined) return;
    onClose();
    window.location.hash = entry.href.replace(/^#/, '');
  };

  return (
    <Modal title={t('common.search')} onClose={onClose}>
      <div className="wk-search">
        <input ref={input} type="search" className="wk-search-input" value={query} placeholder={t('shell.search.placeholder')}
          aria-label={t('shell.search.label')} aria-controls={listId} aria-activedescendant={hits.length > 0 ? `${listId}-${at}` : undefined}
          autoComplete="off" data-search-input=""
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(at + 1, hits.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(hits[at]); }
          }} />
        {query.trim() === '' && <p className="wk-hint">{t('shell.search.goTo')}</p>}
        <ul id={listId} className="wk-search-hits" role="listbox" aria-label={t('shell.search.results')}>
          {hits.map((one, i) => (
            <li key={one.id} id={`${listId}-${i}`} role="option" aria-selected={i === at} data-search-hit={one.id}>
              <a href={one.href} className={i === at ? 'is-active' : undefined} onMouseEnter={() => setActive(i)} onClick={onClose}>
                {/*
                  2026-11-01 — Einträge und Dokumente der Bibliotheken und Bazy wiedzy: ihre Wzory gesetzt (KaTeX lädt erst,
                  wenn einer da ist). Bringt ein Treffer neben `label` (gesucht wird darin) ein `display` mit — das Etikett
                  mit seinen Wzory als `$…$` —, steht dieses da.
                */}
                <span className="wk-search-label">{one.id.startsWith('entry:') || one.id.startsWith('doc:') ? <HitLabel text={one.display ?? one.label} /> : one.label}</span>
                <span className="wk-search-kind">{one.kind}{one.hint !== undefined && one.hint !== '' && one.hint !== one.label ? ` · ${one.hint}` : ''}</span>
              </a>
            </li>
          ))}
        </ul>
        {query.trim() !== '' && hits.length === 0 && <p className="wk-empty">{loading ? t('common.loading') : t('shell.search.nothing')}</p>}
      </div>
    </Modal>
  );
}

export default SearchPalette;
