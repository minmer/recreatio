import { useRef, useState } from 'react';
import { asArray, asBool, asNumber, asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, CheckRow, ListEditor, NumberRow, TextRow } from './editorKit';
import { parseGpx, simplifyTrack, trackLengthKm, type TrackPoint } from './gpx';
import { OsmMap, type MapPoint } from './OsmMap';

type MapConfig = {
  points: MapPoint[];
  /** GPX-derived route. Drawn instead of joining the pins when present. */
  track: TrackPoint[];
  zoom: number;
  showTrack: boolean;
  note: string | null;
};

function readTrack(raw: unknown): TrackPoint[] {
  const result: TrackPoint[] = [];
  for (const entry of asArray(raw)) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const lat = asNumber(entry[0], Number.NaN);
    const lon = asNumber(entry[1], Number.NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -85 || lat > 85 || lon < -180 || lon > 180) continue;
    result.push([lat, lon]);
  }
  // A stored track could be from an older, more generous import.
  return simplifyTrack(result);
}

/** Where the event physically happens, on a real map. */
export const mapPart = definePart<MapConfig>({
  kind: 'map',
  label: 'Mapa',
  description: 'Punkty GPS i ślad trasy na mapie OpenStreetMap. Ślad można wczytać z pliku GPX.',

  defaultConfig: () => ({
    points: [{ label: 'Start', lat: 50.0619, lon: 19.9369, detail: null, isStop: true }],
    track: [],
    zoom: 11,
    showTrack: true,
    note: null
  }),

  example: () => ({
    points: [
      { label: 'Start', lat: 50.0619, lon: 19.9369, detail: 'Miejsce zbiórki', isStop: true },
      { label: 'Meta', lat: 50.8118, lon: 19.0967, detail: 'Jasna Góra', isStop: true }
    ],
    // Pary [szerokość, długość]. Zwykle wczytywane z pliku GPX w edytorze —
    // nie wypisuj długiego śladu ręcznie, wystarczą punkty.
    track: [],
    zoom: 9,
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
      track: readTrack(record.track),
      zoom: zoom < 2 ? 2 : zoom > 18 ? 18 : zoom,
      showTrack: asBool(record.showTrack, true),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => {
    const [active, setActive] = useState<number | null>(null);

    if (config.points.length === 0 && config.track.length === 0) {
      return <p className="ev-note">Nie dodano jeszcze punktów ani śladu trasy.</p>;
    }

    return (
      <div className="ev-map">
        <OsmMap
          points={config.points}
          track={config.track}
          zoom={config.zoom}
          showTrack={config.showTrack}
          activeIndex={active}
          onActiveChange={setActive}
        />
        {config.points.length > 0 ? (
          <ol className="ev-map-legend">
            {config.points.map((point, index) => (
              <li key={index}>
                <button type="button" onClick={() => setActive(index)}>
                  <span className={point.isStop ? 'ev-map-legend-stop' : 'ev-map-legend-dot'} aria-hidden="true" />
                  <span>{point.label}</span>
                </button>
                {point.detail ? <p>{point.detail}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}
        {config.note ? <p className="ev-note">{config.note}</p> : null}
      </div>
    );
  },

  Editor: ({ config, onChange }) => (
    <>
      <GpxLoader config={config} onChange={onChange} />

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
        hint="2–18. Mapa i tak dopasuje widok do wszystkich punktów i śladu."
        onChange={(zoom) => onChange({ ...config, zoom })}
      />
      <CheckRow
        label="Rysuj ślad trasy"
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

// ── GPX ──────────────────────────────────────────────────────────────────────

function GpxLoader({ config, onChange }: { config: MapConfig; onChange: (next: MapConfig) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const load = async (file: File) => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const parsed = parseGpx(await file.text());

      // Named waypoints become pins; unnamed track geometry becomes the line.
      const merged = [...config.points];
      for (const waypoint of parsed.waypoints) {
        merged.push({
          label: waypoint.label,
          lat: waypoint.lat,
          lon: waypoint.lon,
          detail: null,
          isStop: false
        });
      }

      onChange({ ...config, track: parsed.track, points: merged, showTrack: true });
      setSummary(
        `Wczytano ${parsed.track.length} punktów śladu (${trackLengthKm(parsed.track).toFixed(1)} km)` +
          (parsed.waypoints.length > 0 ? `, dodano ${parsed.waypoints.length} punktów z pliku.` : '.')
      );
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się wczytać pliku GPX.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <fieldset className="eve-group">
      <legend>Ślad trasy (GPX)</legend>

      <p className="eve-hint">
        {config.track.length > 0
          ? `Wczytany ślad: ${config.track.length} punktów, około ${trackLengthKm(config.track).toFixed(1)} km.`
          : 'Brak śladu — mapa połączy linią same punkty poniżej.'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml,text/xml,application/xml"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void load(file);
        }}
      />

      <p className="eve-hint">
        Długie ślady są upraszczane przy zapisie, żeby strona nie musiała wczytywać dziesiątek tysięcy punktów.
      </p>

      {summary ? <p className="eve-hint">{summary}</p> : null}
      {error ? <p className="eve-error">{error}</p> : null}

      {config.track.length > 0 ? (
        <button type="button" className="eve-add" onClick={() => onChange({ ...config, track: [] })}>
          Usuń ślad
        </button>
      ) : null}
    </fieldset>
  );
}
