/**
 * Der Herausgeber: was an einer Veranstaltung gebaut wird.
 *
 * <b>Warum das keine Uebernahme aus dem alten Modul ist.</b> Dessen
 * `EventAdminPage` sind 768 Zeilen ueber einem anderen Dienst — andere
 * Kennungen, andere Aufrufe, ein Zugangslink statt eines Bereichsschluessels.
 * Sie zu uebernehmen hiesse, sie Zeile fuer Zeile umzuschreiben und danach
 * zwei Dateien zu haben, die gleich aussehen und verschieden sind.
 *
 * Was UEBERNOMMEN ist, ist das Wertvolle daran: die Teile selbst. Jede Art
 * bringt ihren eigenen Herausgeber mit (`PART_MODULES`), und dieser Rahmen
 * kennt keinen einzigen davon. Eine Art hinzuzufuegen heisst weiterhin: eine
 * Datei schreiben und sie in die Liste eintragen.
 *
 * <b>Die Reihenfolge ist die ADRESSE.</b> `/event/recreatio/kal26/3` meint den
 * dritten Teil, nicht einen bestimmten. Umsortieren verschiebt also, wohin ein
 * verschickter Link fuehrt — und deshalb steht das hier als Satz und nicht nur
 * im Dienst.
 *
 * <b>Gespeichert wird auf Knopfdruck, nicht bei jedem Tastendruck.</b> Ein
 * Herausgeber, der laufend schreibt, macht aus einem halb getippten Wort eine
 * Fassung — und aus einem Versehen eine, die schon veroeffentlicht ist.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { rcCopy, type RcLang } from '../i18n';
import {
  rcAddPage, rcAddPart, rcEvent, rcUpdatePart,
  type RcEventView, type RcPartKind
} from '../lib/rcEvents';
import {
  rcDeletePage, rcDeletePart, rcReorderPages, rcReorderParts, rcUpdatePage
} from '../lib/rcEventEditing';
import { useRcError } from '../RcThreads';
import { getPartModule, PART_MODULES } from './parts/registry';
import type { EventPart } from './parts/contracts';

type Page = RcEventView['pages'][number];

export function RcEventEditor({
  lang, collection, slug, onError
}: {
  lang: RcLang;
  collection: string;
  slug: string;
  onError: (message: string) => void;
}) {
  const describe = useRcError(lang);

  const [view, setView] = useState<RcEventView | null>(null);
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setView(await rcEvent(collection, slug)); }
    catch (e) { onError(describe(e)); }
  }, [collection, slug, describe, onError]);

  useEffect(() => { void refresh(); }, [refresh]);

  /**
   * Ein Aufruf, ein Neuladen, ein Fehler an einer Stelle.
   *
   * Ohne das steht in zwanzig Knoepfen dasselbe try/catch/finally, und beim
   * einundzwanzigsten fehlt das `finally` — der Herausgeber bleibt dann fuer
   * immer „beschaeftigt" und niemand weiss, warum.
   */
  const run = useCallback(async (work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); await refresh(); }
    catch (e) { onError(describe(e)); }
    finally { setBusy(false); }
  }, [refresh, describe, onError]);

  const pages = useMemo(
    () => [...(view?.pages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [view]
  );

  if (view === null) return <p className="rc-note">{rcCopy[lang].chat.loading}</p>;

  const page = pages.find((p) => p.pageId === openPage) ?? pages[0] ?? null;

  return (
    <div className="ee">
      <PageBar
        pages={pages}
        openId={page?.pageId ?? null}
        busy={busy}
        onOpen={setOpenPage}
        onAdd={(title, pageSlug) => void run(() => rcAddPage(view.eventId, pageSlug, title))}
        onReorder={(ids) => void run(() => rcReorderPages(view.eventId, ids))}
      />

      {page === null ? (
        <p className="rc-note">
          Diese Veranstaltung hat noch keine Seite. Leg oben die erste an — sie
          traegt die Teile.
        </p>
      ) : (
        <PagePanel
          page={page}
          busy={busy}
          onRename={(title, isVisible) => void run(() => rcUpdatePage(page.pageId, { title, isVisible }))}
          onDelete={() => void run(async () => {
            await rcDeletePage(page.pageId);
            setOpenPage(null);
          })}
          onAddPart={(kind) => void run(() => {
            const module = getPartModule(kind);
            return rcAddPart(page.pageId, kind as RcPartKind, {
              menuLabel: module?.label ?? kind,
              configJson: module?.defaultConfigJson()
            });
          })}
          onReorderParts={(ids) => void run(() => rcReorderParts(page.pageId, ids))}
          onSavePart={(partId, content) => void run(() => rcUpdatePart(partId, content))}
          onDeletePart={(partId) => void run(() => rcDeletePart(partId))}
        />
      )}
    </div>
  );
}

// -- Die Seiten ---------------------------------------------------------------

function PageBar({
  pages, openId, busy, onOpen, onAdd, onReorder
}: {
  pages: readonly Page[];
  openId: string | null;
  busy: boolean;
  onOpen: (pageId: string) => void;
  onAdd: (title: string, slug: string) => void;
  onReorder: (ids: readonly string[]) => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');

  const move = (index: number, by: number) => {
    const next = pages.map((p) => p.pageId);
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    onReorder(next);
  };

  return (
    <div className="ee-pages">
      <nav className="ee-tabs" aria-label="Strony">
        {pages.map((page, n) => (
          <span key={page.pageId} className="ee-tab-wrap">
            <button
              type="button"
              className={`ee-tab${page.pageId === openId ? ' is-active' : ''}`}
              onClick={() => onOpen(page.pageId)}
            >
              {page.title}
              {!page.isVisible && <em className="ee-hidden-mark"> — ukryta</em>}
            </button>

            {/*
              Pfeile, keine Ziehgriffe. Auf dem Telefon trifft man einen Griff
              nicht, und der Herausgeber wird oft unterwegs benutzt.
            */}
            <button type="button" className="ee-move" disabled={busy || n === 0}
              onClick={() => move(n, -1)} aria-label="W lewo">←</button>
            <button type="button" className="ee-move" disabled={busy || n === pages.length - 1}
              onClick={() => move(n, 1)} aria-label="W prawo">→</button>
          </span>
        ))}
      </nav>

      <form
        className="ee-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() === '' || slug.trim() === '') return;
          onAdd(title.trim(), slug.trim());
          setTitle(''); setSlug('');
        }}
      >
        <input type="text" value={title} placeholder="Nazwa strony" disabled={busy}
          onChange={(e) => setTitle(e.target.value)} />
        <input type="text" value={slug} placeholder="adres" disabled={busy}
          onChange={(e) => setSlug(e.target.value.toLowerCase())} />
        <button type="submit" className="rc-btn" disabled={busy || title.trim() === '' || slug.trim() === ''}>
          Dodaj stronę
        </button>
      </form>
    </div>
  );
}

