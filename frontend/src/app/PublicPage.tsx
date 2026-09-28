/**
 * Eine öffentliche Seite — das, was unter `recreatio.pl/<adresse>` steht.
 *
 * <b>Ohne Konto, ohne Schlüssel, ohne Warten auf die Anmeldung.</b> Wer hier
 * ankommt, ist meistens niemand, den die Plattform kennt: ein Besucher, der
 * einen Link bekommen hat. Er bekommt die Seite und kein Formular.
 *
 * <b>Drei Zustände, nicht zwei.</b> „Wird geladen", „hier ist nichts" und „hier
 * steht etwas" sehen verschieden aus. Wer die ersten beiden zusammenwirft,
 * zeigt jedem Besucher für einen Moment eine leere Seite — und wer sie
 * wegklickt, bevor der Text da ist, kommt nicht wieder.
 *
 * <b>Und wer seinen Platz hier hat, sieht ihn auch hier.</b> Der
 * Platzschlüssel liegt im Browser (`seatKeep`), nicht in der Adresse — also
 * gilt er auf der ganzen Adresse und nicht nur auf der einen Seite, über die
 * man hereinkam. Vorher ging alles wieder zu, sobald man eine Seite
 * weiterging, und es sah aus, als hätte man den Link nie geöffnet.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { loadPage, toDraft, type PageContent } from './page';
import { PageParts } from './PageParts';
import { PersonAccessGate, PersonPicker, PersonProvider, usePerson } from './pagePerson';
import { NoAccess, PageAccessContext } from './pageAccess';
import { PageLogicProvider } from './PageLogicView';
import { PersonalSections, SeatBar } from './SeatBar';
import { SeatContext, SeatStateContext, useSeats, useSeatStates, type SeatState } from './seatContext';
import { freshSeat, heldSeats, seatsExactly, seatsFor } from './seatKeep';
import { useSeat } from './seatView';
import { WorkspaceError } from './session';
import { loadSite } from './site';

/**
 * Entweder eine Adresse — oder eine eigene Domain, die eine zeigt.
 *
 * Beides endet bei derselben Antwort; welcher Weg es war, sieht man ihr nicht
 * an, und das ist richtig so.
 */
