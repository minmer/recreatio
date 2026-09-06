/**
 * Zakładka „Intencje" w edytorze — szybkie wpisywanie.
 *
 * <b>Po co osobny tryb.</b> Intencje wpisuje się seriami: kancelaria ma kartkę
 * z dwudziestoma i przepisuje je pod rząd. Przy formularzu, w którym po każdej
 * trzeba sięgnąć po mysz, dwadzieścia intencji to dwadzieścia sięgnięć — i
 * wtedy nikt tego nie robi w systemie, tylko dalej na kartce.
 *
 * <b>Dlatego klawiatura prowadzi:</b>
 *
 * <code>
 *   Enter        — zapisz i pisz następną intencję DO TEJ SAMEJ mszy
 *   Ctrl+Enter   — zapisz i przejdź do NASTĘPNEJ mszy — a po ostatniej
 *                  mszy dnia do pierwszej mszy następnego dnia
 *   Escape       — porzuć to, co wpisane, i nie zapisuj
 * </code>
 *
 * Kursor sam ląduje w kolejnym polu. Ręka nie opuszcza klawiatury od pierwszej
 * intencji do ostatniej — także wtedy, gdy kartka obejmuje cały tydzień.
 *
 * <b>Dlatego wczytywane są dwa tygodnie naraz, nie jeden dzień.</b> Stos
 * karteczek nie kończy się razem z dniem. Zatrzymanie się na granicy dnia
 * wyglądałoby tak, jakby plan się skończył — a znaczyłoby: sięgnij po mysz.
 *
 * <b>Zapis jest natychmiastowy, nie „na koniec".</b> Formularz zbierający
 * dwadzieścia intencji i wysyłający je razem gubi wszystkie, gdy przy
 * osiemnastej padnie połączenie. Każda idzie osobno, a to, co poszło, zostaje
 * widoczne na liście powyżej.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  RC_KIND_LABEL, rcAddIntention, rcDayKey, rcDayLabel, rcFirstOnOrAfter, rcHour,
  rcIntentions, rcMassesOnly, rcPositionInDay, rcPublicMasses, rcUpdateIntention,
  type RcIntention, type RcIntentionKind, type RcPublicMass
} from './rcMass';
import { RcRequestError } from '../lib/rcApi';
import { rcPrintIntentions, rcSheetWeek } from './rcPrintIntentions';

/**
 * Wie weit voraus geladen wird.
 *
 * <b>Nicht ein Tag, sondern zwei Wochen.</b> Ein Stapel Zettel endet nicht mit
 * dem Tag; wer die letzte Messe des Sonntags abgetippt hat, will an die erste
 * des Montags — ohne die Maus. Laedt die Ansicht nur einen Tag, ist an der
 * Tagesgrenze Schluss, und es sieht aus, als sei der Plan zu Ende.
 */
const WINDOW_DAYS = 14;

