/**
 * Der Einstieg des Neubaus.
 *
 * <b>Warum das Mounten hier steht und nicht in `main.tsx`.</b> Die Weiche dort
 * kennt beide Seiten und darf deshalb von keiner etwas importieren, das nicht
 * hinter einem `import()` liegt — sonst zieht sie beim Laden der einen Seite
 * die andere mit herein. Diese Datei ist die erste, die ausschliesslich zum
 * Neubau gehoert; ab hier gibt es den Altbestand nicht mehr.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { keepFromAddress } from './seatKeep';
import './app.css';

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
  const cleaned = keepFromAddress(window.location.hash);
  if (cleaned === null) return;

  /* `replaceState` und nicht `hash =`: der Zurück-Pfeil soll nicht auf die
     Fassung MIT Schlüssel zurückführen. */
  window.history.replaceState(null, '', cleaned);
}

/**
 * Die Leiste des Telefons in der Farbe des Grundes — hell oder dunkel, wie die
 * Seite selbst. `index.html` sagt Weiss, und das gilt für den Altbestand
 * weiter; im dunklen Thema des Neubaus stand darüber ein weisser Balken.
 *
 * Die Farbe kommt aus dem Stilblatt (`--wk-ground`), nicht noch einmal von hier.
 */
function followTheme(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta === null) return;

  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const paint = () => {
    const ground = getComputedStyle(document.documentElement).getPropertyValue('--wk-ground').trim();
    if (ground !== '') meta.content = ground;
  };

  paint();
  dark.addEventListener('change', paint);
}

export function mountApp(node: HTMLElement): void {
  tidyAddress();
  followTheme();

  ReactDOM.createRoot(node).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