export function PublicPage({ path, host, local }: { path?: string; host?: string; local?: string }) {
  const [page, setPage] = useState<PageContent | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);

  /* Nur mit Zugang — und ohne ihn (0050): „trzeba mieć dostęp", nicht „nic tu nie ma". */
  const [denied, setDenied] = useState<'needsaccess' | 'noaccess' | null>(null);

  /* Neu laden, sobald ein Link hier bestätigt wurde — dann gilt er. */
  const [round, setRound] = useState(0);

  /*
   * UND SOBALD EIN NEUER LINK HIERHER FÜHRT — auch auf dieselbe Adresse. Wer
   * erst ohne Link auf der Seite stand („trzeba mieć dostęp“) und dann seinen
   * Link öffnet, bleibt auf demselben Pfad; ohne das bliebe die Absage stehen.
   */
  const arrived = freshSeat()?.token ?? null;

  useEffect(() => {
    // Wer schnell zwischen zwei Adressen wechselt, bekommt sonst die Antwort
    // der ersten auf die zweite Seite geschrieben.
    let alive = true;
    setPage(undefined);
    setDenied(null);

    /*
     * DIE LINKS DIESES BROWSERS gehen mit: auf einer Seite nur mit Zugang
     * entscheiden sie, ob und für wen man sie sieht. Unter einer eigenen
     * Domain ist das Haus erst nach der Antwort bekannt — dann alle.
     */
    const seats = host !== undefined ? heldSeats() : seatsFor(path ?? '');

    // Unter einer eigenen Domain ist der Pfad LOKAL: was die Wurzel ist, setzt
    // der Dienst davor (`routes.localPath`).
    (host !== undefined ? loadSite(host, local ?? '', seats) : loadPage(path ?? '', seats))
      .then((found) => { if (alive) setPage(found); })
      .catch((e) => {
        if (!alive) return;
        const verdict = e instanceof WorkspaceError ? e.verdict : null;
        if (verdict === 'needsaccess' || verdict === 'noaccess') setDenied(verdict);
        setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać strony.');
        setPage(null);
      });

    return () => { alive = false; };
  }, [path, host, local, round, arrived]);

  if (page === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  /*
   * KEIN ZUGANG. Führte ein Link hierher, der erst fragt, wer da ist, steht
   * zuerst die Frage — danach wird die Seite neu geholt, und der Link gilt.
   */
  if (page === null && denied !== null) {
    if (path === undefined) return <NoAccess verdict={denied} />;

    return (
      <WithSeat path={path}>
        <SeatBar path={path} />
        <UntilConfirmed path={path}><NoAccess verdict={denied} /></UntilConfirmed>
        <ReloadWhenConfirmed path={path} onConfirmed={() => setRound((n) => n + 1)} />
      </WithSeat>
    );
  }

  if (page === null) {
    return (
      <>
        <h1 className="wk-h1">Nic tu jeszcze nie ma</h1>
        <p className="wk-lede">{failed}</p>
      </>
    );
  }

  const parts = page.parts.map(toDraft);

  /*
   * Übernommen, aber noch nichts geschrieben. Das ist ein eigener Zustand und
   * kein Fehler: jemand hat die Adresse, und er hat sie noch nicht gefüllt.
   */
  if (page.title === null && parts.length === 0) {
    return (
      <>
        <h1 className="wk-h1">recreatio.pl/{page.path}</h1>
        <p className="wk-lede">Ten adres jest już zajęty, ale nic tu jeszcze nie opublikowano.</p>
      </>
    );
  }

  return (
    <WithSeat path={page.path}>
      <PageAccessContext.Provider value={page.access ?? null}>
      <PersonProvider path={page.path}>
        <PageLogicProvider logic={page.logic}>
          {page.title !== null && <h1 className="wk-h1">{page.title}</h1>}
          {page.lead !== null && <p className="wk-lede wk-page-lead">{page.lead}</p>}

          <SeatBar path={page.path} />

          <UntilConfirmed path={page.path}>
            {/*
              FÜR WEN — einmal, oben, für die ganze Seite. Die Rezerwacja, das
              Formular und die persönlichen Bausteine lesen dieselbe Wahl.
            */}
            <div className="wk-page-top"><PersonPicker /></div>

            {/*
              WER OBEN GEWÄHLT IST, MUSS ZUGANG HABEN — auf einer Seite nur mit
              Zugang. Sonst steht statt der Bausteine, dass es ihn braucht.
            */}
            <PersonAccessGate>
              <PageParts parts={parts} />

              {/*
                Keine persönlichen Bausteine auf dieser Seite? Dann die eingebauten
                Abschnitte — für den Gewählten, wenn sein Link HIERHER geführt hat.
              */}
              {!parts.some((one) => one.kind.startsWith('seat-')) && <Fallback path={page.path} />}
            </PersonAccessGate>
          </UntilConfirmed>
        </PageLogicProvider>
      </PersonProvider>
      </PageAccessContext.Provider>
    </WithSeat>
  );
}

/**
 * Hält dieser Browser Plätze, die auf diese Seite gehören? Dann gelten sie —
 * ALLE, nicht bloss der zuletzt geöffnete.
 *
 * <b>Ohne Platz ändert sich nichts.</b> `SeatContext` bleibt dann leer, und
 * die persönlichen Bausteine sagen, was hier erscheinen wird.
 *
 * <b>Und es wird nichts geholt, wenn nichts zu holen ist.</b> Wer keinen
 * Platz hält — also fast jeder Besucher — löst keinen einzigen Aufruf aus:
 * welcher Platz zu welcher Seite gehört, steht im Browser neben dem
 * Schlüssel und muss nicht erfragt werden.
 */
function WithSeat({ path, children }: { path: string; children: React.ReactNode }) {
  /*
   * EINMAL JE SEITE gelesen. Jeder geöffnete Platz frischt seinen Zeitstempel
   * auf, und die Reihenfolge hängt daran — neu gelesen bei jedem Zeichnen,
   * wanderten die Plätze zwischen den Bauteilen und jeder würde neu geholt.
   */
  /* Ein neuer Link auf DIESELBE Seite bringt einen neuen Platz — also auch nach ihm neu lesen. */
  const arrived = freshSeat()?.token ?? null;
  const tokens = useMemo(() => seatsFor(path), [path, arrived]);

  return <OpenAll tokens={tokens}>{children}</OpenAll>;
}

