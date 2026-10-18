/**
 * BEIM START DER APP (Ausgabe „sms") — führt dieses Telefon die Timer der Lampen
 * aus, wird ihr Plan aus dem Dienst neu abgelegt: so gilt, was im Browser oder auf
 * einem anderen Gerät geändert wurde, ab jetzt auch hier. Eigenes Bündel, von
 * `phoneJobs.startPhone` geladen.
 */

import type { Who } from '../core/session';
import { openPhone } from '../phone/phoneContext';
import { loadLamps } from './lampStore';
import { LampRadio, lampHere } from './native';
import { syncTimers } from './timers';

export async function startLamps(who: Who): Promise<void> {
  if (!lampHere()) return;
  if (!(await LampRadio.timerStatus()).on) return;
  const { lamps, timers } = await loadLamps(await openPhone(who));
  await syncTimers(LampRadio, lamps, timers);
}
