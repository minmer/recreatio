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

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { PlainFrame, PublicFrame } from './shell/Frame';
import {
  foreignHost, localPath, needsIdentity, parsePath, spotOf, viewPath,
  type Address
} from './routes';
import { forget as forgetState } from './core/prefs';
import { keepFromAddress } from './seats/seatKeep';
import { heldLinks, keepLinkFromAddress } from './links/linkKeep';
import { keepsKey, signOut, whoIsThere, type Who } from './core/session';
import { PublicPage } from './pages/PublicPage';
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

  const look = useCallback(async () => {
    if (!needsIdentity(address)) { setWho(null); return; }
    setWho(await whoIsThere());
  }, [address]);

  useEffect(() => { void look(); }, [look]);

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
        <SignIn onDone={setWho} />
      </PlainFrame>
    );
  }

  /* Abmelden: Meldungen des Geräts vergessen, dann die Sitzung, dann was im Speicher liegt. */
  const signOutNow = () => {
    void (async () => {
      const [notify, chat, libraries] = await Promise.all([import('./notify/notify'), import('./chat/chat'), import('./library/libraryStore')]);
      await notify.forgetNotifications().catch(() => undefined);
      await signOut();
      forgetState(); chat.forgetAreaKeys(); libraries.forgetLibraries(); setWho(null);
    })();
  };

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
      <WorkspaceShell who={who} spot={spot} onSignOut={signOutNow} />
    </Suspense>
  );
}

export default App;
