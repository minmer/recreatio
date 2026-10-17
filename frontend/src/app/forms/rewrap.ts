/**
 * RSA IST DER UMSCHLAG, NICHT DER TRESOR (0037) — für ein ganzes Formular auf
 * einmal: jede Einsendung, auch die ausgeblendeten, in jedem Antwortbereich,
 * dessen Annahme dieser Browser öffnet.
 *
 * Dasselbe tut die Kanzlei nebenbei, wenn sie die Zgłoszenia öffnet
 * (`useFormOffice`); hier ohne Liste, für die Übertragung (Konto →
 * „Przeniesienie danych"). Was nicht aufgeht, bleibt, wie es ist.
 *
 * Was mit dem Schlüssel seines Bereichs nicht aufgeht, wird mit den Annahmen
 * der übrigen Bereiche versucht, die dieser Bund öffnet (`readAcross`, `spare`):
 * frühe Berichtigungen über den Link liegen unter der Annahme des Platzes.
 */

import { loadAreas } from '../areas/area';
import type { Ring } from '../core/keys';
import { loadFields } from './form';
import { loadIntake, openIntakeKey } from './intake';
import { type IntakeKey, loadRegistrations, readAcross, rewrapToOffice } from './submissions';

/** Der Annahmeschlüssel eines Bereichs, wenn dieser Bund ihn öffnet — sonst `null`. */
export const intakeKeyOf = async (areaId: string, ring: Ring): Promise<IntakeKey | null> => {
  try {
    const intake = await loadIntake(areaId);
    if (!ring.has(intake.sealedForRoleId)) return null;
    return { areaId, privateKey: await openIntakeKey(intake, ring), officeKey: ring.keyOf(intake.sealedForRoleId) };
  } catch {
    return null;
  }
};

export async function rewrapForm(partId: string, ring: Ring): Promise<{ rewrapped: number; closedAreas: number }> {
  const { fields } = await loadFields(partId);
  const areaOf = new Map(fields.map((f) => [f.fieldId, f.areaId]));
  const own = new Set(fields.map((f) => f.areaId));

  const keys: IntakeKey[] = [];
  let closedAreas = 0;
  for (const areaId of own) {
    const key = await intakeKeyOf(areaId, ring);
    if (key === null) closedAreas += 1; else keys.push(key);
  }

  const { registrations } = await loadRegistrations(partId, true);
  const pending = registrations.filter((one) => one.values.some((v) => v.wrappedKey != null && v.officeKeySealed == null));
  if (pending.length === 0) return { rewrapped: 0, closedAreas };

  const spare: IntakeKey[] = [];
  for (const area of (await loadAreas().catch(() => ({ areas: [] }))).areas) {
    if (own.has(area.areaId)) continue;
    const key = await intakeKeyOf(area.areaId, ring);
    if (key !== null) spare.push(key);
  }

  let rewrapped = 0;
  for (const one of pending) {
    const { toRewrap } = await readAcross(one, keys, areaOf, [...keys, ...spare]);
    if (toRewrap.length === 0) continue;
    const done = await rewrapToOffice(partId, toRewrap.map((value) => ({ ...value, registrationId: one.registrationId })));
    rewrapped += done.rewrapped;
  }

  return { rewrapped, closedAreas };
}
