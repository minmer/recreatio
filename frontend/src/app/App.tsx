/**
 * Die Anwendung — der Arbeitsplatz unter `recreatio.pl/#/workspace`, dazu die
 * öffentlichen Seiten, Links und Plätze.
 *
 * <b>Die Anmeldung steht ZUERST</b>, und zwar als Formular und nicht als
 * Hinweis darauf, dass man sich anmelden könnte. An ihr hängt, was vor dem
 * ersten Bild geladen wird; nachträglich davorgeschoben wäre sie eine Prüfung
 * an der Oberfläche statt einer Grenze.
 *
 * <b>Drei Zustände, nicht zwei.</b> `null` heisst „noch nicht nachgesehen",
 * und das ist nicht dasselbe wie „niemand". Wer die beiden zusammenwirft,
 * lässt bei jedem Laden kurz das Anmeldeformular aufblitzen, bevor der
 * angemeldete Zustand nachkommt — es sieht aus, als wäre man hinausgeflogen.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { PlainFrame, PublicFrame } from './shell/Frame';
import {
  foreignHost, localPath, needsIdentity, parsePath, spotOf, viewPath,
  type Address
} from './routes';
import { forget as forgetState } from './core/prefs';
import { keepFromAddress } from './seats/seatKeep';
import { heldLinks, keepLinkFromAddress } from './links/linkKeep';
import { keepsKey, sessionNow, signOut, type Who } from './core/session';
import { awayNow, onAway, refreshAway, resumeAway } from './core/away';
import { PublicPage } from './pages/PublicPage';
import { forgetLoadedPageKeys } from './pages/page';
import { phoneHere } from './phone/here';
import { SignIn } from './shell/SignIn';
import { Widget } from './pages/Widget';
import { Loading } from './ui/Loading';

/*
 * 2026-10-17 — NACHGELADEN, WAS EINE ÖFFENTLICHE SEITE NICHT BRAUCHT: der
 * Arbeitsplatz mit seinem Rahmen, der Kalender eines Links und das Einlösen
 * eines Links. Eine Seite der Pfarrei lud bis hierher den ganzen Arbeitsplatz
 * mit, bevor sie etwas zeigte.
 */
const WorkspaceShell = lazy(() => import('./shell/WorkspaceShell'));
const LinkCalendar = lazy(() => import('./calendar/LinkCalendar').then((m) => ({ default: m.LinkCalendar })));
const JoinLink = lazy(() => import('./links/JoinLink').then((m) => ({ default: m.JoinLink })));
const JoinWithoutAccount = lazy(() => import('./links/JoinLink').then((m) => ({ default: m.JoinWithoutAccount })));
const SeatPortal = lazy(() => import('./seats/SeatPortal').then((m) => ({ default: m.SeatPortal })));
const Verify = lazy(() => import('./seats/Verify').then((m) => ({ default: m.Verify })));
const AiConnect = lazy(() => import('./aiAccess/AiConnect').then((m) => ({ default: m.AiConnect })));
const SharedFile = lazy(() => import('./phone/SharedFile').then((m) => ({ default: m.SharedFile })));
const ReportPage = lazy(() => import('./reports/ReportPage').then((m) => ({ default: m.ReportPage })));
const AloneShell = lazy(() => import('./shell/AloneShell'));

/** Wie lange die Frage nach dem Konto dauern darf, bevor die SMS ohne es aufgehen. */
const SMS_WAIT = 2500;
/** Kommt das Konto später als das nach einem Schritt, wechselt die Ansicht erst beim nächsten. */
const SMS_STEP = 1500;
/** 2026-10-28 — ohne Netz: so oft wird von selbst nachgesehen, ob es zurück ist (dazu beim Ereignis `online`). */
const RETRY = 15000;