export function RcIntentionTab({ slug }: { slug: string }) {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [masses, setMasses] = useState<readonly RcPublicMass[]>([]);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + WINDOW_DAYS);

      const found = await rcPublicMasses(slug, start, end);

      /*
        Tylko msze. Spowiedź nie ma intencji, więc pokazanie jej tutaj byłoby
        zaproszeniem do wpisania czegoś, czego nie ma gdzie przeczytać — a przy
        Ctrl+Enter trafiłoby się w nią po drodze, nie chcąc.
      */
      const list = rcMassesOnly(found.masses ?? []).filter((m) => m.status !== 'cancelled');
      setMasses(list);
      setAt((current) => Math.min(current, Math.max(0, list.length - 1)));
    } catch {
      setMasses([]);
    }
  }, [slug, from]);

  useEffect(() => { void load(); }, [load]);

  const mass = masses[at];

  /*
   * Das Datumsfeld zeigt den Tag der GERADE bearbeiteten Messe, nicht den
   * Anfang des Fensters. Sonst stuende dort noch Sonntag, waehrend man laengst
   * den Montag eintraegt — und man traegt in dem Glauben ein, es sei noch
   * Sonntag.
   */
  const shownDay = mass === undefined ? from : rcDayKey(mass.startsUtc);

  /*
   * DER AUSHANG WIRD FUER EINE WOCHE GEDRUCKT, NICHT FUER DAS FENSTER.
   *
   * Montag bis Sonntag — so haengt das Blatt im Schaukasten, und so ist es
   * gewachsen: der Sonntag ist der Gipfel der Woche, nicht ihr Anfang. Das
   * Ladefenster ist mit vierzehn Tagen absichtlich groesser; wer eintraegt,
   * arbeitet weiter voraus als wer liest.
   */
  const [week, setWeek] = useState(() => rcSheetWeek(new Date()));
  const [printFailed, setPrintFailed] = useState(false);

  const print = async () => {
    setPrintFailed(false);
    try {
      const start = new Date(`${week.from}T00:00:00`);
      const end = new Date(`${week.to}T23:59:59`);

      /*
       * Frisch geholt und nicht aus dem Fenster genommen: das Blatt geht an
       * die Wand und soll den Stand von jetzt zeigen, nicht den von vorhin.
       */
      const found = await rcPublicMasses(slug, start, end);
      if (!rcPrintIntentions(found.masses ?? [], start, end)) setPrintFailed(true);
    } catch {
      setPrintFailed(true);
    }
  };

  /* Ein gewaehlter Tag springt auf dessen erste Messe — oder auf die naechste danach. */
  const goToDay = (wanted: string) => {
    const found = rcFirstOnOrAfter(masses, wanted);
    if (found >= 0) { setAt(found); return; }

    // Ausserhalb des Fensters: neu laden und vorn anfangen.
    setFrom(wanted);
    setAt(0);
  };

  return (
    <div className="it">
      <div className="it-top">
        <label className="mo-field">
          <span>Dzień</span>
          <input type="date" value={shownDay} onChange={(e) => goToDay(e.target.value)} />
        </label>

        {masses.length > 0 && (
          <label className="mo-field">
            <span>Msza</span>
            {/*
              Wszystkie msze okna, nie tylko tego dnia — bo Ctrl+Enter i tak
              wychodzi poza dzień, a lista, która się z tym nie zgadza, myli.
            */}
            <select value={at} onChange={(e) => setAt(Number(e.target.value))}>
              {masses.map((m, index) => (
                <option key={m.startsUtc} value={index}>
                  {rcDayLabel(m.startsUtc)} {rcHour(m.startsUtc)}
                  {(m.title ?? '') === '' ? '' : ` — ${m.title}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {masses.length === 0 && (
        <p className="rc-note">
          Przez najbliższe dwa tygodnie od tego dnia nie ma żadnej mszy w planie.
          Załóż ją w zakładce „Msze" — jeden wpis powtarzający się wystarcza na
          cały okres.
        </p>
      )}

      {mass !== undefined && (
        <MassEntry
          key={mass.startsUtc}
          mass={mass}
          position={positionLabel(masses, at)}
          /*
            „Weiter" endet erst am Rand des FENSTERS, nicht am Rand des Tages.
            Nach der letzten Messe des Sonntags kommt die erste des Montags —
            und ein Tag ohne Messe wird dabei uebersprungen, weil er keine
            Station ist, an der jemand halten wollte.
          */
          hasNext={at + 1 < masses.length}
          onNextMass={() => setAt((n) => Math.min(n + 1, masses.length - 1))}
          onError={setError}
        />
      )}

      {error !== null && <p className="ap-error">{error}</p>}

      <section className="it-sheet">
        <h3 className="rc-h2">Wydruk do gabloty</h3>

        <div className="it-sheet-row">
          <label className="mo-field">
            <span>Od</span>
            <input
              type="date"
              value={week.from}
              onChange={(e) => setWeek({ ...week, from: e.target.value })}
            />
          </label>

          <label className="mo-field">
            <span>Do</span>
            <input
              type="date"
              value={week.to}
              onChange={(e) => setWeek({ ...week, to: e.target.value })}
            />
          </label>

          <button type="button" className="rc-btn" onClick={() => void print()}>
            Drukuj intencje (A4)
          </button>

          {/* Domyślnie bieżący tydzień; następny jest o jedno kliknięcie. */}
          <button
            type="button"
            className="mt-quick-one"
            onClick={() => {
              const next = new Date(`${week.from}T00:00:00`);
              next.setDate(next.getDate() + 7);
              setWeek(rcSheetWeek(next));
            }}
          >
            następny tydzień
          </button>
        </div>

        {printFailed && (
          <p className="ap-error">
            Nie udało się otworzyć wydruku — przeglądarka mogła zablokować nowe okno.
          </p>
        )}
      </section>

      <p className="it-keys">
        <kbd>Enter</kbd> zapisuje i zostaje przy tej mszy ·
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> zapisuje i przechodzi do następnej —
        także na następny dzień ·
        <kbd>Esc</kbd> czyści pole
      </p>
    </div>
  );
}

/** „2 z 7" — liczone w dniu, bo tyle zostało do końca tego dnia. */
function positionLabel(masses: readonly RcPublicMass[], at: number): string {
  const where = rcPositionInDay(masses, at);
  return `${where.at} z ${where.of}`;
}

/* -- Jedna msza z jej intencjami ------------------------------------------- */

function MassEntry({
  mass, position, hasNext, onNextMass, onError
}: {
  mass: RcPublicMass;
  position: string;
  hasNext: boolean;
  onNextMass: () => void;
  onError: (message: string | null) => void;
}) {
  const [list, setList] = useState<readonly RcIntention[]>([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<RcIntentionKind>('single');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const found = await rcIntentions(mass.itemId, mass.startsUtc);
      setList(found.intentions ?? []);
    } catch { setList([]); }
  }, [mass.itemId, mass.startsUtc]);

  useEffect(() => { void load(); }, [load]);

  /*
   * Beim Wechsel der Messe steht der Kursor sofort im Feld. Ohne das muesste
   * nach jedem Ctrl+Enter doch wieder zur Maus gegriffen werden — und damit
   * waere der ganze Modus umsonst.
   */
  useEffect(() => { field.current?.focus(); }, [mass.startsUtc]);

  const save = async (thenNext: boolean) => {
    const value = text.trim();
    if (value === '') {
      // Leer und Ctrl+Enter heisst: diese Messe hat nichts, weiter zur naechsten.
      if (thenNext && hasNext) onNextMass();
      return;
    }

    setBusy(true);
    onError(null);
    try {
      await rcAddIntention(mass.itemId, mass.startsUtc, { text: value, kind });
      setText('');
      await load();

      if (thenNext && hasNext) onNextMass();
      else field.current?.focus();
    } catch (e) {
      onError(e instanceof RcRequestError && e.status === 409
        ? e.error.message
        : 'Nie udało się zapisać intencji.');
    } finally { setBusy(false); }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setText(''); return; }
    if (e.key !== 'Enter') return;

    /*
     * Verhindern, BEVOR gespeichert wird: sonst schickt der Browser das
     * umgebende Formular ab und die Seite laedt neu — mitten in einer Reihe
     * von zwanzig Intentionen.
     */
    e.preventDefault();
    void save(e.ctrlKey || e.metaKey);
  };

  const singles = list.filter((i) => i.kind === 'single' && i.status !== 'cancelled');

  return (
    <article className="it-mass">
      <header className="mo-head">
        <strong>{rcHour(mass.startsUtc)}</strong>
        <span className="ms-till">do {rcHour(mass.endsUtc)}</span>
        {(mass.title ?? '') !== '' && <span className="ms-title">{mass.title}</span>}
        <span className="mo-day-label">{rcDayLabel(mass.startsUtc)} · {position}</span>
      </header>

      <ul className="mo-ints">
        {list.map((one) => (
          <Row key={one.intentionId} intention={one} onChanged={() => void load()} />
        ))}
      </ul>

      {list.length === 0 && <p className="ps-muted">Bez intencji.</p>}

      {singles.length > 1 && (
        <p className="mo-need">
          {singles.length} pojedyncze — potrzeba {singles.length} kapłanów.
        </p>
      )}

      <div className="it-entry">
        <input
          ref={field}
          type="text"
          value={text}
          maxLength={400}
          disabled={busy}
          placeholder="Za śp. Jana Kowalskiego"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
        />

        <select
          value={kind}
          disabled={busy}
          onChange={(e) => setKind(e.target.value as RcIntentionKind)}
        >
          <option value="single">{RC_KIND_LABEL.single}</option>
          <option value="collective">{RC_KIND_LABEL.collective}</option>
        </select>
      </div>
    </article>
  );
}

/* -- Eine Zeile, direkt aenderbar ------------------------------------------ */

/**
 * Der Text laesst sich hier ändern, ohne ein zweites Formular zu öffnen.
 *
 * Gespeichert wird beim VERLASSEN des Feldes, nicht bei jedem Anschlag: ein
 * Aufruf je Buchstabe wäre ein Aufruf je Buchstabe.
 */
function Row({ intention, onChanged }: { intention: RcIntention; onChanged: () => void }) {
  const [text, setText] = useState(intention.text);
  const [busy, setBusy] = useState(false);
  const cancelled = intention.status === 'cancelled';

  const commit = async () => {
    const value = text.trim();
    if (value === '' || value === intention.text) { setText(intention.text); return; }

    setBusy(true);
    try {
      await rcUpdateIntention(intention.intentionId, { text: value });
      onChanged();
    } finally { setBusy(false); }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      await rcUpdateIntention(intention.intentionId, {
        status: cancelled ? 'accepted' : 'cancelled'
      });
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <li className="mo-int" data-cancelled={cancelled}>
      <input
        className="it-edit"
        type="text"
        value={text}
        maxLength={400}
        disabled={busy || cancelled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      />

      <span className="mo-int-kind">
        {RC_KIND_LABEL[intention.kind as RcIntentionKind] ?? intention.kind}
      </span>

      <button type="button" className="ps-edit" disabled={busy} onClick={() => void toggle()}>
        {cancelled ? 'Przywróć' : 'Wycofaj'}
      </button>
    </li>
  );
}

export default RcIntentionTab;
