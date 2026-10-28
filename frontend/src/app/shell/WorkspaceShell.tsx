/**
 * DER ARBEITSPLATZ ALS EIN STÜCK — Rahmen und Inhalt, zusammen nachgeladen
 * (2026-10-17). Eine öffentliche Seite, ein Link, eine Anmeldung laden davon
 * nichts: `App` holt es mit `lazy`, erst wenn jemand angemeldet im
 * Arbeitsplatz steht.
 */

import type { Spot } from '../routes';
import type { Who } from '../core/session';
import { Workspace } from '../workspace/Workspace';
import { WorkspaceFrame } from './WorkspaceFrame';

export default function WorkspaceShell({ who, spot, onSignOut, cut = false }: { who: Who; spot: Spot; onSignOut?: () => void; cut?: boolean }) {
  return (
    <WorkspaceFrame who={who} spot={spot} onSignOut={onSignOut} cut={cut}>
      <Workspace spot={spot} who={who} />
    </WorkspaceFrame>
  );
}
