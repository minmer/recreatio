import { useState } from 'react';
import { asBool, asNumber, asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, CheckRow, ListEditor, NumberRow, TextRow } from './editorKit';
import { OsmMap, type MapPoint } from './OsmMap';

type MapConfig = {
  points: MapPoint[];
  zoom: number;
  showTrack: boolean;
  note: string | null;
};

/** Where the event physically happens, on a real map. */
export const mapPart = definePart<MapConfig>({
  kind: 'map',
  label: 'Mapa',
  description: 'Punkty GPS na mapie OpenStreetMap, z opcjonalnym śladem trasy.',

  defaultConfig: () => ({
    points: [{ label: 'Start', lat: 50.0619, lon: 19.9369, detail: null, isStop: true }],
    zoom: 11,
    showTrack: true,
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    const zoom = Math.round(asNumber(record.zoom, 11));
    return {
      points: mapEntries<MapPoint>(record.points, (item) => {
        const lat = asNumber(item.lat, Number.NaN);
        const lon = asNumber(item.lon, Number.NaN);
        // Out-of-range coordinates would project off the tile grid entirely.
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;
        return {
          label: asText(item.label, 'Punkt').trim() || 'Punkt',
          lat,
          lon,
          detail: asOptionalText(item.detail),
          isStop: asBool(item.isStop)
        };
      }),
      zoom: zoom < 2 ? 2 : zoom > 18 ? 18 : zoom,
      showTrack: asBool(record.showTrack, true),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => {
    const [active, setActive] = useState<number | null>(null);

    if (config.points.length === 0) {
      return <p className="e2-note">Nie dodano jeszcze punktów na mapie.</p>;
    }

    return (
      <div className="e2-map">
        <OsmMap
          points={config.points}
          zoom={config.zoom}
          showTrack={config.showTrack}
          activeIndex={active}
          onActiveChange={setActive}
        />
        <ol className="e2-map-legend">
          {config.points.map((point, index) => (
            <li key={index}>
              <button type="button" onClick={() => setActive(index)}>
                <span className={point.isStop ? 'e2-map-legend-stop' : 'e2-map-legend-dot'} aria-hidden="true" />
                <span>{point.label}</span>
              </button>
              {point.detail ? <p>{point.detail}</p> : null}
            </li>
          ))}
        </ol>
        {config.note ? <p className="e2-note">{config.note}</p> : null}
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <>
      <ListEditor<MapPoint>
        legend="Punkty"
        items={config.points}
        addLabel="Dodaj punkt"
        blank={() => ({ label: 'Punkt', lat: 50.0619, lon: 19.9369, detail: null, isStop: false })}
        titleOf={(item, index) => item.label || `Punkt ${index + 1}`}
        onChange={(points) => onChange({ ...config, points })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Nazwa" value={item.label} onChange={(label) => update({ ...item, label })} />
            <NumberRow
              label="Szerokość (lat)"
              step={0.00001}
              value={item.lat}
              onChange={(lat) => update({ ...item, lat })}
            />
            <NumberRow
              label="Długość (lon)"
              step={0.00001}
              value={item.lon}
              onChange={(lon) => update({ ...item, lon })}
            />
            <TextRow
              label="Opis"
              value={item.detail ?? ''}
              onChange={(detail) => update({ ...item, detail: detail || null })}
            />
            <CheckRow
              label="Punkt węzłowy (większy znacznik)"
              checked={item.isStop}
              onChange={(isStop) => update({ ...item, isStop })}
            />
          </>
        )}
      />
      <NumberRow
        label="Domyślne przybliżenie"
        value={config.zoom}
        hint="2–18. Mapa i tak dopasuje widok do wszystkich punktów, jeśli jest ich więcej niż jeden."
        onChange={(zoom) => onChange({ ...config, zoom })}
      />
      <CheckRow
        label="Rysuj ślad przez punkty"
        checked={config.showTrack}
        onChange={(showTrack) => onChange({ ...config, showTrack })}
      />
      <AreaRow
        label="Uwaga"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
