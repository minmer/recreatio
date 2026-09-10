/**
 * Der Arbeitsplatz — die Anwendung des Neubaus.
 *
 * <b>Wo sie steht.</b> `recreatio.pl/#/workspace`. Nicht mehr unter `#/new`:
 * der Neubau ist kein Parallelbau neben dem Altbestand mehr, sondern die
 * Plattform. Der Altbestand liegt daneben, bis er abgeschaltet wird.
 *
 * <b>Was sie heute kann.</b> Die Adresse auflösen und die Anmeldung verlangen.
 * Mehr nicht, und das ist Absicht: Datenbank und Dienst des Neubaus entstehen
 * gerade erst. Eine Oberfläche, die Kacheln zeigt, hinter denen nichts liegt,
 * ist schwerer zu korrigieren als eine, die noch keine hat.
 *
 * <b>Warum die Anmeldung trotzdem schon steht.</b> Sie ist keine Verzierung,
 * die man später davorschiebt: an ihr hängt, wer diese Seite überhaupt bauen
 * darf, und sie entscheidet, was vor dem ersten Bild geladen wird. Nachträglich
 * eingezogen wäre sie eine Prüfung an der Oberfläche statt einer Grenze.
 */

import { useEffect, useState } from 'react';

import { needsIdentity, parsePath, path, type Address } from './routes';

export function WorkspaceApp() {
  const [address, setAddress] = useState<Address>(() => parsePath(window.location.hash));

  useEffect(() => {
    const onHash = () => setAddress(parsePath(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /*
   * WER HIER IST — noch ungefragt.
   *
   * `null` heisst „noch nicht nachgesehen", `false` heisst „niemand". Die
   * beiden auseinanderzuhalten ist der Unterschied zwischen einer Seite, die
   * kurz „nicht angemeldet" aufblitzen lässt, und einer, die wartet, bis sie
   * es weiss.
   */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!needsIdentity(address)) { setSignedIn(false); return; }

    let alive = true;
    void (async () => {
      const { whoIsThere } = await import('./session');
      const who = await whoIsThere();
      if (alive) setSignedIn(who);
    })();
    return () => { alive = false; };
  }, [address]);

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
          <code>{path('workspace')}</code>. W linku, którym przyszedłeś, części
          zabrakło.
        </p>
        <p><a className="wk-link" href={path('workspace')}>Przejdź do warsztatu</a></p>
      </Shell>
    );
  }

  if (signedIn === null) {
    return <Shell><p className="wk-lede">Sprawdzanie…</p></Shell>;
  }

  if (!signedIn) {
    return (
      <Shell>
        <h1 className="wk-h1">Warsztat</h1>
        {/*
          WARUM DIESE SEITE GERADE JETZT DASTEHT.

          Wer eine Adresse aufgerufen hat und stattdessen eine Aufforderung zum
          Anmelden sieht, hat zwei Fragen: was mit seiner Adresse passiert ist,
          und ob er danach dorthin zurückkommt. Beide werden beantwortet,
          statt ihn raten zu lassen.
        */}
        <p className="wk-note">
          Warsztat jest tym, do czego masz klucze — bez zalogowania nie ma tu
          czego pokazać. Po zalogowaniu wrócisz dokładnie tutaj.
        </p>
        <p className="wk-lede">
          Logowanie do nowej platformy powstaje razem z jej usługą. Na razie
          konta prowadzi poprzednia wersja.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="wk-h1">Warsztat</h1>
      <p className="wk-lede">
        Tu jest to, do czego masz klucze. Strony organizacji są dla wszystkich —
        warsztat jest Twój, i dlatego wygląda inaczej u każdego.
      </p>
      <p className="wk-note">
        Wnętrze — Twoje organizacje, wspólnoty i zgłoszenia — powstaje. Adres i
        logowanie już stoją; reszta dochodzi na tym fundamencie.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wk-root">
      <header className="wk-top">
        <span className="wk-brand">REcreatio</span>
        <span className="wk-stage">Neubau</span>
      </header>
      <main className="wk-main">{children}</main>
    </div>
  );
}

export default WorkspaceApp;
