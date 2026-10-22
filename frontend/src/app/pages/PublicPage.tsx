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

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { loadPage, toDraft, type PageContent } from './page';
import { InHeader } from '../ui/headerSlot';
import { PageParts } from './PageParts';
import { PagePresentation } from './presentation/PagePresentation';
import { PageSlides } from './slides/PageSlides';
import { PersonAccessGate, PersonPicker, PersonProvider } from './pagePerson';
import { NoAccess, PageAccessContext } from './pageAccess';
import { PageLogicProvider } from './PageLogicView';
import { PageSubjectProvider, SubjectBar } from './pageSubject';
import { SiteMenu } from './SiteMenu';
import { SeatContext, SeatStateContext, useSeats, useSeatStates, type SeatState } from '../seats/seatContext';
import { freshSeat, heldSeats, SEATS_EVENT, seatsExactly, seatsFor } from '../seats/seatKeep';
import { heldProofs } from '../links/linkAccess';
import { useHeldLinksStamp } from '../links/HeldLinkBar';
import { useSeat } from '../seats/seatView';
import { WorkspaceError } from '../core/session';
import { loadSite } from './site';
import { pageSteps, viewPath } from '../routes';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { readLook } from './slides/slideLook';

/*
 * 2026-10-17 — DIE LEISTE EINES PLATZES (Bestätigen, Rozmowy, Kroki) nur, wenn
 * ein Link einen Platz gebracht hat: eine Seite ohne Link lud sie samt Rozmowa
 * und Formular mit, ohne je etwas davon zu zeigen.
 */
const SeatBarLater = lazy(() => import('../seats/SeatBar').then((m) => ({ default: m.SeatBar })));

function SeatBar({ path }: { path: string }) {
  const states = useSeatStates();
  if (states.length === 0 && freshSeat() === null) return null;
  return <Suspense fallback={null}><SeatBarLater path={path} /></Suspense>;
}

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

  /* 0073 — und sobald dieser Browser einen Link mit Zugang dazubekommt (oder vergisst). */
  const linksStamp = useHeldLinksStamp();

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
    heldProofs()
      .then((links) => (host !== undefined ? loadSite(host, local ?? '', seats, links) : loadPage(path ?? '', seats, links)))
      .then((found) => { if (alive) setPage(found); })
      .catch((e) => {
        if (!alive) return;
        const verdict = e instanceof WorkspaceError ? e.verdict : null;
        if (verdict === 'needsaccess' || verdict === 'noaccess') setDenied(verdict);
        setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać strony.');
        setPage(null);
      });

    return () => { alive = false; };
  }, [path, host, local, round, arrived, linksStamp]);

  if (page === undefined) return <Loading />;

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

  /* Wer auf einem toten Link landet, braucht einen Weg hinaus — nicht nur den Satz. */
  if (page === null) {
    return (
      <div className="ui-empty">
        <h1 className="wk-h1">Nic tu jeszcze nie ma</h1>
        <p>{failed}</p>
        <a className="wk-btn" href="#/">Strona główna</a>
      </div>
    );
  }

  /*
   * 0121 — VERSIEGELT, und dieser Browser hat (noch) keinen Schlüssel. Ein Platz
   * öffnet seine Schlüssel erst gleich (`WithSeat`) — sobald er offen ist, wird
   * die Seite noch einmal geholt.
   */
  if (page.locked === true) {
    return (
      <WithSeat path={page.path}>
        <SeatBar path={page.path} />
        <SealedPage onRetry={() => setRound((n) => n + 1)} />
      </WithSeat>
    );
  }

  const parts = page.parts.map(toDraft);

  /*
   * Übernommen, aber noch nichts geschrieben. Das ist ein eigener Zustand und
   * kein Fehler: jemand hat die Adresse, und er hat sie noch nicht gefüllt.
   */
  if (page.title === null && parts.length === 0) {
    return (
      <div className="ui-empty">
        <h1 className="wk-h1">Ta strona jest jeszcze pusta</h1>
        <p>Pod adresem recreatio.pl/{page.path} nic jeszcze nie opublikowano.</p>
        <a className="wk-btn" href="#/">Strona główna</a>
      </div>
    );
  }

  return (
    <WithSeat path={page.path}>
      <PageAccessContext.Provider value={page.access ?? null}>
      <PersonProvider path={page.path}>
        {/* 0082 — WOVON DIE SEITE HANDELT („Wybór na stronie"): oben gewählt, von jedem Baustein genommen. */}
        <PageSubjectProvider subject={page.subject} path={page.path}>
        <PageLogicProvider logic={page.logic}>
          {/* 0054 — das Menü dieser Seite oder der nächsten darüber; es steht in der Kopfleiste. */}
          {page.menu != null && page.menu.items.length > 0 && (
            <InHeader>
              <SiteMenu items={page.menu.items} from={page.menu.from} here={page.aliasOf ?? page.path} />
            </InHeader>
          )}

          {/*
            0099 — WER DIE SEITE BEARBEITEN DARF, kommt von hier gleich in den
            Editor: in der Kopfleiste, bei jeder Art der Seite (auch Slajdy und
            Prezentacja), ohne den Inhalt zu verdecken.
          */}
          {page.editable === true && (
            <a className="wk-edit-pill" href={viewPath('pages', ...pageSteps(page.aliasOf ?? page.path))} data-edit-page="">
              <Icon name="edit" />
              Edytuj stronę
            </a>
          )}

          {/*
            0062 — ALS SLAJDY: jeder Baustein ein Bildschirm, Titel und Vorspann
            auf dem ersten. Dieselben Schranken davor wie auf der Seite.
          */}
          {page.mode === 'slides' ? (
            <UntilConfirmed path={page.path}>
              <PersonAccessGate>
                <SlidesBody path={page.path} parts={parts} theme={page.theme ?? null} title={page.title} lead={page.lead} />
              </PersonAccessGate>
            </UntilConfirmed>
          ) : page.mode === 'presentation' ? (
            /* 0085 — ALS PREZENTACJA: Szenen, auf denen die Bausteine frei stehen. */
            <UntilConfirmed path={page.path}>
              <PersonAccessGate>
                <ShowBody path={page.path} parts={parts} theme={page.theme ?? null} title={page.title} pageId={page.id ?? null} />
              </PersonAccessGate>
            </UntilConfirmed>
          ) : (<>
          {page.title !== null && <h1 className="wk-h1">{page.title}</h1>}
          {page.lead !== null && <p className="wk-lede wk-page-lead">{page.lead}</p>}

          <SeatBar path={page.path} />

          <UntilConfirmed path={page.path}>
            {/*
              FÜR WEN — einmal, oben, für die ganze Seite. Die Rezerwacja, das
              Formular und die persönlichen Bausteine lesen dieselbe Wahl.
            */}
            <div className="wk-page-top"><PersonPicker /></div>
            <SubjectBar />

            {/*
              WER OBEN GEWÄHLT IST, MUSS ZUGANG HABEN — auf einer Seite nur mit
              Zugang. Sonst steht statt der Bausteine, dass es ihn braucht.
            */}
            <PersonAccessGate>
              {/*
                0098 — NUR DIE BAUSTEINE DER SEITE. Vorher standen hier, wenn die
                Seite keine persönlichen Bausteine hatte, die eingebauten Abschnitte
                (Zgłoszenie, kroki, …) — von selbst, auf jeder Seite, zu der ein
                Link führte. Was vom Formular erscheinen soll, legt die Kanzlei als
                Baustein auf die Seite, an seine Stelle.
              */}
              <PageParts parts={parts} />
            </PersonAccessGate>
          </UntilConfirmed>
          </>)}
        </PageLogicProvider>
        </PageSubjectProvider>
      </PersonProvider>
      </PageAccessContext.Provider>
    </WithSeat>
  );
}

