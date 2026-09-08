/**
 * Terminarz — wszystko, co czeka to konto, na jednej liście.
 *
 * <b>Po co.</b> Człowiek ma JEDEN dzień. Nie ma osobno dnia parafialnego i
 * osobno wydarzeniowego: ma środę, a w niej mszę o 18:00, spowiedź przed nią,
 * odwiedziny chorych rano i wyjazd w weekend. Kto musi otworzyć cztery listy,
 * przeoczy piątą — a przy terminach przeoczenie nie jest usterką wyglądu.
 *
 * <b>Msza, spowiedź i odwiedziny to już wpisy kalendarza</b> — leżą tylko w
 * różnych kalendarzach, bo należą do różnych obszarów. Wydarzenia leżą osobno,
 * w `rc_event`, i dochodzą jako własny rodzaj. Serwis składa to w jednym oknie
 * czasu; tu tylko widać.
 *
 * <b>Grupowanie jest po dniu MIEJSCOWYM, nie po UTC</b> — reguła siedzi w
 * `rcAgenda.ts`, sprawdzalnie. Nabożeństwo o 00:30 to po UTC dzień wcześniej, a
 * plan pokazałby je o dobę za wcześnie i nic by na to nie wskazywało.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { rcAgenda, type RcAgendaView } from '../lib/rcAgenda';
import { rcPath } from '../lib/rcRoute';
import {
  rcDayLabel, rcFilterKinds, rcGroupByDay, rcHrefOf, rcKindLabel, rcKindsIn, rcLocalDay,
  rcSealed, rcTimeOf
} from './rcAgenda';

/** Ile dni pokazujemy naraz — i dlaczego akurat tyle. */
const SPANS: readonly { days: number; label: string }[] = [
  { days: 7, label: 'Tydzień' },
  { days: 28, label: '4 tygodnie' },
  { days: 92, label: 'Kwartał' }
];

export function RcAgendaPage({
  unlocked, onSignIn
}: {
  unlocked: boolean;
  /** Otworzyć szufladę logowania. Bez tego „zamknięte" jest ślepą uliczką. */
  onSignIn: () => void;
}) {
  const [view, setView] = useState<RcAgendaView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(28);
  const [kinds, setKinds] = useState<ReadonlySet<string>>(new Set());

  /*
   * Strefa czytelnika. Serwis podaje czasy w UTC — dzień, na którym stoi wpis,
   * rozstrzyga się dopiero tutaj, bo to dzień TEGO, kto patrzy.
   */
  const zone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return undefined; }
  }, []);

  const load = useCallback(async () => {
    if (!unlocked) return;
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + days);

      setView(await rcAgenda(from.toISOString(), to.toISOString()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się wczytać terminarza.');
    }
  }, [unlocked, days]);

  useEffect(() => { void load(); }, [load]);

  if (!unlocked) {
    return (
      <div className="ag">
        <h1 className="ag-h1">Terminarz</h1>
        <p className="ag-note">
          Terminarz czyta kalendarze, do których masz klucz — a te są zamknięte,
          dopóki nie odblokujesz konta.
        </p>
        <button type="button" className="rc-btn" onClick={onSignIn}>Odblokuj</button>
      </div>
    );
  }

  const all = view?.entries ?? [];
  const shown = rcFilterKinds(all, kinds);
  const grouped = rcGroupByDay(shown, zone);
  const today = rcLocalDay(new Date().toISOString(), zone);

  const toggle = (kind: string) => setKinds((old) => {
    const next = new Set(old);
    if (next.has(kind)) next.delete(kind); else next.add(kind);
    return next;
  });

  return (
    <div className="ag">
      <header className="ag-head">
        <h1 className="ag-h1">Terminarz</h1>
        <p className="ag-lead">
          Msze, spowiedź, odwiedziny chorych, spotkania i wydarzenia — razem, w
          kolejności, w jakiej nadchodzą.
        </p>
      </header>

      <div className="ag-controls">
        <span className="ag-spans">
          {SPANS.map((span) => (
            <button
              key={span.days}
              type="button"
              className={`ag-span${span.days === days ? ' is-on' : ''}`}
              aria-pressed={span.days === days}
              onClick={() => setDays(span.days)}
            >
              {span.label}
            </button>
          ))}
        </span>

        {/*
          Filtry budują się z DANYCH. Rodzaj, którego nie ma w oknie, nie stoi w
          pasku — inaczej pusty wynik wyglądałby jak awaria.
        */}
        <span className="ag-kinds">
          {rcKindsIn(all).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`ag-kind ag-${kind}${kinds.has(kind) ? ' is-on' : ''}`}
              aria-pressed={kinds.has(kind)}
              onClick={() => toggle(kind)}
            >
              {rcKindLabel(kind)}
            </button>
          ))}

          {kinds.size > 0 && (
            <button type="button" className="rc-link" onClick={() => setKinds(new Set())}>
              wszystko
            </button>
          )}
        </span>
      </div>

      {error !== null && <p className="ap-error">{error}</p>}

      {view === null && error === null && <p className="ag-note">Wczytywanie…</p>}

      {view !== null && all.length === 0 && (
        <p className="ag-note">W tym okresie nic nie jest zaplanowane.</p>
      )}

      {view !== null && all.length > 0 && shown.length === 0 && (
        <p className="ag-note">Nic tego rodzaju w tym okresie.</p>
      )}

      <ol className="ag-days">
        {grouped.map((day) => (
          <li key={day.day} className={`ag-day${day.day === today ? ' is-today' : ''}`}>
            <h2 className="ag-day-h">
              {rcDayLabel(day.day, today)}
              {day.day === today && <span className="ag-today">dziś</span>}
            </h2>

            <ol className="ag-entries">
              {day.entries.map((one, n) => (
                <li key={`${one.sourceId}-${one.startsUtc}-${n}`} className="ag-entry">
                  <span className="ag-time">
                    {rcTimeOf(one, zone) ?? <span className="ag-allday">cały dzień</span>}
                  </span>

                  <span className={`ag-dot ag-${one.kind}`} aria-hidden="true" />

                  <span className="ag-what">
                    {/*
                      Wpis, którego czytelnik nie otworzy, NIE znika z listy: czas
                      i tak jest widoczny, a ukrycie go zrobiłoby z zajętego dnia
                      wolny. Zamknięta jest treść, nie godzina.
                    */}
                    <span className="ag-title">
                      {rcSealed(one)
                        ? <em className="ag-sealed">zapieczętowane</em>
                        : (one.title ?? rcKindLabel(one.kind))}
                    </span>

                    <span className="ag-meta">
                      <span className="ag-kind-name">{rcKindLabel(one.kind)}</span>
                      {(one.location ?? '') !== '' && <span>{one.location}</span>}
                      <span className="ag-source">{one.sourceTitle}</span>
                      {one.status === 'cancelled' && <span className="ag-off">odwołane</span>}
                    </span>
                  </span>

                  {rcHrefOf(one) !== null && (
                    <a className="ag-go" href={rcHrefOf(one) ?? undefined}>otwórz</a>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      <p className="ag-foot">
        <a href={rcPath('calendar')}>Kalendarze</a>
      </p>
    </div>
  );
}

export default RcAgendaPage;
