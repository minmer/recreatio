/**
 * Der Einstieg der Anwendung.
 *
 * <b>Warum das Mounten hier steht und nicht in `main.tsx`.</b> `main.tsx` nimmt
 * vor allem anderen den Link aus der Adresse und startet in der App die Hülle;
 * alles Weitere lädt es per `import()`, damit dieser erste Schritt klein bleibt.
 */

import React, { type ReactNode } from 'react';
import ReactDOM, { type Root } from 'react-dom/client';

import { App } from './App';
import { LangReady } from './core/i18n';
import { startTheme } from './core/theme';
import { keepFromAddress } from './seats/seatKeep';
import { keepLinkFromAddress } from './links/linkKeep';
import './app.css';
/* Das System NACH den Ansichten: bei gleichem Gewicht gewinnt es (ui/ui.css, Kopf). */
import './ui/ui.css';

/**
 * Den Schlüssel eines Platzes aus der Adresse nehmen — VOR dem ersten Bild.
 *
 * <b>Er stand in einem Effekt, und das war einen Tick zu spät.</b> Ein
 * Effekt läuft NACH dem ersten Zeichnen: einen Wimpernschlag lang stand der
 * Schlüssel in der Adresszeile eines Bildes, das der Mensch schon sah — und
 * `SeatPortal` lud zweimal, einmal mit dem Schlüssel aus dem Link und
 * gleich darauf noch einmal mit dem behaltenen.
 *
 * Hier ist die letzte Stelle, an der noch nichts gezeichnet ist.
 */
function tidyAddress(): void {
  /* 0073 — ebenso ein Link mit Zugang (`?dostep=`). */
  const linked = keepLinkFromAddress(window.location.hash);
  if (linked !== null) window.history.replaceState(null, '', linked);

  const cleaned = keepFromAddress(window.location.hash);
  if (cleaned === null) return;

  /* `replaceState` und nicht `hash =`: der Zurück-Pfeil soll nicht auf die
     Fassung MIT Schlüssel zurückführen. */
  window.history.replaceState(null, '', cleaned);
}

/**
 * `wrap` — 2026-10-27: die Vorschau für Assistenten (`preview/`) legt ihre
 * Steuerung um die Anwendung; sonst steht sie, wie sie ist.
 */
export function mountApp(node: HTMLElement, wrap: (app: ReactNode) => ReactNode = (app) => app): Root {
  tidyAddress();
  /* 2026-11-06 — hell/dunkel und Farben wie gewählt (core/theme.ts), auch die Leiste des Telefons. */
  startTheme();

  const root = ReactDOM.createRoot(node);
  root.render(
    <React.StrictMode>
      <LangReady>{wrap(<App />)}</LangReady>
    </React.StrictMode>
  );
  return root;
}