/**
 * 0121 — EINE VERSIEGELTE SEITE OHNE SCHLÜSSEL. Der Zugang ist da (sonst hätte
 * der Dienst sie gar nicht geschickt), aber kein Weg dieses Browsers öffnet
 * ihren Schlüssel. Öffnet ein Platz gerade seine Schlüssel, wird es gleich
 * noch einmal versucht — einmal je Platz, der aufgeht.
 */
function SealedPage({ onRetry }: { onRetry: () => void }) {
  const states = useSeatStates();
  const tried = useRef(new Set<string>());

  useEffect(() => {
    for (const one of states) {
      if (one.state !== 'open' || tried.current.has(one.token)) continue;
      tried.current.add(one.token);
      onRetry();
      return;
    }
  }, [states, onRetry]);

  return (
    <div className="ui-empty">
      <h1 className="wk-h1">Ta strona jest zaszyfrowana</h1>
      <p>
        Masz do niej dostęp, ale ta przeglądarka nie ma jeszcze klucza, który ją otwiera. Klucz mają osoby z dostępem
        do obszarów strony — po zalogowaniu albo przez link dostępu. Osoba z formularza dostaje go, gdy ktoś z obsługi
        przekaże jej dostęp.
      </p>
      <button type="button" className="wk-btn" onClick={onRetry}>Spróbuj ponownie</button>
    </div>
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
  /* 0095 — und nach einer Person, die sich hier über einen Link vorgestellt hat. */
  const [added, setAdded] = useState(0);
  useEffect(() => {
    const again = () => setAdded((n) => n + 1);
    window.addEventListener(SEATS_EVENT, again);
    return () => window.removeEventListener(SEATS_EVENT, again);
  }, []);
  const tokens = useMemo(() => seatsFor(path), [path, arrived, added]);

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

/**
 * 0062 — DIE SEITE ALS SLAJDY. Für wen gehandelt wird und die Links stehen auf
 * dem ersten Slajd; die eingebauten Abschnitte, wenn sie gelten, auf dem letzten.
 */
function SlidesBody({ path, parts, theme, title, lead }: {
  path: string;
  parts: ReturnType<typeof toDraft>[];
  theme: string | null;
  title: string | null;
  lead: string | null;
}) {
  const look = useMemo(() => readLook(theme), [theme]);

  return (
    <PageSlides
      parts={parts}
      look={look}
      title={title}
      lead={lead}
      extra={<><SeatBar path={path} /><div className="wk-page-top"><PersonPicker /></div><SubjectBar /></>}
    />
  );
}

/**
 * 0085 — DIE SEITE ALS PRÄSENTATION. Titel und Vorspann der Seite stehen nicht
 * darauf (die Szenen sagen, was sie sagen); für wen, und die Links, stehen
 * klein oben links, solange es etwas zu sagen gibt.
 */
function ShowBody({ path, parts, theme, title, pageId }: {
  path: string;
  parts: ReturnType<typeof toDraft>[];
  theme: string | null;
  title: string | null;
  /** 2026-10-21 — unter ihr merkt sich ein Przebieg Antworten und Stelle. */
  pageId: string | null;
}) {
  const look = useMemo(() => readLook(theme), [theme]);

  return (
    <PagePresentation
      parts={parts}
      look={look}
      title={title}
      pageId={pageId}
      extra={<><SeatBar path={path} /><div className="wk-page-top"><PersonPicker /></div><SubjectBar /></>}
    />
  );
}

export default PublicPage;