// -- Eine Seite ---------------------------------------------------------------

function PagePanel({
  page, busy, onRename, onDelete, onAddPart, onReorderParts, onSavePart, onDeletePart
}: {
  page: Page;
  busy: boolean;
  onRename: (title: string, isVisible: boolean) => void;
  onDelete: () => void;
  onAddPart: (kind: string) => void;
  onReorderParts: (ids: readonly string[]) => void;
  onSavePart: (partId: string, content: {
    menuLabel?: string; title?: string; intro?: string; configJson?: string; isVisible?: boolean;
  }) => void;
  onDeletePart: (partId: string) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [visible, setVisible] = useState(page.isVisible);
  const [adding, setAdding] = useState<string>(PART_MODULES[0]?.kind ?? 'text');

  // Beim Seitenwechsel muessen die Felder der NEUEN Seite gehoeren, nicht der
  // vorigen — sonst speichert der naechste Knopf den Titel der alten.
  useEffect(() => { setTitle(page.title); setVisible(page.isVisible); },
    [page.pageId, page.title, page.isVisible]);

  const parts = [...(page.parts ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (index: number, by: number) => {
    const next = parts.map((p) => p.partId);
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    onReorderParts(next);
  };

  return (
    <section className="ee-page">
      <header className="ee-page-head">
        <input type="text" value={title} disabled={busy}
          onChange={(e) => setTitle(e.target.value)} />

        <label className="ee-check">
          <input type="checkbox" checked={visible} disabled={busy}
            onChange={(e) => setVisible(e.target.checked)} />
          <span>widoczna</span>
        </label>

        <button type="button" className="rc-btn" disabled={busy || title.trim() === ''}
          onClick={() => onRename(title.trim(), visible)}>Zapisz</button>

        {/*
          Usunięcie strony pyta raz i mówi, co zniknie. Serwis i tak odmówi,
          jeśli wiszą na niej zgłoszenia — ale kto klika, ma wiedzieć wcześniej.
        */}
        <button
          type="button"
          className="ee-danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm(
              `Usunąć stronę „${page.title}" wraz z jej ${parts.length} częściami? Tego nie da się cofnąć.`
            )) onDelete();
          }}
        >
          Usuń stronę
        </button>
      </header>

      <ol className="ee-parts">
        {parts.map((part, n) => (
          <li key={part.partId}>
            <PartPanel
              part={part}
              index={n}
              last={n === parts.length - 1}
              busy={busy}
              onMove={(by) => move(n, by)}
              onSave={(content) => onSavePart(part.partId, content)}
              onDelete={() => onDeletePart(part.partId)}
            />
          </li>
        ))}
      </ol>

      <div className="ee-add">
        <select value={adding} disabled={busy} onChange={(e) => setAdding(e.target.value)}>
          {PART_MODULES.map((module) => (
            <option key={module.kind} value={module.kind}>{module.label}</option>
          ))}
        </select>
        <button type="button" className="rc-btn" disabled={busy}
          onClick={() => onAddPart(adding)}>Dodaj część</button>
      </div>
    </section>
  );
}

// -- Ein Teil -----------------------------------------------------------------