export function App() {
  const [address, setAddress] = useState<Address>(() => parsePath(window.location.hash));

  /*
   * Die Raute im Rohzustand. Unter einer eigenen Domain heisst sie etwas
   * anderes als hier (`localPath`), und `address` wäre dort eine Fehldeutung:
   * `#/kursy` ist dann kein Teil und keine Seite, sondern ein lokaler Pfad.
   */
  const [hash, setHash] = useState<string>(() => window.location.hash);

  /*
   * DER SCHLÜSSEL EINES PLATZES GEHÖRT NICHT IN DIE ADRESSZEILE.
   *
   * Beim Laden ist das schon geschehen (`mount.tsx`) — dort, wo noch nichts
   * gezeichnet ist. Hier bleibt der zweite Weg hinein: jemand tippt einen
   * Link in die Adresszeile eines offenen Tabs, oder folgt einem aus einer
   * Nachricht. Dann kommt der Schlüssel über `hashchange`, und er soll
   * genauso wenig stehen bleiben.
   */
  useEffect(() => {
    const onHash = () => {
      /* 0073 — ein Link mit Zugang: behalten, die Adresse ohne ihn. */
      const linked = keepLinkFromAddress(window.location.hash);
      if (linked !== null) window.history.replaceState(null, '', linked);

      const cleaned = keepFromAddress(window.location.hash);

      if (cleaned !== null) {
        window.history.replaceState(null, '', cleaned);
        setAddress(parsePath(cleaned));
        setHash(cleaned);
        return;
      }

      setAddress(parsePath(window.location.hash));
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /** `undefined` = noch nicht nachgesehen, `null` = niemand. */
  const [who, setWho] = useState<Who | null | undefined>(undefined);

  /* Ohne Konto, mit einem Link: der Kalender geht auf — es sei denn, jemand will sich anmelden. */
  const [signInWanted, setSignInWanted] = useState(false);

  /*
   * 2026-10-28 — DER DIENST IST NICHT ZU ERREICHEN (`sessionNow`): kein Netz ist kein Abmelden. Wer schon da war,
   * bleibt angemeldet (`who` bleibt); wer die App ohne Netz öffnet, kommt in die Fassung ohne Netz statt vor das
   * Anmeldeformular, das ohne Netz nie gelingt. Nachgesehen wird von selbst (`RETRY`, `online`).
   */
  const [cut, setCut] = useState(false);

  /* 2026-10-28 — jemand hat sich OHNE NETZ angemeldet (`core/away.ts`): die Fassung ohne Netz bleibt, bis das Konto zurück ist. */
  const [awayOn, setAwayOn] = useState(() => awayNow() !== null);
  useEffect(() => onAway(() => setAwayOn(awayNow() !== null)), []);

  /*
   * 2026-10-26 — SMS OHNE KONTO. In der Ausgabe „sms" liegen die SMS auf dem Telefon:
   * ohne Netz oder ohne Anmeldung gehen sie trotzdem (`AloneShell`) — statt des
   * Anmeldeformulars, mit „Zaloguj się" oben. Hängt die Frage nach dem Konto (schlechtes
   * Netz), stehen sie nach `SMS_WAIT` schon da. Kommt das Konto, während sie offen sind,
   * und nicht gleich nach einem Schritt, wartet es (`later`, „Pełna wersja") — beim
   * nächsten Schritt gilt es; mitten im Tippen wechselt nichts von selbst.
   * 2026-10-28 — dieselbe Fassung ohne Netz für jede Ausgabe, mit der Nauka: was das Gerät
   * für die Zeit ohne Netz hält, nach der Anmeldung ohne Netz.
   */
  const spotHere = address.route === 'workspace' ? spotOf(address) : null;
  const viewHere = spotHere !== null && spotHere.kind === 'view' ? spotHere : null;
  const smsHere = viewHere !== null && viewHere.view === 'sms' && !signInWanted && phoneHere();
  const [late, setLate] = useState(false);
  const [later, setLater] = useState<Who | null>(null);
  const laterRef = useRef<Who | null>(null);
  const aloneOpen = useRef(false);
  const showAlone = address.route === 'workspace' && !signInWanted
    && ((smsHere && (who === null || (who === undefined && late))) || (who === null && (cut || awayOn)));

  useEffect(() => {
    if (who !== undefined || !smsHere) return undefined;
    const timer = window.setTimeout(() => setLate(true), SMS_WAIT);
    return () => window.clearTimeout(timer);
  }, [who, smsHere]);

  useEffect(() => { aloneOpen.current = showAlone; }, [showAlone]);

  const takeLater = useCallback(() => {
    const had = laterRef.current;
    laterRef.current = null;
    setLater(null);
    if (had !== null) setWho(had);
  }, []);

  /** `step`: ein Schritt des Menschen (die Adresse) — nur dann gilt ein Konto, das gewartet hat. */
  const check = useCallback(async (step: boolean) => {
    if (!needsIdentity(address)) { setWho(null); return; }
    /* Ein Schritt weiter: ein Konto, das gewartet hat, gilt jetzt. */
    if (step) takeLater();
    const asked = Date.now();
    const now = await sessionNow();
    if (!now.reached) {
      setCut(true);
      setWho((had) => (had === undefined ? null : had));
      return;
    }
    setCut(false);
    /* Zurück im Netz ohne Sitzung, aber ohne Netz angemeldet: derselbe Schlüssel meldet an — niemand fragt zweimal. */
    const found = now.who ?? await resumeAway();
    if (found !== null && aloneOpen.current && (!step || Date.now() - asked > SMS_STEP)) {
      laterRef.current = found;
      setLater(found);
      return;
    }
    setWho(found);
  }, [address, takeLater]);

  useEffect(() => { void check(true); }, [check]);

  /* Ohne Netz: von selbst nachsehen, ob es zurück ist — mitten im Tippen wechselt dabei nichts (`later`). */
  useEffect(() => {
    if (!cut) return undefined;
    const again = () => { void check(false); };
    const timer = window.setInterval(again, RETRY);
    window.addEventListener('online', again);
    return () => { window.clearInterval(timer); window.removeEventListener('online', again); };
  }, [cut, check]);

  /*
   * 2026-10-28 — nach jeder Anmeldung: das Anmelden ohne Netz folgt dem Konto (`refreshAway`), und was ohne Netz
   * beantwortet wurde und noch in der Ablage wartet, geht hinaus — auch wenn keine Bibliothek offen ist.
   */
  const whoId = who?.accountId ?? null;
  useEffect(() => {
    if (who == null) return;
    void refreshAway(who).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whoId, who?.masterKeySealed, who?.keyKeeping]);
  useEffect(() => {
    if (whoId === null || cut) return;
    void import('./core/idb').then(async ({ idbKeys }) => {
      if ((await idbKeys('outbox', 'r:')).length === 0) return;
      await (await import('./cogita/learn')).flushWaiting();
    }).catch(() => undefined);
  }, [whoId, cut]);

  /*
   * 0109 — ABSCHRIFTEN DER BIBLIOTHEKEN nur, wo auch der Schlüssel bleiben darf
   * (`kept`): im strengen Betrieb lebt er nur im Tab, und die Hüllen sollen es
   * auch.
   */
  useEffect(() => {
    /* 2026-10-17 — nachgeladen: eine öffentliche Seite ohne Anmeldung braucht die Bibliotheken nicht. */
    if (who === undefined) return;
    void import('./library/libraryStore').then((m) => m.setLibraryCache(who !== null && keepsKey(who)));
  }, [who]);

  /*
   * EINE EIGENE DOMAIN zeigt genau eine Seite, und welche, sagt das Register.
   * Die Adresszeile gilt hier nicht: wer cogita.pl aufruft, meint cogita.pl und
   * nicht einen Teil des Arbeitsplatzes, der zufällig hinter derselben Raute
   * läge.
   */
  const domain = foreignHost();
  if (domain !== null) {
    return <PublicFrame><PublicPage host={domain} local={localPath(hash)} /></PublicFrame>;
  }

  /*
   * Eine öffentliche Seite. Sie steht VOR jeder Frage nach der Anmeldung — wer
   * `#/parish` aufruft, will die Seite sehen und nicht wissen, ob er angemeldet
   * ist.
   */
  /*
   * Ein individueller Platz — `#/lo13/portal/<token>/<key>` oder, wenn er unter
   * keiner Seite hängt, `#/seat/<token>/<key>`.
   *
   * Er steht VOR der Seite und vor der Frage nach der Anmeldung: der Link IST
   * der Ausweis, und wer ihn hat, ist meistens gerade der, der KEIN Konto hat.
   * Ob jemand angemeldet ist, fragt die Seite selbst — sie braucht es nur, um
   * das Binden anzubieten.
   */
  /*
   * Eine Nummer bestätigen (0030). Sie steht VOR der Frage nach der Anmeldung
   * und vor der Seite: wer aus einer SMS kommt, hat kein Konto und will einen
   * Handgriff, keine Anmeldemaske.
   */
  if (address.route === 'verify') {
    return <PlainFrame><Suspense fallback={<Loading />}><Verify token={address.slug} /></Suspense></PlainFrame>;
  }

  /*
   * Ein Plik przez link (0117) — aus einer SMS, ohne Konto und ohne Anmeldung: der
   * Link ist der Schlüssel.
   */
  if (address.route === 'plik') {
    return <PlainFrame><Suspense fallback={<Loading />}><SharedFile secret={address.slug ?? ''} /></Suspense></PlainFrame>;
  }

  /*
   * 0130 — ZGŁOŚ: ohne Anmeldung (melden kann jeder, was er sieht); ist jemand
   * angemeldet, reist seine Sitzung mit, und er kann auch melden, was nur er sieht.
   */
  if (address.route === 'zglos') {
    return <PlainFrame><Suspense fallback={<Loading />}><ReportPage slug={address.slug} tail={address.tail} /></Suspense></PlainFrame>;
  }

  /*
   * EIN WIDGET (0067) — ohne Kopfleiste, ohne Anmeldung: es steht in einer
   * fremden Seite und zeigt nur, was öffentlich ist.
   */
  if (address.route === 'widget') {
    return <Widget partId={address.slug} pagePath={address.tail.join('/')} />;
  }

  if (address.seat !== null) {
    return (
      <PlainFrame>
        <Suspense fallback={<Loading />}>
          <SeatPortal
            token={address.seat.token}
            keyText={address.seat.key}
            under={address.page}
          />
        </Suspense>
      </PlainFrame>
    );
  }

  if (address.page !== null) {
    return <PublicFrame><PublicPage path={address.page} /></PublicFrame>;
  }

  if (showAlone) {
    const tab = smsHere ? 'sms' : 'learn';
    const trail = viewHere === null ? []
      : tab === 'sms' ? viewHere.trail
      : viewHere.view === 'learn' && viewHere.trail[0] === 'bez-sieci' ? viewHere.trail.slice(1) : [];
    return (
      <Suspense fallback={<PlainFrame><Loading /></PlainFrame>}>
        <AloneShell
          tab={tab}
          trail={trail}
          state={later !== null ? 'back' : who === undefined ? 'checking' : cut ? 'cut' : 'none'}
          onSignIn={() => setSignInWanted(true)}
          onFull={takeLater}
          onRetry={() => { void check(false); }}
        />
      </Suspense>
    );
  }

  if (who === undefined) {
    return <PlainFrame><Loading label="Sprawdzanie…" /></PlainFrame>;
  }

  if (who === null) {
    const here = address.route === 'workspace' ? spotOf(address) : null;
    const view = here !== null && here.kind === 'view' ? here.view : null;
    const linked = address.route === 'workspace' && heldLinks().length > 0;

    /*
     * EIN LINK MIT ZUGANG ÖFFNET DEN KALENDER AUCH OHNE KONTO (0073). Das
     * Formular der Links bietet ihn als Ziel an; vorher stand, wer so einen
     * Link öffnete, vor „Zaloguj się", und der Zugang ging an der Tür verloren.
     */
    if (linked && view === 'calendar' && !signInWanted) {
      return (
        <PlainFrame wide>
          <Suspense fallback={<Loading />}>
            <LinkCalendar fallback={<SignIn onDone={setWho} />} onSignIn={() => setSignInWanted(true)} />
          </Suspense>
        </PlainFrame>
      );
    }

    /*
     * DER LINK OHNE ZIEL (`#/dolacz/<T>`), ohne Konto: was er hier gibt und
     * wohin es geht — KEIN Angebot, ihn einem Konto hinzuzufügen. Das bekommt
     * nur, wer angemeldet ist (`JoinLink`); die Anmeldung ist einen Klick weit.
     */
    if (address.route === 'dolacz' && !signInWanted) {
      return (
        <PlainFrame>
          <Suspense fallback={<Loading />}>
            <JoinWithoutAccount token={address.slug} onSignIn={() => setSignInWanted(true)} />
          </Suspense>
        </PlainFrame>
      );
    }

    return (
      <PlainFrame>
        {/*
          Die übrigen Teile des Arbeitsplatzes brauchen ein Konto — und das wird
          GESAGT, statt den Menschen mit seinem Link vor einem Anmeldeformular
          stehen zu lassen, das ihn nicht meint.
        */}
        {linked && view !== 'calendar' && (
          <p className="wk-note">
            Ta część warsztatu działa tylko z kontem. Link z dostępem, który masz w tej przeglądarce, działa
            bez logowania na stronach i w <a className="wk-link" href={viewPath('calendar')}>kalendarzu</a>.
          </p>
        )}
        {/* 2026-10-26 — w wydaniu „sms": SMS-y są w telefonie i działają bez konta (bez sieci też). */}
        {phoneHere() && (
          <p className="wk-note">
            Bez sieci albo bez konta? SMS-y działają bez logowania:{' '}
            <a className="wk-link" href={viewPath('sms')} onClick={() => setSignInWanted(false)}>otwórz SMS</a>.
          </p>
        )}
        <SignIn onDone={setWho} />
      </PlainFrame>
    );
  }

  /*
   * Abmelden: Meldungen des Geräts vergessen, dann die Sitzung, dann was im Speicher liegt. 2026-10-28 — und was
   * dieses Konto für die Zeit ohne Netz hält (die Abschriften, das Anmelden ohne Netz); die Ablage der Antworten
   * bleibt — versiegelt, sie geht mit der nächsten Anmeldung hinaus.
   */
  const signOutNow = () => {
    const leaving = who.accountId;
    void (async () => {
      const [notify, chat, libraries, away] = await Promise.all([import('./notify/notify'), import('./chat/chat'), import('./library/libraryStore'), import('./core/away')]);
      await notify.forgetNotifications().catch(() => undefined);
      await away.forgetAway(leaving).catch(() => undefined);
      away.endAway();
      await signOut();
      forgetState(); chat.forgetAreaKeys(); libraries.forgetLibraries(); forgetLoadedPageKeys(); setWho(null);
    })();
  };

  /* 0127 — ein Assistent will Recreatio lesen: erst angemeldet, dann die Wahl der Links. */
  if (address.route === 'polacz-ai') {
    return (
      <PlainFrame who={who} onSignOut={signOutNow}>
        <Suspense fallback={<Loading />}>
          <AiConnect grantId={address.slug} who={who} />
        </Suspense>
      </PlainFrame>
    );
  }

  /* 0065 — ein Link mit Zugang: erst angemeldet, dann das Zaproszenie. */
  if (address.route === 'dolacz') {
    return (
      <PlainFrame who={who} onSignOut={signOutNow}>
        <Suspense fallback={<Loading />}>
          <JoinLink token={address.slug} who={who} />
        </Suspense>
      </PlainFrame>
    );
  }

  /*
   * EINMAL ausgerechnet, und dann an beide.
   *
   * Der Kopf braucht es für den Weg, die Werkstatt für das Bild. Zweimal zu
   * rechnen hiesse: zwei Meinungen darüber, wo wir stehen — und die
   * auffällige wäre die, bei der der Weg etwas anderes sagt als die Seite.
   */
  const spot = spotOf(address);

  return (
    <Suspense fallback={<div className="wk-root wk-plain"><main className="wk-main"><Loading /></main></div>}>
      <WorkspaceShell who={who} spot={spot} onSignOut={signOutNow} cut={cut} />
    </Suspense>
  );
}

export default App;
