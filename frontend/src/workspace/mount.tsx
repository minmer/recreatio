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

import { WorkspaceApp } from './WorkspaceApp';
import './workspace.css';

export function mountWorkspace(node: HTMLElement): void {
  ReactDOM.createRoot(node).render(
    <React.StrictMode>
      <WorkspaceApp />
    </React.StrictMode>
  );
}
