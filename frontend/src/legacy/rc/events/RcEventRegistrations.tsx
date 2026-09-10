/**
 * Zgłoszenia — i to, kto może je przeczytać.
 *
 * <b>Klucz należy do URZĘDU, nie do obszaru.</b> Odpowiedzi leżą zapieczętowane
 * kluczem przyjęć wydarzenia, a ten sam klucz prywatny leży pod kluczem roli
 * administracyjnej. Kto pomaga przy budowaniu strony, ma dostęp do obszaru —
 * ale nie do zgłoszeń. Do rc_0031 było odwrotnie, i to był wyciek: każdy
 * pomocnik czytał imiona, diety i nietolerancje, nie dostawszy niczego.
 *
 * <b>Nieprzeczytane zgłoszenie NIE znika z listy</b> (15.9). Zostaje z podaną
 * przyczyną. Pominięcie go w ciszy znaczyłoby, że nikt nie zauważa, że ktoś się
 * zapisał — a to gorsze niż nieczytelna treść.
 */

import { useCallback, useEffect, useState } from 'react';

import { rcRegistrations, type RcEventView, type RcRegistration } from '../lib/rcEvents';
import { rcPath } from '../lib/rcRoute';

/** Nur Abschnitte, die wirklich etwas entgegennehmen, haben Anmeldungen. */
function formParts(view: RcEventView) {
  return (view.pages ?? []).flatMap((page) =>
    (page.parts ?? [])
      .filter((part) => part.kind === 'form')
      .map((part) => ({
        partId: part.partId,
        label: (part.menuLabel ?? '').trim() || (part.title ?? '').trim() || 'Formularz',
        page: page.title
      }))
  );
}

export function RcEventRegistrations({
  view, onError
}: {
  view: RcEventView;
  onError: (message: string) => void;
}) {
  const forms = formParts(view);
  const [openPart, setOpenPart] = useState<string | null>(forms[0]?.partId ?? null);
  const [rows, setRows] = useState<readonly RcRegistration[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (partId: string) => {
    setLoading(true);
    try { setRows((await rcRegistrations(partId)).registrations ?? []); }
    catch (e) { onError(e instanceof Error ? e.message : 'Nie udało się pobrać zgłoszeń.'); }
    finally { setLoading(false); }
  }, [onError]);

  useEffect(() => { if (openPart !== null) void load(openPart); }, [openPart, load]);

  if (forms.length === 0) {
    return (
      <section className="ew-panel">
        <h2 className="ew-h2">Zgłoszenia</h2>
        <p className="ec-note">
          To wydarzenie nie ma jeszcze formularza. Dodaj część „Formularz zapisu"
          w zakładce <a href={rcPath('event', view.collectionSlug, view.slug, 'edit')}>Strony i części</a>.
        </p>
      </section>
    );
  }

  return (
    <section className="ew-panel">
      <h2 className="ew-h2">Zgłoszenia</h2>

      {forms.length > 1 && (
        <nav className="ew-subtabs" aria-label="Formularze">
          {forms.map((one) => (
            <button
              key={one.partId}
              type="button"
              className={`ew-subtab${one.partId === openPart ? ' is-active' : ''}`}
              onClick={() => setOpenPart(one.partId)}
            >
              {one.label}
              <em className="ew-subtab-page">{one.page}</em>
            </button>
          ))}
        </nav>
      )}

      {loading && <p className="ec-note">Wczytywanie…</p>}

      {!loading && rows.length === 0 && (
        <p className="ec-note">Nikt się jeszcze nie zapisał.</p>
      )}

      <ol className="ew-signups">
        {rows.map((row) => (
          <li key={row.registrationId} className="ew-signup" data-withdrawn={row.withdrawn}>
            <header className="ew-signup-head">
              <time dateTime={row.submittedUtc}>
                {new Date(row.submittedUtc).toLocaleString('pl-PL')}
              </time>
              {row.withdrawn && <span className="ew-tag">wycofane</span>}
            </header>

            {/*
              Nieczytelne zgłoszenie zostaje, z powodem. Kto nie ma urzędu, widzi
              ŻE ktoś się zapisał — i dowiaduje się, czego mu brakuje, zamiast
              patrzeć na krótszą listę i brać ją za całą.
            */}
            {(row.unreadable ?? null) !== null ? (
              <p className="ew-sealed">
                Zapieczętowane — do odczytu potrzebny klucz roli administracyjnej
                tego wydarzenia. <code>{row.unreadable}</code>
              </p>
            ) : (
              <dl className="ew-answers">
                {(row.answers ?? []).map((answer) => (
                  <div key={answer.fieldId}>
                    <dt>{answer.label}</dt>
                    <dd>{answer.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default RcEventRegistrations;
