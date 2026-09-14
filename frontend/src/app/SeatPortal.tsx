/**
 * Der Platz, wie ihn der LINK öffnet — ohne Konto.
 *
 * <b>Vier Teile, und jeder hängt an einem anderen Schlüssel.</b> Die Seite
 * schreibt bei jedem dazu, WER ihn lesen kann; das ist die einzige Erklärung,
 * die ein Mensch hier wirklich braucht, und sie steht am Inhalt statt in einer
 * Hilfe, die niemand aufschlägt.
 *
 * <code>
 *   1  von der Lehrerin, nur für dich   Platzschlüssel
 *   2  gemeinsam für die Klasse         Klassenschlüssel (im Platz verpackt)
 *   3  deine eigenen Angaben            dein Rollenschlüssel — braucht ein Konto
 *   4  was du der Schule gegeben hast   Annahmeschlüssel des Amtes
 * </code>
 *
 * <b>Und das Fünfte wird GENANNT, obwohl es nicht zu sehen ist:</b> die Schule
 * führt Notizen, die hier nicht erscheinen. Sie zu verschweigen wäre bequem und
 * unehrlich — wer das später erfährt, erfährt es als Überraschung.
 *
 * <b>Der Schlüssel steht in der Adresse, hinter der Raute.</b> Er geht nie an
 * den Dienst: der bekommt das Token und gibt dafür eine Hülle heraus,
 * aufgemacht wird sie hier.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPublic, type Occurrence } from './calendar';
import { fromBase64Url, openText } from './crypto';
import type { SealedRole } from './keys';
import { Field, aad } from './crypto';
import { keysFor } from './ringOf';
import { bindSeat, loadPortal, openGrants, openPortal, type Portal } from './seat';
import { pagePath } from './routes';
import { whoIsThere, WorkspaceError, type Who } from './session';

interface Shared {
  readonly name: string;
  readonly when: string;
  readonly what: string | null;
}

export function SeatPortal({ token, keyText, under }: {
  token: string;
  keyText: string | null;
  /** Die Seite, unter der dieser Platz hängt — `lo13`. */
  under: string | null;
}) {
  const [portal, setPortal] = useState<Portal | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [seatKey, setSeatKey] = useState<Uint8Array | null>(null);
  const [shared, setShared] = useState<readonly Shared[]>([]);
  const [sharedNames, setSharedNames] = useState<readonly string[]>([]);
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
      setSharedNames(found.grants.map((g) => g.areaName));

      if (keyText === null) return;

      let key: Uint8Array;
      try {
        const opened = await openPortal(found, fromBase64Url(keyText));
        key = opened.seatKey;
        setSeatKey(key);
        setNote(opened.personal);
      } catch {
        setSeatKey(null);
        setNote(null);
        return;
      }

      /*
       * Das Gemeinsame. Der Klassenschlüssel steckt im Platz; das Token sagt
       * dem Dienst, welche Bereiche er herausgeben darf — der Schlüssel selbst
       * geht nie hinaus.
       */
      const keys = await openGrants(found.grants, key);
      const rows: Shared[] = [];

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 30);

      for (const grant of found.grants) {
        const classKey = keys.get(grant.areaId);
        if (classKey === undefined) continue;

        for (const calendar of grant.calendars) {
          let days;
          try { days = await loadPublic(calendar.calendarId, from, to, undefined, token); }
          catch { continue; }

          for (const one of days.occurrences) {
            rows.push({
              name: grant.areaName,
              when: one.startsAt,
              what: await titleOf(one, classKey.key)
            });
          }
        }
      }

      rows.sort((a, b) => a.when.localeCompare(b.when));
      setShared(rows);
    } catch (e) {
      setPortal(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć.');
    }
  }, [token, keyText]);

  useEffect(() => { void look(); }, [look]);

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
    if (portal == null || seatKey === null) return;

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
        <p className="wk-lede">Link mógł zostać wycofany albo stracić ważność. {failed}</p>
      </>
    );
  }

  return (
    <>
      {under !== null && under !== '' && (
        <p className="wk-row-side">
          <a className="wk-link" href={pagePath(under)}>← {under}</a>
        </p>
      )}

      <h1 className="wk-h1">
        {portal.recipientName === null ? 'Twoje miejsce' : portal.recipientName}
      </h1>

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

      {failed !== null && <p className="wk-error">{failed}</p>}

      {/* -- 1 ---------------------------------------------------------- */}

      <Zone title="Od nauczyciela" who="Widzisz to tylko Ty i szkoła.">
        {note === null
          ? <p className="wk-empty">Nic tu jeszcze nie napisano.</p>
          : <p className="wk-card-text" style={{ whiteSpace: 'pre-wrap' }}>{note}</p>}
      </Zone>

      {/* -- 2 ---------------------------------------------------------- */}

      <Zone
        title="Wspólne dla klasy"
        who={sharedNames.length === 0
          ? 'Ten link nie otwiera niczego wspólnego.'
          : `Widzi to cała klasa: ${sharedNames.join(', ')}.`}
      >
        {shared.length === 0
          ? <p className="wk-empty">Nic na najbliższe tygodnie.</p>
          : (
            <ul className="wk-tile-lines">
              {shared.map((s, i) => (
                <li key={i}>
                  <strong>{new Date(s.when).toLocaleDateString('pl-PL',
                    { day: 'numeric', month: 'long' })}</strong>
                  {' — '}
                  {s.what ?? 'zapieczętowane'}
                </li>
              ))}
            </ul>
          )}
      </Zone>

      {/* -- 3 ---------------------------------------------------------- */}

      <Zone title="Twoje dane" who="Należą do Ciebie. Szkoła widzi tylko to, co sam udostępnisz.">
        {who === null || who === undefined ? (
          <p className="wk-hint">
            Imię, nazwisko, telefon czy data urodzenia trzymasz u siebie — nie
            w szkole. Potrzebujesz do tego konta; wtedy sam decydujesz, które
            pole komu dajesz, po jednym.
          </p>
        ) : (
          <p className="wk-hint">
            Prowadzisz je w zakładce <strong>Konto → Moje dane</strong>. Każde
            pole udostępniasz osobno — numer telefonu nie pociąga za sobą daty
            urodzenia.
          </p>
        )}
      </Zone>

      {/* -- 4 ---------------------------------------------------------- */}

      <Zone title="Co przekazałeś szkole" who="Widzi to kancelaria — i Ty.">
        <p className="wk-hint">
          To, co wyślesz formularzem z tego miejsca, zostaje zapieczętowane
          kluczem kancelarii. Usługa tego nie czyta.
        </p>
      </Zone>

      {/* -- Das Fünfte: genannt, obwohl unsichtbar -------------------- */}

      <p className="wk-hint">
        Szkoła prowadzi też własne notatki o uczniu — ocena, obecność, uwagi.
        <strong> Tutaj ich nie widać</strong>, i tak ma być; piszemy o tym, żeby
        nie było to niespodzianką.
      </p>

      {portal.expiresAt !== null && (
        <p className="wk-hint">
          Link działa do {new Date(portal.expiresAt).toLocaleDateString('pl-PL',
            { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      )}

      {/* -- Binden ----------------------------------------------------- */}

      {bound ? (
        <p className="wk-done">
          Gotowe. To miejsce jest teraz przypisane do Ciebie — znajdziesz je w
          swoim koncie, także bez tego linku.
        </p>
      ) : seatKey === null || who === undefined ? null : who === null ? (
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
        <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void bind(); }}>
          <h2 className="wk-h2">Przypisz do siebie</h2>

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

/**
 * Ein Abschnitt, der sagt, WER ihn sieht.
 *
 * Die Zeile darunter ist nicht Zierde: sie ist das Einzige, woran ein Mensch
 * die vier Teile auseinanderhält. Ohne sie sähe alles gleich aus, und er
 * schriebe in den falschen.
 */
function Zone({ title, who, children }: {
  title: string;
  who: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wk-form">
      <h2 className="wk-h2">{title}</h2>
      <p className="wk-row-side">{who}</p>
      {children}
    </section>
  );
}

/** Der Titel eines Eintrags — offen, wenn er offen ist, sonst aufgemacht. */
async function titleOf(one: Occurrence, key: Uint8Array): Promise<string | null> {
  if (one.titlePublic !== null && one.titlePublic !== '') return one.titlePublic;

  const sealed = one.fields.find((f) => f.field === 'title');
  if (sealed === undefined) return null;

  try {
    return await openText(
      key,
      aad('calendar', 'item', one.itemId, Field.CalendarEventTitle, 1),
      fromBase64Url(sealed.sealed)
    );
  } catch {
    return null;
  }
}

export default SeatPortal;
