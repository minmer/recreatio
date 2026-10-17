/**
 * RSA IST DER UMSCHLAG, NICHT DER TRESOR (0037) — für ein ganzes Formular auf
 * einmal: jede Einsendung, auch die ausgeblendeten, in jedem Antwortbereich,
 * dessen Annahme dieser Browser öffnet.
 *
 * Dasselbe tut die Kanzlei nebenbei, wenn sie die Zgłoszenia öffnet
 * (`useFormOffice`); hier ohne Liste, für die Übertragung (Konto →
 * „Przeniesienie danych"). Was nicht aufgeht, bleibt, wie es ist.
 */

import type { Ring } from '../core/keys';
import { loadFields } from './form';
import { loadIntake, openIntakeKey } from './intake';
import { type IntakeKey, loadRegistrations, readAcross, rewrapToOffice } from './submissions';

export async function rewrapForm(partId: string, ring: Ring): Promise<{ rewrapped: number; closedAreas: number }> {
  const { fields } = await loadFields(partId);
  const areaOf = new Map(fields.map((f) => [f.fieldId, f.areaId]));

  const keys: IntakeKey[] = [];
  let closedAreas = 0;
  for (const areaId of new Set(fields.map((f) => f.areaId))) {
    try {
      const intake = await loadIntake(areaId);
      keys.push({
        areaId,
        privateKey: await openIntakeKey(intake, ring),
        officeKey: ring.has(intake.sealedForRoleId) ? ring.keyOf(intake.sealedForRoleId) : undefined
      });
    } catch {
      closedAreas += 1;
    }
  }

  const { registrations } = await loadRegistrations(partId, true);
  let rewrapped = 0;

  for (const one of registrations) {
    const { toRewrap } = await readAcross(one, keys, areaOf);
    if (toRewrap.length === 0) continue;
    const done = await rewrapToOffice(partId, toRewrap.map((value) => ({ ...value, registrationId: one.registrationId })));
    rewrapped += done.rewrapped;
  }

  return { rewrapped, closedAreas };
}
