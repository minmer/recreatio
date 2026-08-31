import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { PUBLIC_BASE } from './public/publicRoutes';
import './styles/base.css';

/**
 * Zwei Plattformen, ein Auslieferungsstand.
 *
 * Der Neuaufbau liegt unter `#/new` und läuft NEBEN dem Altbestand (2.1):
 * eigener Pfad, eigene Datenbank, eigenes Schema. Es gibt keine gemeinsame
 * Zwischenschicht, die beide bedient.
 *
 * Die Verzweigung geschieht deshalb HIER und nicht in `App.tsx`. Zwei Gründe,
 * beide handfest:
 *
 *   1. `App` hat ein gutes Dutzend Hooks. Ein früher `return` dort verstiesse
 *      gegen die Hook-Regeln; ein später Zweig zöge den ganzen Altbestand mit
 *      in den Speicher.
 *   2. Die alten Stylesheets werden per `import()` nachgeladen. Wer `#/new`
 *      öffnet, bekommt sie gar nicht erst — und die neue Oberfläche kann keine
 *      Regel des Altbestands erben, die sie nicht kennt.
 *
 * Der Hash ist keine Geschmacksfrage: GitHub Pages liefert für `/new` keine
 * Datei aus, weil es die Route nicht kennt. `#/new` bleibt für den Server ein
 * Aufruf der Startseite.
 */

/**
 * Drei Zonen, ein Auslieferungsstand.
 *
 *   `#/rc`   die neue oeffentliche REcreatio-Seite
 *   `#/new`  die Plattform (Phase 0)
 *   sonst    der Altbestand mit dem Foliensatz
 *
 * Die oeffentliche Seite liegt so lange unter `#/rc`, bis sie abgenommen ist.
 * Der Tausch danach ist zweizeilig: `PUBLIC_BASE` in `publicRoutes.ts` leeren
 * und hier `isPublic` zur Vorgabe machen. Erst dann verschwindet der
 * Foliensatz — nicht vorher, damit nie ein halber Umbau live steht.
 */
const zoneOf = (): 'public' | 'platform' | 'legacy' => {
  const hash = window.location.hash;
  if (hash === PUBLIC_BASE || hash.startsWith(`${PUBLIC_BASE}/`)) return 'public';
  if (hash.startsWith('#/new')) return 'platform';
  return 'legacy';
};

const root = ReactDOM.createRoot(document.getElementById('root')!);

async function mount() {
  const zone = zoneOf();

  if (zone === 'public') {
    const { PublicApp } = await import('./public/PublicApp');
    root.render(
      <React.StrictMode>
        <PublicApp />
      </React.StrictMode>
    );
    return;
  }

  if (zone === 'platform') {
    const { RcApp } = await import('./rc/RcApp');
    root.render(
      <React.StrictMode>
        <RcApp />
      </React.StrictMode>
    );
    return;
  }

  // Der Altbestand, unverändert. Die Stylesheets kommen mit ihm und nicht mit
  // dem Neuaufbau.
  const [{ default: App }, { AuthProvider }] = await Promise.all([
    import('./App'),
    import('./lib/authContext'),
    import('./styles/components.css'),
    import('./styles/home.css'),
    import('./styles/panels.css'),
    import('./styles/portal.css'),
    import('./styles/auth.css'),
    import('./styles/responsive.css'),
    import('./styles/chat.css'),
    import('./styles/calendar.css'),
    import('./styles/cg.css'),
    import('./styles/library.css')
  ]);

  root.render(
    <React.StrictMode>
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    </React.StrictMode>
  );
}

void mount();

/**
 * Beim Überqueren der Grenze wird neu geladen. Das ist Absicht: Alt und Neu
 * teilen sich weder Zustand noch Sitzungsspeicher, und ein Wechsel ohne
 * Neuladen würde genau die Vermischung erzeugen, die 2.1 ausschliesst.
 *
 * Innerhalb einer Plattform bleibt die Navigation unangetastet.
 */
let wasZone = zoneOf();
window.addEventListener('hashchange', () => {
  const zone = zoneOf();
  if (zone !== wasZone) {
    wasZone = zone;
    window.location.reload();
  }
});
