/**
 * ALS LINK HANDELN — ohne Konto.
 *
 * <b>Ein Link mit Zugang ist eine Rolle</b> (0065), und sein Geheimnis öffnet
 * ihren Schlüssel. Bisher las der Browser damit nur: wer einen Link mit
 * „pisze" bekam, sah den Kalender und konnte nichts eintragen — obwohl der
 * Link genau das versprach. Für jeden, der ihn bekommen hat, war das ein
 * Link, der nicht tut, was er sagt.
 *
 * <b>Deshalb gibt es hier ein `Me` aus den Links</b>: derselbe Zuschnitt wie
 * beim Konto (`me.ts`) — ein Bund, Rollen, wer handelt —, nur dass der Bund
 * aus den Linkrollen besteht. Was mit einem `Me` arbeitet (der Kalender),
 * arbeitet damit unverändert; der Dienst prüft dieselben Zertifikate, an der
 * Linkrolle statt an einer Rolle des Kontos (`Caller`).
 *
 * <b>Nur ohne Sitzung.</b> Wer angemeldet ist, handelt als er selbst und nimmt
 * den Link in sein Konto auf („Dodaj do konta"); der Dienst zählt dann ohnehin
 * nur das Konto. Zwei Identitäten zugleich hiessen: im Kalender dürfte er, in
 * den Bereichen daneben sähe er nichts.
 */

import { useEffect, useState } from 'react';

import { useHeldLinksStamp } from './HeldLinkBar';
import { Ring, type SealedRole } from './keys';
import { heldLinkKeys, heldProofs, type HeldRole } from './linkAccess';
import type { Me } from './me';
import { carryLinks } from './session';

const writes = (held: HeldRole): boolean =>
  held.areas.some((area) => area.capability === 'write' || area.capability === 'admin');

/**
 * Die Linkrolle in der Gestalt, die der Bund kennt. Was an ihrer öffentlichen
 * Hälfte hängt (Verpacken FÜR sie, Unterschriften) braucht hier niemand: ein
 * Link lässt niemanden hinein und unterschreibt nichts.
 */
const asRole = (held: HeldRole): SealedRole => ({
  id: held.roleId,
  kind: 'role',
  isPersonal: false,
  createdAt: '',
  displayNameSealed: null,
  wrapPublicKey: '',
  signPublicKey: '',
  wrapPrivateSealed: held.wrapPrivateSealed,
  signPrivateSealed: null,
  keyLayout: 1
});

/** `null`: dieser Browser hält keinen Link, der gilt. */
export async function linkMe(): Promise<Me | null> {
  const held = (await heldLinkKeys()).roles;
  if (held.length === 0) return null;

  const roles = held.map(asRole);

  /* Wer schreibt, handelt: ein neuer Termin gehört der Rolle, die ihn eintragen darf. */
  const acting = roles[Math.max(0, held.findIndex(writes))];

  /* Ab jetzt reisen die Beweise mit — sonst wüsste der Dienst nicht, wer ruft. */
  carryLinks(heldProofs);

  return {
    ring: Ring.ofRoles(held.map((one, at) => ({ role: roles[at], key: one.roleKey }))),
    roles,
    person: acting,
    names: new Map(held.map((one) => [one.roleId, one.label ?? 'Link z dostępem']))
  };
}

/**
 * @param wanted Nur, wenn niemand angemeldet ist — sonst `null`, ohne zu fragen.
 * @returns `undefined`: wird noch nachgesehen.
 */
export function useLinkMe(wanted: boolean): Me | null | undefined {
  const stamp = useHeldLinksStamp();
  const [found, setFound] = useState<{ stamp: string; me: Me | null } | null>(null);

  useEffect(() => {
    if (!wanted) return undefined;
    if (stamp === '') { setFound({ stamp, me: null }); return undefined; }

    let alive = true;
    linkMe()
      .then((me) => { if (alive) setFound({ stamp, me }); })
      .catch(() => { if (alive) setFound({ stamp, me: null }); });
    return () => { alive = false; };
  }, [wanted, stamp]);

  if (!wanted) return null;
  return found !== null && found.stamp === stamp ? found.me : undefined;
}
