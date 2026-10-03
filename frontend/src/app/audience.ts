/**
 * ODBIORCY (0080) — DIE DREI ZUGÄNGE zu etwas, das ein Bereich hält; dieselbe
 * Regel wie `Audience.cs` im Dienst.
 *
 * <code>
 *   channel    der Bereich schreibt (write/admin), alle anderen lesen
 *   together   alle schreiben — wer im Bereich liest, und seine Menschen
 *   one        der Bereich und EIN Mensch mit Link — sonst niemand
 * </code>
 *
 * <b>Seine Menschen</b> sind die Plätze (Links ohne Konto) des Bereichs und
 * jeder, der ein Formular ausgefüllt hat, das an dem Ding hängt (nicht
 * zurückgezogen, nicht ausgeblendet). Die Rozmowa ist das erste Ding mit
 * diesen Zugängen (`chat.ts` `chatMode`); ein Kalender oder eine Seite
 * bekommen sie, indem der Dienst ihre Art kennt — die Bausteine hier
 * (`linkAudienceForm`, `meetingAreas`, `AudienceForms.tsx`) bleiben dieselben.
 */

import type { AreaRow } from './area';
import { call } from './session';

export type AudienceMode = 'channel' | 'together' | 'one';

/** Was einer kann, der kein Schreibrecht im Bereich hat — ein Mensch mit Link, oder wer im Bereich nur liest. */
export const othersWrite = (mode: AudienceMode): boolean => mode !== 'channel';

/** Wie die drei heissen, wo man zwischen ihnen wählt. */
export const AUDIENCE_LABEL: Record<AudienceMode, string> = {
  channel: 'Kanał',
  together: 'Wszyscy razem',
  one: 'Jeden na jeden'
};

/** Ein Formular an einem Ding: wie es heisst, wem es gehört, wie viele Menschen mit Link dadurch dabei sind. */
export interface AudienceForm {
  readonly moduleId: string;
  readonly name: string;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly people: number;
}

/**
 * Ein Formular an ein Ding hängen — oder ab. Dürfen muss beides: im Bereich
 * des Dings schreiben, und das Formular sehen (seinen Bereich oder einen
 * seiner Fragen lesen).
 */
export const linkAudienceForm = (
  kind: string, id: string, moduleId: string, linked: boolean, byRoleId?: string
): Promise<{ linked: boolean; changed: boolean }> =>
  call(`/workspace/audience/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/forms`, {
    method: 'POST',
    body: JSON.stringify({ moduleId, linked, byRoleId })
  });

/**
 * MIT WEM ALLEIN SPRECHEN KANN — welche Bereiche einem Menschen `one`
 * gegenübertreten dürfen: die, mit denen er zu tun hat (der seines Platzes,
 * der des Formulars, die seiner Fragen), und alle darüber. Angeboten werden
 * die, die ich lese, die nächsten zuerst. Der Dienst prüft dasselbe
 * (`Audience.MayMeetAsync`).
 */
export function meetingAreas(areas: readonly AreaRow[], near: readonly (string | null | undefined)[]): AreaRow[] {
  const byId = new Map(areas.map((a) => [a.areaId, a]));
  const out: AreaRow[] = [];
  const seen = new Set<string>();

  /* Erst die nahen selbst, dann Schritt für Schritt nach oben. */
  let layer = [...new Set(near.filter((id): id is string => typeof id === 'string' && id !== ''))];
  while (layer.length > 0) {
    const next: string[] = [];
    for (const id of layer) {
      if (seen.has(id)) continue;
      seen.add(id);
      const area = byId.get(id);
      if (area === undefined) continue;
      if (area.myLevel !== null) out.push(area);
      if (area.parentAreaId !== null) next.push(area.parentAreaId);
    }
    layer = next;
  }

  return out;
}
