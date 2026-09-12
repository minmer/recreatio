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

import { needsIdentity, parsePath, path, spotOf, type Address } from './routes';
import { signOut, whoIsThere, type Who } from './session';
import { SignIn } from './SignIn';
import { Workspace } from './Workspace';

export function App() {
  const [address, setAddress] = useState<Address>(() => parsePath(window.location.hash));

  useEffect(() => {
    const onHash = () => setAddress(parsePath(window.location.hash));
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

  if (who === undefined) {
    return <Shell><p className="wk-lede">Sprawdzanie…</p></Shell>;
  }

  if (who === null) {
    return <Shell><SignIn onDone={setWho} /></Shell>;
  }

  return (
    <Shell
      who={who}
      wide
      onSignOut={() => { void signOut().then(() => setWho(null)); }}
    >
      <Workspace spot={spotOf(address)} />
    </Shell>
  );
}

function Shell({
  children, who, wide = false, onSignOut
}: {
  children: React.ReactNode;
  who?: Who;
  /** Die Kacheln brauchen zwei Spalten; ein Text braucht eine Zeilenlänge. */
  wide?: boolean;
  onSignOut?: () => void;
}) {
  return (
    <div className="wk-root">
      <header className="wk-top">
        <span className="wk-brand">REcreatio</span>
        <span className="wk-stage">Neubau</span>

        {who !== undefined && (
          <span className="wk-who">
            {who.loginId}
            {onSignOut !== undefined && (
              <button type="button" className="wk-link-btn" onClick={onSignOut}>Wyloguj</button>
            )}
          </span>
        )}
      </header>
      <main className={wide ? 'wk-main wk-main-wide' : 'wk-main'}>{children}</main>
    </div>
  );
}

export default App;
