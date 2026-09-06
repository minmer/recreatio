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
 *   Ctrl+Enter   — zapisz i przejdź do NASTĘPNEJ mszy tego dnia
 *   Escape       — porzuć to, co wpisane, i nie zapisuj
 * </code>
 *
 * Kursor sam ląduje w kolejnym polu. Ręka nie opuszcza klawiatury od pierwszej
 * intencji do ostatniej.
 *
 * <b>Zapis jest natychmiastowy, nie „na koniec".</b> Formularz zbierający
 * dwadzieścia intencji i wysyłający je razem gubi wszystkie, gdy przy
 * osiemnastej padnie połączenie. Każda idzie osobno, a to, co poszło, zostaje
 * widoczne na liście powyżej.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  RC_KIND_LABEL, rcAddIntention, rcDayLabel, rcHour, rcIntentions,
  rcPublicMasses, rcUpdateIntention,
  type RcIntention, type RcIntentionKind, type RcPublicMass
} from './rcMass';
import { RcRequestError } from '../lib/rcApi';

export function RcIntentionTab({ slug }: { slug: string }) {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [masses, setMasses] = useState<readonly RcPublicMass[]>([]);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const from = new Date(`${day}T00:00:00`);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);

      const found = await rcPublicMasses(slug, from, to);
      const list = (found.masses ?? []).filter((m) => m.status !== 'cancelled');
      setMasses(list);
      setAt((current) => Math.min(current, Math.max(0, list.length - 1)));
    } catch {
      setMasses([]);
    }
  }, [slug, day]);

  useEffect(() => { void load(); }, [load]);

  const mass = masses[at];

  return (
    <div className="it">
      <div className="it-top">
        <label className="mo-field">
          <span>Dzień</span>
          <input
            type="date"
            value={day}
            onChange={(e) => { setDay(e.target.value); setAt(0); }}
          />
        </label>

        {masses.length > 0 && (
          <label className="mo-field">
            <span>Msza</span>
            <select value={at} onChange={(e) => setAt(Number(e.target.value))}>
              {masses.map((m, index) => (
                <option key={m.startsUtc} value={index}>
                  {rcHour(m.startsUtc)}{(m.title ?? '') === '' ? '' : ` — ${m.title}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {masses.length === 0 && (
        <p className="rc-note">
          Tego dnia nie ma mszy w planie. Załóż ją w zakładce „Msze" — jeden wpis
          powtarzający się wystarcza na cały okres.
        </p>
      )}

      {mass !== undefined && (
        <MassEntry
          key={mass.startsUtc}
          mass={mass}
          position={`${at + 1} z ${masses.length}`}
          hasNext={at + 1 < masses.length}
          onNextMass={() => setAt((n) => Math.min(n + 1, masses.length - 1))}
          onError={setError}
        />
      )}

      {error !== null && <p className="ap-error">{error}</p>}

      <p className="it-keys">
        <kbd>Enter</kbd> zapisuje i zostaje przy tej mszy ·
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> zapisuje i przechodzi do następnej ·
        <kbd>Esc</kbd> czyści pole
      </p>
    </div>
  );
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
