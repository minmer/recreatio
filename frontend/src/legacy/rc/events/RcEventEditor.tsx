/**
 * Strony i części — ten sam układ co w starym module.
 *
 * <b>Pasek stron u góry, ustawienia strony pod nim, części niżej.</b> Kto
 * przychodzi ze starego edytora, ma trafiać ręką w to samo miejsce: strona
 * publiczna jest jedna, wewnętrzne dokłada się przyciskiem po prawej, a kropka
 * przy nazwie mówi, która jest która.
 *
 * <b>Kolejność części to ADRES.</b> `/event/recreatio/kal26/3` znaczy „trzecia
 * część", nie „ta konkretna". Przestawienie zmienia więc, dokąd prowadzi
 * rozesłany link — i dlatego stoi to napisane, a nie tylko w serwisie.
 *
 * <b>Ten plik nie zna żadnego rodzaju części.</b> Każdy przynosi własny edytor
 * (`PART_MODULES`); dodanie rodzaju to jeden plik i wpis w rejestrze.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  rcAddPage, rcAddPart, rcEvent, type RcEventView, type RcPartKind
} from '../lib/rcEvents';
import {
  rcDeletePage, rcReorderPages, rcReorderParts, rcUpdatePage
} from '../lib/rcEventEditing';
import { parseTheme, type ThemeMode } from './shell/layers';
import { PART_MODULES } from './parts/registry';
import { TextRow } from './parts/editorKit';
import { RcPartEditor } from './RcPartEditor';
import { RcImportParts } from './RcImportParts';

type Page = RcEventView['pages'][number];

export function RcEventEditor({
  collection, slug, onError
}: {
  collection: string;
  slug: string;
  onError: (message: string) => void;
}) {
  const [view, setView] = useState<RcEventView | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [newPartKind, setNewPartKind] = useState<string>(PART_MODULES[0]?.kind ?? 'text');
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setView(await rcEvent(collection, slug)); }
    catch (e) { onError(e instanceof Error ? e.message : 'Nie udało się wczytać wydarzenia.'); }
  }, [collection, slug, onError]);

  useEffect(() => { void load(); }, [load]);

  /*
   * Jedno wywołanie, jedno przeładowanie, jeden błąd w jednym miejscu. Bez tego
   * w dwudziestu przyciskach stoi to samo try/catch/finally, a w dwudziestym
   * pierwszym brakuje `finally` — i edytor zostaje „zajęty" na zawsze.
   */
  const run = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); await load(); }
    catch (e) { onError(e instanceof Error ? e.message : 'Nie udało się zapisać.'); }
    finally { setBusy(false); }
  }, [load, onError]);

  const pages = useMemo(
    () => [...(view?.pages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [view]
  );

  const mode: ThemeMode = useMemo(
    () => parseTheme(view?.themeJson ?? null).mode,
    [view]
  );

  if (view === null) return <p className="eva-hint">Wczytywanie…</p>;

  const activePage = pages.find((p) => p.pageId === activePageId) ?? pages[0] ?? null;
  const parts = [...(activePage?.parts ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const movePart = (index: number, direction: -1 | 1) => {
    const order = parts.map((p) => p.partId);
    const to = index + direction;
    if (to < 0 || to >= order.length || activePage === null) return;
    [order[index], order[to]] = [order[to], order[index]];
    void run(() => rcReorderParts(activePage.pageId, order));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const order = pages.map((p) => p.pageId);
    const to = index + direction;
    if (to < 0 || to >= order.length) return;
    [order[index], order[to]] = [order[to], order[index]];
    void run(() => rcReorderPages(view.eventId, order));
  };

  return (
    <>
      <section className="eva-panel">
        <header>
          <h3>Strony</h3>
          <p>Strona publiczna jest jedna. Strony wewnętrzne widzi tylko ten, komu nadasz do nich dostęp.</p>
        </header>

        <div className="eva-page-tabs">
          {pages.map((page, n) => (
            <span key={page.pageId} className="eva-page-tab">
              <button
                type="button"
                className={page.pageId === activePage?.pageId ? 'active' : ''}
                onClick={() => setActivePageId(page.pageId)}
              >
                {/* Kropka mówi, która strona jest wewnętrzna — bez czytania. */}
                {page.kind === 'internal' && <span className="eva-page-mark">●</span>}
                {page.menuLabel ?? page.title}
                <span className="eva-sub">{(page.parts ?? []).length}</span>
              </button>

              <button type="button" className="eva-nudge" disabled={busy || n === 0}
                onClick={() => movePage(n, -1)} aria-label="W lewo">←</button>
              <button type="button" className="eva-nudge" disabled={busy || n === pages.length - 1}
                onClick={() => movePage(n, 1)} aria-label="W prawo">→</button>
            </span>
          ))}

          <button
            type="button"
            className="eva-add-page"
            disabled={busy}
            onClick={() => void run(async () => {
              const n = pages.filter((p) => p.kind === 'internal').length + 1;
              await rcAddPage(view.eventId, `strona-${n}`, `Strona wewnętrzna ${n}`, {
                kind: 'internal', menuLabel: `Wewnętrzna ${n}`
              });
            })}
          >
            + Strona wewnętrzna
          </button>
        </div>
      </section>

      {activePage !== null && (
        <>
          <PageSettings
            page={activePage}
            busy={busy}
            onSave={(body) => void run(() => rcUpdatePage(activePage.pageId, body))}
            onRemove={() => {
              if (!window.confirm(
                `Usunąć stronę „${activePage.menuLabel ?? activePage.title}" wraz z jej ${parts.length} częściami? Tego nie da się cofnąć.`
              )) return;
              void run(async () => {
                await rcDeletePage(activePage.pageId);
                setActivePageId(null);
              });
            }}
          />

          <section className="eva-panel">
            <header>
              <h3>Części strony „{activePage.menuLabel ?? activePage.title}”</h3>
              <p>Kolejność części to kolejność slajdów na stronie — i to, dokąd prowadzi rozesłany link.</p>
            </header>

            <div className="eva-add-part">
              <select value={newPartKind} disabled={busy}
                onChange={(e) => setNewPartKind(e.target.value)}>
                {PART_MODULES.map((module) => (
                  <option key={module.kind} value={module.kind}>
                    {module.label} — {module.description}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="eva-cta"
                disabled={busy}
                onClick={() => void run(() => {
                  const module = PART_MODULES.find((m) => m.kind === newPartKind);
                  return rcAddPart(activePage.pageId, newPartKind as RcPartKind, {
                    /*
                      Część na stronie wewnętrznej jest zapieczętowana — inaczej
                      „wewnętrzna" byłoby tylko napisem: treść leżałaby jawnie i
                      wystarczyłby adres.
                    */
                    isPublic: activePage.kind !== 'internal',
                    menuLabel: module?.label ?? newPartKind,
                    configJson: module?.defaultConfigJson()
                  });
                })}
              >
                Dodaj część
              </button>

              <button type="button" disabled={busy} onClick={() => setShowImport(!showImport)}>
                {showImport ? 'Ukryj import' : 'Importuj z JSON'}
              </button>
            </div>

            {showImport && (
              <RcImportParts
                pageId={activePage.pageId}
                pageLabel={activePage.menuLabel ?? activePage.title}
                isPublic={activePage.kind !== 'internal'}
                onImported={() => { setShowImport(false); void load(); }}
                onError={onError}
              />
            )}

            {parts.length === 0 ? (
              <p className="eva-hint">Ta strona nie ma jeszcze części.</p>
            ) : (
              <div className="eva-part-list">
                {parts.map((part, index) => (
                  <RcPartEditor
                    key={part.partId}
                    part={part}
                    mode={mode}
                    pageKind={activePage.kind === 'internal' ? 'internal' : 'public'}
                    isFirst={index === 0}
                    isLast={index === parts.length - 1}
                    onMove={(direction) => movePart(index, direction)}
                    onChanged={() => void load()}
                    onError={onError}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

/**
 * Ustawienia strony.
 *
 * <b>Strony publicznej nie da się usunąć.</b> Jest tą jedną, pod którą stoi
 * adres wydarzenia; jej brak nie byłby pustą stroną, tylko wydarzeniem, którego
 * nikt nie otworzy.
 */
function PageSettings({
  page, busy, onSave, onRemove
}: {
  page: Page;
  busy: boolean;
  onSave: (body: { title: string; menuLabel?: string | null; description?: string | null; isVisible?: boolean; kind?: string }) => void;
  onRemove: () => void;
}) {
  const [menuLabel, setMenuLabel] = useState(page.menuLabel ?? '');
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description ?? '');

  useEffect(() => {
    setMenuLabel(page.menuLabel ?? '');
    setTitle(page.title);
    setDescription(page.description ?? '');
  }, [page]);

  return (
    <section className="eva-panel">
      <header>
        <h3>Ustawienia strony</h3>
        <p>{page.kind === 'internal' ? 'Strona wewnętrzna.' : 'To jest strona publiczna wydarzenia.'}</p>
      </header>

      <div className="eva-grid">
        <TextRow label="Etykieta" value={menuLabel} onChange={setMenuLabel} />
        <TextRow label="Tytuł" value={title} onChange={setTitle} />
      </div>

      {/*
        Adres strony NIE jest tu do zmiany. Stoi w rozesłanym linku do strony
        wewnętrznej; zmiana zrywa go bez śladu, a to nie może być skutkiem
        ubocznym poprawiania tytułu.
      */}
      <p className="eva-hint">Adres: <code>/{page.slug}</code></p>

      <TextRow label="Opis" value={description} onChange={setDescription} />

      <div className="eva-actions">
        <button
          type="button"
          className="eva-cta"
          disabled={busy || title.trim() === ''}
          onClick={() => onSave({
            title: title.trim(),
            menuLabel: menuLabel.trim() || null,
            description: description.trim() || null,
            isVisible: page.isVisible
          })}
        >
          Zapisz stronę
        </button>

        {page.kind !== 'public' && (
          <button type="button" className="eva-danger" disabled={busy} onClick={onRemove}>
            Usuń stronę
          </button>
        )}
      </div>
    </section>
  );
}

export default RcEventEditor;