/**
 * Ein Teil im Herausgeber.
 *
 * <b>Der eigentliche Herausgeber kommt vom Teil selbst</b> — dieser Rahmen
 * kennt keine einzige Art. Was hier steht, ist, was ALLE Teile gemeinsam haben:
 * Beschriftung im Menue, Ueberschrift, Vorspann, Sichtbarkeit, Platz.
 *
 * <b>Ein unversiegelter Teil sagt es.</b> Wer etwas oeffentlich macht, soll
 * wissen, dass es unverschluesselt liegt; es zu verschluesseln und den
 * Schluessel mitzuliefern saehe nach Schutz aus, wo keiner ist.
 */
function PartPanel({
  part, index, last, busy, onMove, onSave, onDelete
}: {
  part: EventPart;
  index: number;
  last: boolean;
  busy: boolean;
  onMove: (by: number) => void;
  onSave: (content: {
    menuLabel?: string; title?: string; intro?: string; configJson?: string; isVisible?: boolean;
  }) => void;
  onDelete: () => void;
}) {
  const module = getPartModule(part.kind);

  const [open, setOpen] = useState(false);
  const [menuLabel, setMenuLabel] = useState(part.menuLabel ?? '');
  const [title, setTitle] = useState(part.title ?? '');
  const [intro, setIntro] = useState(part.intro ?? '');
  const [configJson, setConfigJson] = useState(part.configJson ?? '');
  const [visible, setVisible] = useState(part.isVisible);

  /*
   * Ein Teil, den der Leser nicht oeffnen kann, hat weder Text noch
   * Einstellungen in der Antwort — nur `unreadable`. Ihn zu bearbeiten hiesse,
   * mit leeren Feldern ueber vorhandenen Inhalt zu schreiben.
   */
  const locked = (part.unreadable ?? null) !== null;

  return (
    <article className="ee-part" data-open={open}>
      <header className="ee-part-head">
        <span className="ee-part-n">{index + 1}</span>
        <span className="ee-part-kind">{module?.label ?? part.kind}</span>
        <span className="ee-part-label">{part.menuLabel ?? part.title ?? ''}</span>

        {!part.isPublic && <span className="ee-seal" title="Zapieczętowane kluczem obszaru">🔒</span>}
        {!part.isVisible && <em className="ee-hidden-mark">ukryta</em>}

        <button type="button" className="ee-move" disabled={busy || index === 0}
          onClick={() => onMove(-1)} aria-label="Wyżej">↑</button>
        <button type="button" className="ee-move" disabled={busy || last}
          onClick={() => onMove(1)} aria-label="Niżej">↓</button>

        <button type="button" className="rc-link" onClick={() => setOpen(!open)}>
          {open ? 'Zwiń' : 'Edytuj'}
        </button>
      </header>

      {open && (locked ? (
        <p className="rc-note">{part.unreadable}</p>
      ) : (
        <div className="ee-part-body">
          <label className="mo-field">
            <span>W menu</span>
            <input type="text" value={menuLabel} maxLength={60} disabled={busy}
              onChange={(e) => setMenuLabel(e.target.value)} />
          </label>

          <label className="mo-field">
            <span>Nagłówek</span>
            <input type="text" value={title} maxLength={200} disabled={busy}
              onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="mo-field ee-wide">
            <span>Wstęp</span>
            <textarea rows={3} value={intro} maxLength={600} disabled={busy}
              onChange={(e) => setIntro(e.target.value)} />
          </label>

          {/*
            Der Herausgeber der Art. Er bekommt das JSON und gibt es zurueck —
            der Rahmen sieht hinein nicht.
          */}
          {module ? (
            <div className="ee-part-editor">
              <module.Editor
                configJson={configJson === '' ? null : configJson}
                onChange={setConfigJson}
                ctx={{
                  part,
                  siteId: part.partId,
                  pageKind: part.isPublic ? 'public' : 'internal',
                  onStructureChanged: () => { /* Felder speichern selbst. */ }
                }}
              />
            </div>
          ) : (
            <p className="rc-note ee-wide">
              Tej części nie umie tu jeszcze nikt narysować. Treść zostaje
              nietknięta — pokaże się, gdy dojdzie jej moduł.
            </p>
          )}

          <label className="ee-check ee-wide">
            <input type="checkbox" checked={visible} disabled={busy}
              onChange={(e) => setVisible(e.target.checked)} />
            <span>widoczna na stronie</span>
          </label>

          <div className="ee-part-foot ee-wide">
            <button
              type="button"
              className="rc-btn"
              disabled={busy}
              onClick={() => onSave({
                menuLabel: menuLabel.trim(),
                title: title.trim(),
                intro: intro.trim(),
                configJson: configJson === '' ? undefined : configJson,
                isVisible: visible
              })}
            >
              Zapisz część
            </button>

            <button
              type="button"
              className="ee-danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Usunąć tę część? Tego nie da się cofnąć.')) onDelete();
              }}
            >
              Usuń
            </button>
          </div>
        </div>
      ))}
    </article>
  );
}

export default RcEventEditor;
