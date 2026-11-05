/**
 * 0133 — „WIDOCZNE DLA": ein Baustein nur für die Menschen eines Bereichs (auf der
 * Seite „po wydarzeniu" etwa die Fotos nur für die Teilnehmer). Der Dienst schickt ihn
 * nur dem, der den Bereich sieht — über seinen eigenen Link aus dem Formular, einen
 * Link mit Zugang in diesem Browser oder ein Konto, das dort liest; wer die Seite
 * führt, sieht ihn immer (`Page.Audience.cs`).
 */

import { useEffect, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { areasNow } from '../workspace/viewData';
import { useT } from '../core/i18n';

/** Die Bereiche, die ich sehe — einmal geladen. */
export function useSeenAreas(): readonly AreaRow[] {
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  useEffect(() => {
    let alive = true;
    void areasNow().then((list) => { if (alive) setAreas(list); }, () => undefined);
    return () => { alive = false; };
  }, []);
  return areas;
}

export function AudienceField({ value, busy, onChange }: {
  value: string | null;
  busy: boolean;
  onChange: (areaId: string | null) => void;
}) {
  const t = useT();
  const areas = useSeenAreas();
  /* Zur Wahl: was ich lese (der Dienst verlangt es) — nicht „Tylko ja" und keine Rozmowy. */
  const readable = areas.filter((a) => a.myLevel !== null && a.personal !== true && a.ownChat == null);

  return (
    <div className="wk-field wk-part-audience">
      <span>{t('pages.audience.label')}</span>
      <AreaPick
        label={t('pages.audience.label')}
        areas={areas}
        only={readable}
        value={value ?? ''}
        onChange={(next) => onChange(next === '' ? null : next)}
        extras={[{ value: '', label: t('pages.audience.all') }]}
        disabled={busy}
      />
      {value !== null && (
        <p className="wk-part-audience-says">{t('pages.audience.note')}</p>
      )}
    </div>
  );
}