/*
 * JE PLATZ EIN BAUTEIL, ineinander. Ein Haken darf nicht in einer Schleife
 * stehen — React zählt Haken, und eine Liste, die wächst, zählte anders.
 * Verschachtelt hat jedes Bauteil genau einen, und jedes legt seinen Platz
 * zu denen, die es von aussen bekommt.
 */
function OpenAll({ tokens, children }: { tokens: readonly string[]; children: React.ReactNode }) {
  if (tokens.length === 0) return <>{children}</>;

  return (
    <Opened token={tokens[0]}>
      <OpenAll tokens={tokens.slice(1)}>{children}</OpenAll>
    </Opened>
  );
}

function Opened({ token, children }: { token: string; children: React.ReactNode }) {
  const { portal, failed, seat, challenge, reload } = useSeat(token, null);
  const outer = useSeats();
  const outerStates = useSeatStates();

  const all = useMemo(() => (seat === null ? outer : [...outer, seat]), [outer, seat]);

  /* Wie es um DIESEN Platz steht — auch wenn er nicht aufging. */
  const state: SeatState['state'] = challenge !== null ? 'verify'
    : portal === undefined ? 'loading'
    : portal === null ? 'gone'
    : seat?.seatKey === null ? 'locked'
    : 'open';
  const states = useMemo(
    () => [...outerStates, { token, state, failed, challenge, reload }],
    [outerStates, token, state, failed, challenge, reload]);

  return (
    <SeatStateContext.Provider value={states}>
      <SeatContext.Provider value={all}>{children}</SeatContext.Provider>
    </SeatStateContext.Provider>
  );
}

/**
 * ERST BESTÄTIGEN, DANN SEHEN (0046) — die ganze Seite, nicht nur der Link.
 *
 * Wartet ein Link, der HIERHER geführt hat, auf „Potwierdź, że to Ty", steht
 * nur die Frage da. Vorher erschienen darunter die Angaben eines ANDEREN
 * Platzes, den dieser Browser noch hielt (etwa ein früher geöffneter Link auf
 * einem geteilten Telefon) — mit Namen, Geburtsdatum und Adresse, obwohl
 * gerade niemand gezeigt hatte, wer er ist.
 */
export function UntilConfirmed({ path, children }: { path: string; children: React.ReactNode }) {
  const states = useSeatStates();
  const fresh = freshSeat();
  const hereToken = fresh !== null && fresh.under === path ? fresh.token : null;
  const mine = useMemo(
    () => new Set([...(hereToken === null ? [] : [hereToken]), ...seatsExactly(path)]),
    [hereToken, path]);

  const asking = states.some((one) => one.state === 'verify' && mine.has(one.token));
  return asking ? null : <>{children}</>;
}

/**
 * Ein Link, der hierher führte, hat eben die Frage beantwortet — dann die
 * Seite neu holen. NUR beim Übergang „fragt" → „offen": sonst lüde eine Seite,
 * die man nicht sehen darf, immer wieder.
 */
function ReloadWhenConfirmed({ path, onConfirmed }: { path: string; onConfirmed: () => void }) {
  const states = useSeatStates();
  const asked = useRef(new Set<string>());
  const exact = useMemo(() => new Set(seatsExactly(path)), [path]);

  useEffect(() => {
    for (const one of states) {
      if (one.state === 'verify') asked.current.add(one.token);
      else if (one.state === 'open' && asked.current.has(one.token) && exact.has(one.token)) {
        asked.current.delete(one.token);
        onConfirmed();
      }
    }
  }, [states, exact, onConfirmed]);

  return null;
}

/** Die eingebauten Abschnitte — für den Gewählten, wenn sein Link GENAU hierher geführt hat. */
function Fallback({ path }: { path: string }) {
  const chosen = usePerson()?.chosen ?? null;
  const exact = useMemo(() => new Set(seatsExactly(path)), [path, chosen]);

  if (chosen?.kind !== 'seat' || !exact.has(chosen.seat.token)) return null;
  return <PersonalSections seat={chosen.seat} />;
}

export default PublicPage;
