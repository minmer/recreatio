/**
 * Der Arbeitsplatz — die Anwendung des Neubaus.
 *
 * <b>Wo sie steht.</b> `recreatio.pl/#/workspace`. Nicht mehr unter `#/new`:
 * der Neubau ist kein Parallelbau neben dem Altbestand mehr, sondern die
 * Plattform.
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

import { useCallback, useEffect, useState } from 'react';

import { Crumbs } from './Crumbs';
import {
  foreignHost, localPath, needsIdentity, parsePath, path, spotOf,
  type Address, type Spot
} from './routes';
import { signOut, whoIsThere, type Who } from './session';
import { PublicPage } from './PublicPage';
import { SeatPortal } from './SeatPortal';
import { SignIn } from './SignIn';
import { Verify } from './Verify';
import { Workspace } from './Workspace';

export function App() {
  const [address, setAddress] = useState<Address>(() => parsePath(window.location.hash));

  /*
   * Die Raute im Rohzustand. Unter einer eigenen Domain heisst sie etwas
   * anderes als hier (`localPath`), und `address` wäre dort eine Fehldeutung:
   * `#/kursy` ist dann kein Teil und keine Seite, sondern ein lokaler Pfad.
   */
  const [hash, setHash] = useState<string>(() => window.location.hash);

  useEffect(() => {
    const onHash = () => {
      setAddress(parsePath(window.location.hash));
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /** `undefined` = noch nicht nachgesehen, `null` = niemand. */
  const [who, setWho] = useState<Who | null | undefined>(undefined);

  const look = useCallback(async () => {
    if (!needsIdentity(address)) { setWho(null); return; }
    setWho(await whoIsThere());
  }, [address]);

  useEffect(() => { void look(); }, [look]);

  /*
   * Eine Adresse, der der Teil fehlt (`#/schola`). Sie wird NICHT
   * stillschweigend zur Startseite — wer so einen Link bekommen hat, soll
   * erfahren, dass der Teil fehlt, statt woanders zu landen.
   */
  if (address.stray !== null) {
    return (
      <Shell>
        <h1 className="wk-h1">Ta ścieżka nic tu nie znaczy</h1>
        <p className="wk-lede">
          Nic nie nazywa się samo <code>{address.stray}</code>. Każdy adres
          podaje najpierw część, potem rzecz — na przykład{' '}
          <code>{path('workspace')}</code>.
        </p>
        <p><a className="wk-link" href={path('workspace')}>Przejdź do warsztatu</a></p>
      </Shell>
    );
  }

  /*
   * EINE EIGENE DOMAIN zeigt genau eine Seite, und welche, sagt das Register.
   * Die Adresszeile gilt hier nicht: wer cogita.pl aufruft, meint cogita.pl und
   * nicht einen Teil des Arbeitsplatzes, der zufällig hinter derselben Raute
   * läge.
   */
  const domain = foreignHost();
  if (domain !== null) {
    return <Shell wide><PublicPage host={domain} local={localPath(hash)} /></Shell>;
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
    return <Shell><Verify token={address.slug} /></Shell>;
  }

  if (address.seat !== null) {
    return (
      <Shell>
        <SeatPortal
          token={address.seat.token}
          keyText={address.seat.key}
          under={address.page}
        />
      </Shell>
    );
  }

  if (address.page !== null) {
    return <Shell wide><PublicPage path={address.page} /></Shell>;
  }

  if (who === undefined) {
    return <Shell><p className="wk-lede">Sprawdzanie…</p></Shell>;
  }

  if (who === null) {
    return <Shell><SignIn onDone={setWho} /></Shell>;
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
    <Shell
      who={who}
      wide
      spot={spot}
      onSignOut={() => { void signOut().then(() => setWho(null)); }}
    >
      <Workspace spot={spot} who={who} />
    </Shell>
  );
}

function Shell({
  children, who, wide = false, spot, onSignOut
}: {
  children: React.ReactNode;
  who?: Who;
  /** Die Kacheln brauchen zwei Spalten; ein Text braucht eine Zeilenlänge. */
  wide?: boolean;

  /**
   * Wo im Arbeitsplatz wir stehen — oder nichts, wenn wir gar nicht darin sind.
   *
   * <b>Eine öffentliche Seite bekommt KEINEN Weg.</b> Sie gehört der Welt
   * draussen; ein „Warsztat › …“ darüber wäre ein Verweis auf ein Haus, in dem
   * der Besucher nichts zu suchen hat und meistens auch kein Konto.
   */
  spot?: Spot;
  onSignOut?: () => void;
}) {
  return (
    <div className="wk-root">
      {/*
        Der Streifen geht ueber die ganze Breite, sein INHALT nicht: er steht
        ueber derselben Spalte wie die Seite darunter. Ohne diese innere Huelle
        klebte die Marke ganz links, waehrend der Text in der Mitte begaenne —
        zwei Anfaenge auf einem Bild.
      */}
      <header className="wk-top">
        <div className={wide ? 'wk-top-in wk-top-in-wide' : 'wk-top-in'}>
          {/*
            Die Marke führt nach Hause. Sie war bisher ein toter Schriftzug —
            und die eine Stelle, an der jeder zuerst klickt, wenn er sich
            verlaufen hat.
          */}
          <a className="wk-brand" href={path('workspace')}>REcreatio</a>
          <span className="wk-stage">Neubau</span>

          {spot !== undefined && <Crumbs spot={spot} />}

          {who !== undefined && (
            <span className="wk-who">
              {who.loginId}
              {onSignOut !== undefined && (
                <button type="button" className="wk-link-btn" onClick={onSignOut}>Wyloguj</button>
              )}
            </span>
          )}
        </div>
      </header>
      <main className={wide ? 'wk-main wk-main-wide' : 'wk-main'}>{children}</main>
    </div>
  );
}

export default App;
