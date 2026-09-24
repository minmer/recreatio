/**
 * Der Platz, wie ihn der LINK öffnet — ohne Konto.
 *
 * <b>Es steht hier, was da ist — und sonst nichts.</b> Die Seite trug einmal
 * vier feste Abschnitte, und bei einem Firmling waren drei davon leer: keine
 * Nachricht, kein gemeinsamer Kalender, kein Konto. Ein leerer Kasten ist keine
 * Auskunft; er sieht aus wie etwas Kaputtes und schiebt das Einzige, worum
 * jemand herkommt, nach unten. Jeder Abschnitt erscheint deshalb nur gefüllt.
 *
 * <code>
 *   die eigene Einsendung   Platzschlüssel      — und sie lässt sich ändern
 *   von der Kanzlei         Platzschlüssel      — wenn etwas geschrieben wurde
 *   gemeinsam für die Gruppe Gruppenschlüssel   — wenn der Platz einen trägt
 * </code>
 *
 * <b>Die Angabe gehört dem Menschen, nicht dem Amt.</b> Darum steht der Knopf
 * zum Berichtigen hier und nicht in der Kanzlei: wer sich vertippt hat, soll es
 * selbst geradeziehen können.
 *
 * <b>Was noch nicht da ist, wird als Satz gesagt</b> und nicht als leere
 * Überschrift. Ein Versprechen in Form eines leeren Kastens ist keines.
 *
 * <b>Der Schlüssel steht in der Adresse, hinter der Raute.</b> Er geht nie an
 * den Dienst: der bekommt das Token und gibt dafür eine Hülle heraus,
 * aufgemacht wird sie hier.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPublicKey } from './area';
import { loadPublic, type Occurrence } from './calendar';
import { fromBase64Url, openText } from './crypto';
import type { SealedRole } from './keys';
import { Field, aad } from './crypto';
import { keysFor } from './ringOf';
import { openSubmitted } from './form';
import { bindSeat, loadPortal, openGrants, openPortal, type Portal } from './seat';
import { recall, remember } from './seatKeep';
import { pagePath } from './routes';
import { PageParts } from './PageParts';
import { toDraft } from './page';
import { SeatContext, type SeatView } from './seatContext';
import { Submission } from './Submission';
import { whoIsThere, WorkspaceError, type Who } from './session';

interface Shared {
  readonly name: string;
  readonly when: string;
  readonly what: string | null;
}

/** Was nicht aufgeht, ist `null` — ein kaputter Link ist kein Absturz. */
function quiet<T>(todo: () => T): T | null {
  try { return todo(); } catch { return null; }
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

  /** Was er selbst eingetragen hat — Frage und Antwort, beide aufgemacht. */
  const [mine, setMine] = useState<readonly { fieldId: string; label: string | null; value: string | null }[]>([]);
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

      /*
       * AUS DEM LINK ODER AUS DEM BROWSER — in dieser Reihenfolge.
       *
       * Der Link gilt, wenn einer da ist: wer einen NEUEN bekommen hat
       * (`relink`), soll den neuen benutzen und nicht den alten, der noch
       * herumliegt. Sonst der behaltene, und das ist der Normalfall — nach
       * dem ersten Mal steht er nicht mehr in der Adresse.
       */
      const fromLink = keyText === null ? null : quiet(() => fromBase64Url(keyText));
      const held = fromLink ?? recall(token);

      if (held === null) return;

      let key: Uint8Array;
      try {
        const opened = await openPortal(found, held);
        key = opened.seatKey;
        setSeatKey(key);

        /* Er geht auf — also ist er der richtige, und er darf bleiben. */
        remember(token, held);
        setNote(opened.personal);
      } catch {
        setSeatKey(null);
        setNote(null);
        return;
      }

      /*
       * WAS ER SELBST EINGETRAGEN HAT (0027) — beim Firmling sein Formular.
       *
       * Der Wert hängt am Platz, die FRAGE dagegen an der Epoche des Bereichs.
       * Die liegt bei einem öffentlichen Formular offen — sonst hätte er es nie
       * ausfüllen können. Bleibt sie zu, steht die Antwort trotzdem da, nur
       * ohne Beschriftung.
       */
      if (found.submitted.length > 0) {
        const epochs = new Map<string, Uint8Array>();

        for (const areaId of new Set(found.submitted.map((s) => s.areaId))) {
          try {
            epochs.set(areaId, fromBase64Url((await loadPublicKey(areaId)).key));
          } catch {
            // Nicht offengelegt. Die Antwort bleibt lesbar, die Frage nicht.
          }
        }

        setMine(await openSubmitted(found.submitted, key, epochs));
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

  /*
   * WAS DIESE SEITE ZEIGT, BESTIMMT DIE KANZLEI (0028).
   *
   * Hat der Bereich eine Portalvorlage, kommen ihre Bausteine mit, und sie
   * werden gezeichnet wie jede andere Seite — mit `PageParts`, im selben
   * Raster, mit denselben Modulen. Wer dort einen Text dazustellen will, tut es
   * im Seiteneditor und braucht dafür keine neue Fassung dieser Anwendung.
   *
   * Ohne Vorlage bleibt die eingebaute Gestalt darunter stehen. Das ist kein
   * Übergangszustand, den man später wegräumt: ein Platz, den jemand ohne
   * Vorlage ausgestellt hat, soll trotzdem etwas zeigen.
   */
  const seat: SeatView = {
    token,
    seatKey,
    recipientName: portal.recipientName,
    note,
    submitted: portal.submitted,
    opened: mine,
    shared,
    sharedNames,
    expiresAt: portal.expiresAt,
    reload: () => void look()
  };

  const template = portal.template;

  return (
    <SeatContext.Provider value={seat}>
      {under !== null && under !== '' && (
        <p className="wk-row-side">
          <a className="wk-link" href={pagePath(under)}>← {under}</a>
        </p>
      )}

      <h1 className="wk-h1">
        {template?.title ?? (portal.recipientName === null ? 'Twoje miejsce' : portal.recipientName)}
      </h1>

      <p className="wk-lede">
        {template?.lead ?? 'Ten link jest kluczem, nie legitymacją: kto go ma, widzi tę stronę. Nie przekazuj go dalej.'}
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

      {/*
        DIE VORLAGE, wenn es eine gibt — und dann NUR sie. Beides zu zeigen
        hiesse, dieselbe Einsendung zweimal untereinander zu stellen: einmal aus
        dem Baustein und einmal aus dem eingebauten Abschnitt.
      */}
      {template !== null && <PageParts parts={template.parts.map(toDraft)} />}

      {template !== null && template.parts.length === 0 && (
        <p className="wk-note">
          Ta strona jeszcze nic nie pokazuje — kancelaria dopiero układa jej
          moduły. Wróć tu za jakiś czas; adres się nie zmieni.
        </p>
      )}

      {template === null && (
      <>
      {/*
        NUR WAS DA IST.

        Diese Seite trug vier Abschnitte, und drei davon standen leer auf dem
        Platz eines Firmlings: keine Nachricht, kein gemeinsamer Kalender, kein
        Konto. Ein leerer Kasten ist keine Auskunft — er sieht aus wie etwas,
        das kaputt ist, und er schiebt das Einzige, worum jemand herkommt, nach
        unten.

        Also erscheint jeder Abschnitt nur, wenn er etwas enthält. Ein Schüler
        mit Nachricht und Klasse sieht sie weiterhin; ein Firmling sieht seine
        Angaben und sonst nichts. Dieselbe Seite, ohne Fallunterscheidung.
      */}
      {note !== null && (
        <Zone title="Od kancelarii" who="Widzisz to tylko Ty i kancelaria.">
          <p className="wk-card-text" style={{ whiteSpace: 'pre-wrap' }}>{note}</p>
        </Zone>
      )}

      {/*
        WAS ER SELBST EINGETRAGEN HAT. Steht VOR dem Gemeinsamen, weil ein
        Firmling deswegen herkommt: er hat ein Formular ausgefüllt und will
        sehen, dass es angekommen ist — und was dort steht.

        Ist nichts eingesandt worden, fehlt der Abschnitt ganz. Ein leerer
        Kasten „Twoje zgłoszenie" auf dem Platz eines Schülers behauptete, es
        gäbe dort eines.
      */}
      {portal.submitted.length > 0 && (
        <Zone
          title="Twoje zgłoszenie"
          who="Widzisz to Ty i kancelaria, która prowadzi zapisy."
        >
          {mine.length === 0 ? (
            <p className="wk-empty">Bez klucza z adresu nie da się tego otworzyć.</p>
          ) : (
            <Submission
              values={portal.submitted}
              open={mine}
              token={token}
              seatKey={seatKey}
              onSaved={() => void look()}
            />
          )}
        </Zone>
      )}

      {/* -- 2 ---------------------------------------------------------- */}

      {/* Das Gemeinsame — nur, wenn dieser Platz wirklich etwas aufschliesst. */}
      {shared.length > 0 && (
        <Zone
          title="Wspólne dla grupy"
          who={`Widzą to wszyscy: ${sharedNames.join(', ')}.`}
        >
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
        </Zone>
      )}

      {/*
        WAS HIER NOCH KOMMT — statt vier leerer Kästen.

        Die Abschnitte über eigene Daten und über das, was man dem Amt gegeben
        hat, standen hier als Versprechen in Form leerer Überschriften. Ein
        leerer Kasten verspricht nichts, er sieht kaputt aus. Ein Satz verspricht
        etwas und sagt zugleich, dass es noch nicht da ist — das ist ehrlicher
        und kürzer.
      */}
      <p className="wk-note">
        <strong>To jest Twoja strona.</strong> Z czasem wszystko będzie się
        działo tutaj: terminy i spotkania, wiadomości od kancelarii, zgoda na
        to, co udostępniasz. Na razie jest tu Twoje zgłoszenie — wracaj pod ten
        sam adres, on się nie zmieni.
      </p>
      </>
      )}

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
    </SeatContext.Provider>
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
