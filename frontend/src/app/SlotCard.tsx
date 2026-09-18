/**
 * Termine zum Aussuchen — der Baustein im Portal (0029).
 *
 * <b>Jede Zeile sagt, was mit ihr geht</b>, und zwar mit einem Wort statt mit
 * einem grauen Knopf: „wolne", „zajęte przez kogoś", „pełny". Ein Knopf, der
 * nicht geht, ohne dass daneben steht warum, sieht aus wie ein Fehler.
 *
 * <b>Wer zuerst zugreift, wird Gastgeber</b> und bekommt einen Code, der drei
 * Tage gilt. Er steht danach GENAU EINMAL da — beim Dienst liegt nur sein
 * Abdruck. Das gehört gesagt, solange er noch auf dem Bildschirm ist.
 *
 * <b>Zwei Wege hinein, und beide enden in derselben Buchung:</b> der Code, oder
 * eine Bitte, die der Gastgeber annimmt. Der zweite ist für den, der den Code
 * nicht hat — im Altbestand war das genau so, und es war richtig.
 */

import { useCallback, useEffect, useState } from 'react';

import { useSeat } from './seatContext';
import { WorkspaceError } from './session';
import {
  askSlot, bookSlot, loadSlots, releaseSlot, type PublicSlot
} from './slot';

export function SlotCard({ config }: { config: Record<string, string> }) {
  const seat = useSeat();
  const title = (config.title ?? '').trim();
  const calendarId = (config.calendar ?? '').trim();

  const [slots, setSlots] = useState<readonly PublicSlot[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** Der Code des zuletzt genommenen Termins — einmal, dann nie wieder. */
  const [fresh, setFresh] = useState<{ code: string; until: string | null } | null>(null);

  const look = useCallback(async () => {
    if (calendarId === '') return;

    try {
      const { slots: found } = await loadSlots(calendarId, seat?.token);
      setSlots(found);
      setFailed(null);
    } catch (e) {
      setSlots([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać terminów.');
    }
  }, [calendarId, seat?.token]);

  useEffect(() => { void look(); }, [look]);

  if (calendarId === '') {
    return (
      <>
        {title !== '' && <h2 className="wk-card-title">{title}</h2>}
        <p className="wk-card-muted">
          Ten blok potrzebuje kennungi kalendarza — wpisz ją w ustawieniach modułu.
        </p>
      </>
    );
  }

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2 className="wk-card-title">{title === '' ? 'Terminy' : title}</h2>

      {seat === null && (
        <p className="wk-card-muted">
          Tu osoba wybierze swój termin. Widać to dopiero po otwarciu jej linku.
        </p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      {fresh !== null && (
        <div className="wk-note">
          <p>
            <strong>Masz termin.</strong> Przez najbliższe 72 godziny możesz
            dobrać do niego kogoś jeszcze — podaj mu ten kod:
          </p>
          <p className="wk-code">{fresh.code}</p>
          <p className="wk-hint">
            <strong>Widzisz go tylko teraz.</strong> U nas zapisany jest wyłącznie
            jego odcisk. Gdy minie {fresh.until === null ? 'termin' :
              new Date(fresh.until).toLocaleString('pl-PL')}, termin otworzy się
            dla wszystkich, jeśli zostanie na nim wolne miejsce.
          </p>
          <button type="button" className="wk-link-btn" onClick={() => setFresh(null)}>Ukryj</button>
        </div>
      )}

      {slots === null ? (
        <p className="wk-card-text">Wczytywanie…</p>
      ) : slots.length === 0 ? (
        <p className="wk-empty">Nie ma jeszcze żadnych terminów do wyboru.</p>
      ) : (
        <ul className="wk-list">
          {slots.map((one) => (
            <Row
              key={`${one.itemId}:${one.occurrenceAt}`}
              slot={one}
              token={seat?.token ?? null}
              busy={busy !== null}
              onAct={act}
              onCode={(code, until) => setFresh({ code, until })}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/* -- Eine Zeile ------------------------------------------------------------ */

const WORD: Record<string, string> = {
  open: 'wolne',
  inviteneeded: 'trzyma je ktoś inny',
  locked: 'zamknięte',
  full: 'pełne',
  mine: 'Twój termin'
};

function Row({ slot, token, busy, onAct, onCode }: {
  slot: PublicSlot;
  token: string | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
  onCode: (code: string, until: string | null) => void;
}) {
  const [code, setCode] = useState('');
  const [asking, setAsking] = useState(false);

  const when = new Date(slot.occurrenceAt);

  const take = async (withCode?: string) => {
    if (token === null) return;

    await onAct('Zapisywanie…', async () => {
      const done = await bookSlot(slot.itemId, slot.occurrenceAt, token, withCode);
      if (done.inviteCode !== null) onCode(done.inviteCode, done.inviteUntil);
    });
  };

  return (
    <li className="wk-row">
      <span>
        <strong>
          {when.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
          {', '}
          {when.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
        </strong>

        <span className="wk-row-side">
          {slot.titlePublic !== null && ` · ${slot.titlePublic}`}
          {` · ${slot.minutes} min`}
          {` · ${slot.taken}/${slot.capacity}`}
          {` · ${WORD[slot.state] ?? slot.state}`}
        </span>

        {/*
          DER CODE, wenn jemand anders den Termin hält. Er steht als Feld da und
          nicht hinter einem Knopf: wer einen Code bekommen hat, will ihn
          eintippen, ohne vorher zu suchen wo.
        */}
        {slot.state === 'inviteneeded' && token !== null && (
          <div className="wk-form">
            <label className="wk-field">
              <span>Kod od osoby, która trzyma ten termin</span>
              <input
                value={code}
                disabled={busy}
                autoComplete="off"
                placeholder="ABC234"
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>

            <div className="wk-actions">
              <button
                type="button" className="wk-btn"
                disabled={busy || code.trim().length < 4}
                onClick={() => void take(code.trim())}
              >
                Dołącz kodem
              </button>

              <button
                type="button" className="wk-link-btn" disabled={busy || asking}
                onClick={() => void onAct('Wysyłanie prośby…', async () => {
                  await askSlot(slot.itemId, slot.occurrenceAt, token);
                  setAsking(true);
                })}
              >
                {asking ? 'Poproszono' : 'Albo poproś o dołączenie'}
              </button>
            </div>

            <p className="wk-hint">
              Nie masz kodu? Poproś — osoba, która trzyma ten termin, zobaczy
              prośbę u siebie i może się zgodzić.
            </p>
          </div>
        )}
      </span>

      <span className="wk-row-side">
        {token === null ? null
          : slot.state === 'mine' ? (
            <button
              type="button" className="wk-link-btn" disabled={busy}
              onClick={() => void onAct('Rezygnacja…',
                () => releaseSlot(slot.itemId, slot.occurrenceAt, token))}
            >
              Zrezygnuj
            </button>
          ) : slot.state === 'open' ? (
            <button
              type="button" className="wk-btn" disabled={busy}
              onClick={() => void take()}
            >
              Zapisz się
            </button>
          ) : null}
      </span>
    </li>
  );
}

export default SlotCard;
