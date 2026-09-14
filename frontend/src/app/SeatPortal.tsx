/**
 * Der Platz, wie ihn der LINK öffnet — ohne Konto.
 *
 * <b>Der Schlüssel steht in der Adresse, hinter der Raute.</b> Er geht nie an
 * den Dienst: der bekommt das Token und gibt dafür eine Hülle heraus, und
 * aufgemacht wird sie hier. Derselbe Weg wie beim Einladungslink.
 *
 * <b>Der Preis steht oben, nicht im Kleingedruckten.</b> Wer den Link hat, hat
 * die Daten — das ist kein Ausweis, sondern ein Schlüssel. Eine Seite, die das
 * verschweigt, verleitet dazu, ihn weiterzuschicken.
 *
 * <b>Binden ist freiwillig und ändert etwas Echtes.</b> Danach kommt der Mensch
 * über sein Konto heran, und der Zettel darf verloren gehen. Vorher nicht:
 * ohne Konto und ohne Link erreicht niemand den Platz — auch er selbst nicht.
 */

import { useCallback, useEffect, useState } from 'react';

import { fromBase64Url } from './crypto';
import type { SealedRole } from './keys';
import { keysFor } from './ringOf';
import { bindSeat, loadPortal, openPortal, type Portal } from './seat';
import { whoIsThere, WorkspaceError, type Who } from './session';

export function SeatPortal({ token, keyText }: { token: string; keyText: string | null }) {
  const [portal, setPortal] = useState<Portal | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [seatKey, setSeatKey] = useState<Uint8Array | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const [who, setWho] = useState<Who | null | undefined>(undefined);
  const [persons, setPersons] = useState<readonly SealedRole[]>([]);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [bound, setBound] = useState(false);

  const look = useCallback(async () => {
    try {
      const found = await loadPortal(token);
      setPortal(found);
      setFailed(null);

      if (keyText === null) return;

      try {
        const opened = await openPortal(found, fromBase64Url(keyText));
        setSeatKey(opened.seatKey);
        setNote(opened.personal);
      } catch {
        /*
         * Der Schlüssel aus der Adresse passt nicht. Der Stand bleibt sichtbar,
         * der Inhalt zu — und das wird gesagt, statt eine leere Seite zu zeigen.
         */
        setSeatKey(null);
        setNote(null);
      }
    } catch (e) {
      setPortal(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć.');
    }
  }, [token, keyText]);

  useEffect(() => { void look(); }, [look]);

  /*
   * Angemeldet? Wird gefragt, aber NICHT verlangt. Der ganze Zweck dieser Seite
   * ist, dass sie auch ohne Konto trägt.
   */
  useEffect(() => {
    let alive = true;
    void whoIsThere().then((found) => { if (alive) setWho(found); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (who === null || who === undefined) return;
    let alive = true;

    void keysFor(who)
      .then(({ graph }) => {
        if (!alive) return;
        const people = graph.roles.filter((r) => r.kind === 'person');
        setPersons(people);
        setChosen((current) => (current === '' ? (people[0]?.id ?? '') : current));
      })
      .catch(() => { if (alive) setPersons([]); });

    return () => { alive = false; };
  }, [who]);

  const bind = async () => {
    if (portal == null || seatKey === null || who == null) return;

    const person = persons.find((p) => p.id === chosen);
    if (person === undefined) return;

    setBusy(true);
    setFailed(null);

    try {
      await bindSeat(token, portal.seatId, seatKey, person);
      setBound(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przypisać.');
    } finally {
      setBusy(false);
    }
  };

  if (portal === undefined) return <p className="wk-lede">Otwieranie…</p>;

  if (portal === null) {
    return (
      <>
        <h1 className="wk-h1">Tego miejsca nie ma</h1>
        <p className="wk-lede">
          Link mógł zostać wycofany albo stracić ważność. {failed}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">
        {portal.recipientName === null ? 'Twoje miejsce' : portal.recipientName}
      </h1>

      {/*
        Zuerst und nicht zuletzt: was dieser Link ist. Wer ihn weiterschickt,
        schickt den Zugang mit — das gehört an den Anfang.
      */}
      <p className="wk-lede">
        Ten link jest kluczem, nie legitymacją: kto go ma, widzi tę stronę.
        Nie przekazuj go dalej.
      </p>

      {keyText === null && (
        <p className="wk-error">
          W adresie brakuje klucza — widać, że miejsce istnieje, ale nie jego
          treść. Otwórz pełny link, ten z drugą częścią po ukośniku.
        </p>
      )}

      {keyText !== null && seatKey === null && (
        <p className="wk-error">
          Klucz z adresu nie pasuje do tego miejsca. Sprawdź, czy link nie
          urwał się przy kopiowaniu.
        </p>
      )}

      {note !== null && (
        <section className="wk-form">
          <h2 className="wk-h2">Dla Ciebie</h2>
          <p className="wk-card-text" style={{ whiteSpace: 'pre-wrap' }}>{note}</p>
        </section>
      )}

      {note === null && seatKey !== null && (
        <p className="wk-empty">Nic tu jeszcze nie napisano.</p>
      )}

      {portal.expiresAt !== null && (
        <p className="wk-hint">
          Link działa do {new Date(portal.expiresAt).toLocaleDateString('pl-PL',
            { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      {/* -- Binden ------------------------------------------------------- */}

      {bound ? (
        <p className="wk-done">
          Gotowe. To miejsce jest teraz przypisane do Ciebie — znajdziesz je w
          swoim koncie, także bez tego linku.
        </p>
      ) : seatKey === null ? null : who === undefined ? null : who === null ? (
        <section className="wk-form">
          <h2 className="wk-h2">Masz konto?</h2>
          <p className="wk-hint">
            Po zalogowaniu możesz przypisać to miejsce do siebie. Wtedy dotrzesz
            do niego bez linku — a sam link może spokojnie zginąć.
          </p>
        </section>
      ) : persons.length === 0 ? (
        <section className="wk-form">
          <h2 className="wk-h2">Przypisz do siebie</h2>
          <p className="wk-hint">
            Najpierw potrzebujesz <strong>osoby</strong> — konto to pęk kluczy,
            nie człowiek. Załóż ją w zakładce „Role".
          </p>
        </section>
      ) : (
        <form
          className="wk-form"
          onSubmit={(e) => { e.preventDefault(); void bind(); }}
        >
          <h2 className="wk-h2">Przypisz do siebie</h2>

          {/*
            WELCHE Person — gefragt und nicht geraten. Ein Elternteil mit zwei
            Kindern öffnet zwei solcher Links; ohne diese Frage landeten beide
            bei derselben Person, und weil die Angaben trotzdem aufgingen,
            fände es niemand heraus.
          */}
          <label className="wk-field">
            <span>Kogo dotyczy to miejsce</span>
            <select value={chosen} onChange={(e) => setChosen(e.target.value)}>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>Osoba · {p.id.slice(0, 8)}</option>
              ))}
            </select>
          </label>

          <p className="wk-hint">
            Klucz miejsca zostanie zapakowany kluczem tej osoby. Usługa nie
            uczestniczy w tym — dostaje gotową kopertę.
          </p>

          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy || chosen === ''}>
              {busy ? 'Przypisywanie…' : 'Przypisz'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export default SeatPortal;
