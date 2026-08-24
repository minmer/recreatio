import { useRef, useState } from 'react';
import { asArray, asBool, asNumber, asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, CheckRow, ListEditor, NumberRow, TextRow } from './editorKit';
import { parseGpx, simplifyTrack, trackLengthKm, type MapTrack, type TrackPoint } from './gpx';
import { googleMapsHref, OsmMap, trackColor, type MapPoint } from './OsmMap';

type MapConfig = {
  points: MapPoint[];
  /** GPX-derived routes. Drawn instead of joining the pins when present. */
  tracks: MapTrack[];
  zoom: number;
  showTrack: boolean;
  note: string | null;
};

function readPoints(raw: unknown): TrackPoint[] {
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

/**
 * Reads the track list, and lifts a single legacy `track` array into it so maps
 * saved before this part carried several routes keep working untouched.
 */
function readTracks(record: Record<string, unknown>): MapTrack[] {
  const tracks: MapTrack[] = [];

  for (const entry of asArray(record.tracks)) {
    const item = asRecord(entry);
    const points = readPoints(item.points);
    if (points.length < 2) continue;
    tracks.push({
      name: asText(item.name, '').trim() || `Trasa ${tracks.length + 1}`,
      color: asOptionalText(item.color),
      points
    });
  }

  if (tracks.length === 0) {
    const legacy = readPoints(record.track);
    if (legacy.length >= 2) tracks.push({ name: 'Trasa', color: null, points: legacy });
  }

  return tracks;
}

/** Where the event physically happens, on a real map. */
export const mapPart = definePart<MapConfig>({
  kind: 'map',
  label: 'Mapa',
  description: 'Punkty GPS i ślad trasy na mapie OpenStreetMap. Ślad można wczytać z pliku GPX.',

  defaultConfig: () => ({
    points: [{ label: 'Start', lat: 50.0619, lon: 19.9369, detail: null, isStop: true }],
    tracks: [],
    zoom: 11,
    showTrack: true,
    note: null
  }),

  example: () => ({
    points: [
      { label: 'Start', lat: 50.0619, lon: 19.9369, detail: 'Miejsce zbiórki', isStop: true },
      { label: 'Meta', lat: 50.8118, lon: 19.0967, detail: 'Jasna Góra', isStop: true }
    ],
    // Lista tras. Każda ma "points" — pary [szerokość, długość]. Ślady wczytuje
    // się z plików GPX w edytorze; nie wypisuj ich ręcznie, wystarczą punkty.
    tracks: [],
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
      tracks: readTracks(record),
      zoom: zoom < 2 ? 2 : zoom > 18 ? 18 : zoom,
      showTrack: asBool(record.showTrack, true),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => {
    const [active, setActive] = useState<number | null>(null);

    if (config.points.length === 0 && config.tracks.length === 0) {
      return <p className="ev-note">Nie dodano jeszcze punktów ani śladu trasy.</p>;
    }

    return (
      <div className="ev-map">
        <OsmMap
          points={config.points}
          tracks={config.tracks}
          zoom={config.zoom}
          showTrack={config.showTrack}
          activeIndex={active}
          onActiveChange={setActive}
        />

        {config.showTrack && config.tracks.length > 1 ? (
          <ul className="ev-map-tracks">
            {config.tracks.map((track, index) => (
              <li key={index}>
                <span
                  className="ev-map-track-swatch"
                  style={{ background: track.color ?? trackColor(index) }}
                  aria-hidden="true"
                />
                <span>{track.name}</span>
                <em>{trackLengthKm(track.points).toFixed(1)} km</em>
              </li>
            ))}
          </ul>
        ) : null}

        {config.points.length > 0 ? (
          <ol className="ev-map-legend">
            {config.points.map((point, index) => (
              <li key={index}>
                <button type="button" onClick={() => setActive(index)}>
                  <span className={point.isStop ? 'ev-map-legend-stop' : 'ev-map-legend-dot'} aria-hidden="true" />
                  <span>{point.label}</span>
                </button>
                {point.detail ? <p>{point.detail}</p> : null}
                {/* Straight from the coordinates, so navigation is one tap away
                    without opening the full map first. */}
                <a
                  className="ev-map-legend-link"
                  href={googleMapsHref(point)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Google Maps ↗
                </a>
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

  /** Several files can be picked at once; each becomes its own track. */
  const load = async (files: FileList) => {
    setBusy(true);
    setError(null);
    setSummary(null);

    const added: MapTrack[] = [];
    const pins = [...config.points];
    const failures: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const parsed = parseGpx(await file.text());

        if (parsed.track.length >= 2) {
          added.push({
            // The file's own name first, then the filename without extension.
            name: parsed.name ?? file.name.replace(/\.gpx$/i, ''),
            color: null,
            points: parsed.track
          });
        }

        // Named waypoints become pins alongside whatever the track drew.
        for (const waypoint of parsed.waypoints) {
          pins.push({
            label: waypoint.label,
            lat: waypoint.lat,
            lon: waypoint.lon,
            detail: null,
            isStop: false
          });
        }
      } catch (loadError: unknown) {
        failures.push(`${file.name}: ${loadError instanceof Error ? loadError.message : 'nie udało się wczytać'}`);
      }
    }

    if (added.length > 0 || pins.length !== config.points.length) {
      onChange({ ...config, tracks: [...config.tracks, ...added], points: pins, showTrack: true });
    }

    const newPins = pins.length - config.points.length;
    if (added.length > 0 || newPins > 0) {
      setSummary(
        `Dodano ${added.length} ${added.length === 1 ? 'trasę' : 'tras'}` +
          (newPins > 0 ? ` i ${newPins} punktów z pliku.` : '.')
      );
    }
    if (failures.length > 0) setError(failures.join(' · '));

    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const rename = (index: number, name: string) => {
    const next = config.tracks.map((track, position) => (position === index ? { ...track, name } : track));
    onChange({ ...config, tracks: next });
  };

  const remove = (index: number) => {
    onChange({ ...config, tracks: config.tracks.filter((_, position) => position !== index) });
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.tracks.length) return;
    const next = [...config.tracks];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ ...config, tracks: next });
  };

  return (
    <fieldset className="eve-group">
      <legend>Ślady tras (GPX)</legend>

      {config.tracks.length === 0 ? (
        <p className="eve-hint">Brak śladów — mapa połączy linią same punkty poniżej.</p>
      ) : (
        <div className="eve-list">
          {config.tracks.map((track, index) => (
            <article className="eve-item" key={index}>
              <header>
                <span
                  className="ev-map-track-swatch"
                  style={{ background: track.color ?? trackColor(index) }}
                  aria-hidden="true"
                />
                <strong>{track.name}</strong>
                <div className="eve-item-tools">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Wyżej">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === config.tracks.length - 1}
                    aria-label="Niżej"
                  >
                    ↓
                  </button>
                  <button type="button" className="eve-remove" onClick={() => remove(index)} aria-label="Usuń ślad">
                    ×
                  </button>
                </div>
              </header>
              <div className="eve-item-body">
                <TextRow label="Nazwa" value={track.name} onChange={(name) => rename(index, name)} />
                <p className="eve-hint">
                  {track.points.length} punktów, około {trackLengthKm(track.points).toFixed(1)} km.
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".gpx,application/gpx+xml,text/xml,application/xml"
        disabled={busy}
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) void load(files);
        }}
      />

      <p className="eve-hint">
        Można wskazać kilka plików naraz — każdy stanie się osobnym śladem. Długie ślady są upraszczane przy
        zapisie, żeby strona nie musiała wczytywać dziesiątek tysięcy punktów.
      </p>

      {summary ? <p className="eve-hint">{summary}</p> : null}
      {error ? <p className="eve-error">{error}</p> : null}
    </fieldset>
  );
}
