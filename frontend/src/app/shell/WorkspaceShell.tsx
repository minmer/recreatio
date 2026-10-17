/**
 * DER ARBEITSPLATZ ALS EIN STÜCK — Rahmen und Inhalt, zusammen nachgeladen
 * (2026-10-17). Eine öffentliche Seite, ein Link, eine Anmeldung laden davon
 * nichts: `App` holt es mit `lazy`, erst wenn jemand angemeldet im
 * Arbeitsplatz steht.
 */

import type { Spot } from './routes';
import type { Who } from './session';
import { Workspace } from './Workspace';
import { WorkspaceFrame } from './WorkspaceFrame';

export default function WorkspaceShell({ who, spot, onSignOut }: { who: Who; spot: Spot; onSignOut?: () => void }) {
  return (
    <WorkspaceFrame who={who} spot={spot} onSignOut={onSignOut}>
      <Workspace spot={spot} who={who} />
    </WorkspaceFrame>
  );
}
