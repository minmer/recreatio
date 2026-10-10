/**
 * SZUKAJ (0094) — Ctrl K, die Lupe oben, „Szukaj" unten am Telefon und im Teil
 * „Na skróty" (Ereignis `recreatio:search`): ein Feld, und man ist dort.
 *
 * Gesammelt wird beim Öffnen, aus dem, was die Widoki ohnehin laden
 * (`viewData.ts`, 30 s im Speicher) — keine eigene Suche im Dienst: Namen von
 * Bereichen und Bausteinen kennt der Browser, versiegelte Inhalte bleiben, wo
 * sie sind.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { areaPath } from './area';
import { loadDesk } from './desk';
import { Modal } from './Modal';
import { partLabel } from './parts/registry';
import { pageSteps, VIEWS, viewPath, type View } from './routes';
import { searchHits, type SearchEntry } from './search';
import { areasNow, chatsNow, modulesNow } from './viewData';
import { chatName } from './ViewParts';
import { useViews } from './WorkspaceHome';
import { allViews } from './workspaceViews';

export const SEARCH_EVENT = 'recreatio:search';

/** Die Teile des Arbeitsplatzes — sie stehen da, bevor etwas geladen ist. */
const STATIC: readonly SearchEntry[] = [
  ...(Object.keys(VIEWS) as View[]).filter((v) => v !== 'widok').map((v) => ({ id: `view:${v}`, label: VIEWS[v], kind: 'Część warsztatu', href: viewPath(v) })),
  { id: 'look', label: 'Wygląd warsztatu', kind: 'Ustawienia', href: viewPath('account', 'widok'), hint: 'widok prosty rozszerzony powiadomienia kolejność' }
];

export function SearchButton() {
  return (
    <button type="button" className="wk-search-btn" data-search-open="" aria-label="Szukaj (Ctrl K)" title="Szukaj (Ctrl K)"
      onClick={() => window.dispatchEvent(new Event(SEARCH_EVENT))}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
    </button>
  );
}

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
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<readonly SearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);
  const [views] = useViews();
  const input = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [areas, modules, chats, desk] = await Promise.all([
        areasNow().catch(() => []), modulesNow().catch(() => []), chatsNow().catch(() => []), loadDesk().catch(() => null)
      ]);
      if (!live) return;
      setFound([
        ...allViews(views, areas).map((v) => ({ id: `widok:${v.id}`, label: v.name, kind: 'Widok', href: viewPath('widok', v.id) })),
        ...areas.map((a) => ({ id: `area:${a.areaId}`, label: a.name, kind: 'Obszar', href: viewPath('areas', a.areaId), hint: areaPath(areas, a.areaId).full })),
        ...modules.map((m) => ({ id: `module:${m.moduleId}`, label: m.name, kind: partLabel(m.kind), href: viewPath('modules', m.kind, m.moduleId), hint: m.areaName ?? undefined })),
        ...(desk?.pages ?? []).filter((p) => p.aliasOf === null).map((p) => ({
          id: `page:${p.path}`, label: p.path === '' ? 'recreatio.pl' : p.path, kind: 'Strona', href: viewPath('pages', ...pageSteps(p.path))
        })),
        ...chats.map((c) => ({ id: `chat:${c.chatId}`, label: chatName(c), kind: 'Rozmowa', href: viewPath('chat', c.chatId) }))
      ]);
      setLoading(false);
    })();
    return () => { live = false; };
    // Die Widoki einmal beim Öffnen — das Fenster lebt kurz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hits = useMemo(
    () => (query.trim() === '' ? STATIC.slice(0, 8) : searchHits(query, [...STATIC, ...found])),
    [query, found]
  );
  const at = Math.min(active, Math.max(hits.length - 1, 0));

  const go = (entry: SearchEntry | undefined) => {
    if (entry === undefined) return;
    onClose();
    window.location.hash = entry.href.replace(/^#/, '');
  };

  return (
    <Modal title="Szukaj" onClose={onClose}>
      <div className="wk-search">
        <input ref={input} type="search" className="wk-search-input" value={query} placeholder="Obszar, formularz, strona, rozmowa…"
          aria-label="Szukaj w warsztacie" aria-controls={listId} aria-activedescendant={hits.length > 0 ? `${listId}-${at}` : undefined}
          autoComplete="off" data-search-input=""
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(at + 1, hits.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(hits[at]); }
          }} />
        {query.trim() === '' && <p className="wk-hint">Przejdź do:</p>}
        <ul id={listId} className="wk-search-hits" role="listbox" aria-label="Wyniki">
          {hits.map((one, i) => (
            <li key={one.id} id={`${listId}-${i}`} role="option" aria-selected={i === at} data-search-hit={one.id}>
              <a href={one.href} className={i === at ? 'is-active' : undefined} onMouseEnter={() => setActive(i)} onClick={onClose}>
                <span className="wk-search-label">{one.label}</span>
                <span className="wk-search-kind">{one.kind}{one.hint !== undefined && one.hint !== '' && one.hint !== one.label ? ` · ${one.hint}` : ''}</span>
              </a>
            </li>
          ))}
        </ul>
        {query.trim() !== '' && hits.length === 0 && <p className="wk-empty">{loading ? 'Wczytywanie…' : 'Nic nie znaleziono.'}</p>}
      </div>
    </Modal>
  );
}

export default SearchPalette;
