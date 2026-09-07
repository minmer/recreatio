/**
 * Strona osobista uczestnika — `#/new/access/{token}`.
 *
 * <b>Ten link JEST poświadczeniem.</b> Kto go ma, wchodzi. Dlatego adres
 * przychodzi SMS-em i nigdzie się nie zapisuje, a klucz obszaru leży pod nim
 * zapieczętowany kluczem wyprowadzonym z tokenu: sama baza danych go nie
 * otworzy.
 *
 * <b>Strona publiczna jest zawsze w zestawie.</b> Bez niej odbiorca nie miałby
 * drogi do tego, co widzą wszyscy — poza drugim adresem, którego mu nikt nie
 * wysłał.
 *
 * <b>Czego tu nie ma, tego nie ma w odpowiedzi.</b> Strona nieprzydzielona nie
 * przychodzi jako „zablokowana", tylko wcale. Sito jest w zapytaniu, nie w
 * przeglądarce: czego się nie wysyła, to nie wycieknie.
 */

import { useEffect, useState } from 'react';

import { rcEventAccess, type RcAccessView } from '../lib/rcEventEditing';
import { EventShell } from './shell/EventShell';
import { rcShellPage, rcShellPages, rcShellSite } from './shell/shellTypes';
import type { RcPartView } from './rcEventLayers';

export function RcEventAccessView({ token, at }: { token: string; at: number | null }) {
  const [view, setView] = useState<RcAccessView | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [openPage, setOpenPage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await rcEventAccess(token);
        if (alive) setView(found);
      } catch (e) {
        if (alive) {
          setMissing(e instanceof Error && e.message !== ''
            ? e.message
            : 'Ten link jest nieważny albo został wycofany.');
        }
      }
    })();
    return () => { alive = false; };
  }, [token]);

  if (missing !== null) {
    return (
      <div className="ev">
        <main className="ev-main">
          <p className="ev-muted">{missing}</p>
        </main>
      </div>
    );
  }

  if (view === null) {
    return <div className="ev"><main className="ev-main"><p className="ev-muted">Wczytywanie…</p></main></div>;
  }

  const event = view.event;

  const pages = [...(event.pages ?? [])]
    .filter((p) => p.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (pages.length === 0) {
    return (
      <div className="ev">
        <main className="ev-main"><p className="ev-muted">Ta strona nie ma jeszcze treści.</p></main>
      </div>
    );
  }

  /*
   * Domyślnie pierwsza strona WEWNĘTRZNA — po to przyszedł odbiorca. Publiczną
   * ma pod ręką w przełączniku, ale nie jest tym, co mu wysłano.
   */
  const page = pages.find((p) => p.slug === openPage)
    ?? pages.find((p) => p.kind === 'internal')
    ?? pages[0];

  const visible: RcPartView[] = [...(page.parts ?? [])]
    .filter((part) => part.isVisible !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.partId.localeCompare(b.partId));

  return (
    <EventShell
      site={rcShellSite(event)}
      page={{ ...rcShellPage(page), parts: visible }}
      mayRead={false}
      claim={null}
      intakePublicKey={event.intakePublicKey ?? null}
      availablePages={rcShellPages(event)}
      onSelectPage={(pageSlug) => setOpenPage(pageSlug)}
      initialPartIndex={at}
      banner={<Greeting view={view} />}
    />
  );
}

/**
 * To, co ten link mówi TEMU odbiorcy.
 *
 * <b>Przydziały („Twoja grupa: 3") to najcichszy dobry pomysł starego modułu.</b>
 * Jedna strona mówi każdemu co innego, bez wersji na osobę — a organizator
 * wpisuje to raz, przy wydawaniu linku.
 */
function Greeting({ view }: { view: RcAccessView }) {
  const notes = view.notes ?? [];
  const note = (view.personalNote ?? '').trim();

  if (notes.length === 0 && note === '' && !view.firstOpen) return null;

  return (
    <aside className="ev-personal">
      <p className="ev-personal-who">
        {view.firstOpen ? 'Witaj, ' : ''}{view.recipientName}
      </p>

      {note !== '' && <p className="ev-personal-note">{note}</p>}

      {notes.length > 0 && (
        <dl className="ev-personal-notes">
          {notes.map((one, n) => (
            <div key={`${one.label}-${n}`}>
              <dt>{one.label}</dt>
              <dd>{one.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </aside>
  );
}

export default RcEventAccessView;
