/**
 * MAPA — Punkte und Strecken auf einer OpenStreetMap-Karte, ohne Kartenbibliothek
 * (Altbestand: `MapPart`, `OsmMap.tsx`, `gpx.ts`).
 *
 * <b>Auf der Seite eine Vorschau, die nichts festhält:</b> sie nimmt keine
 * Gesten an, die Seite (und das Deck der Slajdy) rollt über sie hinweg. Ein
 * Klick öffnet sie im ganzen Fenster, wo sie jede Geste bekommt.
 *
 * <b>Strecken kommen aus GPX-Dateien</b> und werden beim Einlesen vereinfacht:
 * ein aufgezeichneter Track hat zehntausende Punkte, gespeichert werden höchstens
 * ein paar hundert je Strecke — genug für eine Strecke über ein Land, und klein
 * genug, dass der Baustein in seine Tafel passt.
 *
 * <b>Je Grösse:</b> im Streifen klappt sie auf; als Block die Karte mit der
 * Legende darunter; hoch und breit die Legende neben der Karte.
 */

import { useRef, useState } from 'react';

import { t, useT } from '../../core/i18n';

import {
  AreaRow, asArray, asBool, asNumber, asOptionalText, asRecord, asText, CheckRow, defineEventPart, ListEditor, mapEntries, NumberRow,
  TextRow
} from '../event/kit';
import { parseGpx, simplifyTrack, trackLengthKm, type MapTrack, type TrackPoint } from '../event/gpx';
import { googleMapsHref, trackColor } from '../event/mapLinks';
import type { MapPoint } from '../event/mapGeometry';
import { later } from '../../ui/later';

/* 2026-10-17 — die Karte erst, wenn sie gezeigt wird (`ui/later`). */
const OsmMap = later(() => import('../event/OsmMap').then((m) => m.OsmMap));

type MapConfig = { points: MapPoint[]; tracks: MapTrack[]; zoom: number; showTrack: boolean; note: string | null };

/** So viele Punkte tragen alle Strecken zusammen — die Tafel eines Bausteins hat 64 000 Zeichen. */
const POINT_BUDGET = 2000;

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
  return simplifyTrack(result);
}

/** Die Strecken — und ein einzelnes altes `track` des Altbestands als eine davon. */
function readTracks(record: Record<string, unknown>): MapTrack[] {
  const tracks: MapTrack[] = [];
  for (const entry of asArray(record.tracks)) {
    const item = asRecord(entry);
    const points = readPoints(item.points);
    if (points.length < 2) continue;
    tracks.push({ name: asText(item.name, '').trim() || t('moduleContent.map.trackNth', { n: tracks.length + 1 }), color: asOptionalText(item.color), points });
  }
  if (tracks.length === 0) {
    const legacy = readPoints(record.track);
    if (legacy.length >= 2) tracks.push({ name: t('moduleContent.map.track'), color: null, points: legacy });
  }
  return tracks;
}

function MapView({ config, side }: { config: MapConfig; side: boolean }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className={`ev-map${side ? ' is-side' : ''}`}>
      <OsmMap points={config.points} tracks={config.tracks} zoom={config.zoom} showTrack={config.showTrack} activeIndex={active} onActiveChange={setActive} />

      <div className="ev-map-aside">
        {config.showTrack && config.tracks.length > 1 && (
          <ul className="ev-map-tracks">
            {config.tracks.map((track, index) => (
              <li key={index}>
                <span className="ev-map-track-swatch" style={{ background: track.color ?? trackColor(index) }} aria-hidden="true" />
                <span>{track.name}</span>
                <em>{trackLengthKm(track.points).toFixed(1)} km</em>
              </li>
            ))}
          </ul>
        )}

        {config.points.length > 0 && (
          <ol className="ev-map-legend">
            {config.points.map((point, index) => (
              <li key={index}>
                <button type="button" onClick={() => setActive(index)}>
                  <span className={point.isStop ? 'ev-map-legend-stop' : 'ev-map-legend-dot'} aria-hidden="true" />
                  <span>{point.label}</span>
                </button>
                {point.detail !== null && <p>{point.detail}</p>}
                <a className="ev-map-legend-link" href={googleMapsHref(point)} target="_blank" rel="noreferrer noopener">Google Maps ↗</a>{/* i18n-ignore — Name */}
              </li>
            ))}
          </ol>
        )}
        {config.note !== null && <p className="ev-note">{config.note}</p>}
      </div>
    </div>
  );
}

function GpxLoader({ config, onChange }: { config: MapConfig; onChange: (next: MapConfig) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  /* Mehrere Dateien auf einmal — jede wird eine eigene Strecke, benannte Wegpunkte werden Punkte. */
  const load = async (files: FileList) => {
    setBusy(true);
    setFailed(null);
    setSummary(null);

    const added: MapTrack[] = [];
    const pins = [...config.points];
    const failures: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const parsed = parseGpx(await file.text());
        if (parsed.track.length >= 2) added.push({ name: parsed.name ?? file.name.replace(/\.gpx$/i, ''), color: null, points: parsed.track });
        for (const waypoint of parsed.waypoints) pins.push({ label: waypoint.label, lat: waypoint.lat, lon: waypoint.lon, detail: null, isStop: false });
      } catch (e) {
        failures.push(`${file.name}: ${e instanceof Error ? e.message : t('moduleContent.map.loadFailed')}`);
      }
    }

    if (added.length > 0 || pins.length !== config.points.length) {
      /* Alle Strecken teilen sich ein Budget an Punkten — mit jeder neuen werden alle etwas gröber. */
      const tracks = [...config.tracks, ...added];
      const each = Math.max(60, Math.min(600, Math.floor(POINT_BUDGET / Math.max(1, tracks.length))));
      onChange({ ...config, tracks: tracks.map((track) => ({ ...track, points: simplifyTrack(track.points, each) })), points: pins, showTrack: true });
    }

    const newPins = pins.length - config.points.length;
    if (added.length > 0 || newPins > 0) {
      const tracks = t('moduleContent.map.n.tracksAcc', { count: added.length });
      setSummary(newPins > 0 ? t('moduleContent.map.addedWithPoints', { tracks, points: t('moduleContent.map.n.points', { count: newPins }) }) : t('moduleContent.map.added', { tracks }));
    }
    if (failures.length > 0) setFailed(failures.join(' · '));

    setBusy(false);
    if (input.current) input.current.value = '';
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
    <fieldset className="pe-group">
      <legend>{t('moduleContent.map.gpxLegend')}</legend>
      {config.tracks.length === 0 ? <p className="wk-hint">{t('moduleContent.map.noTracks')}</p> : (
        <div className="pe-list">
          {config.tracks.map((track, index) => (
            <article className="pe-item is-open" key={index}>
              <header>
                <span className="pe-item-title">
                  <span className="ev-map-track-swatch" style={{ background: track.color ?? trackColor(index) }} aria-hidden="true" /> {track.name}
                </span>
                <span className="pe-item-tools">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('moduleContent.map.up')}>↑</button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === config.tracks.length - 1} aria-label={t('moduleContent.map.down')}>↓</button>
                  <button type="button" className="pe-remove" aria-label={t('moduleContent.map.removeTrack')}
                    onClick={() => onChange({ ...config, tracks: config.tracks.filter((_, at) => at !== index) })}>×</button>
                </span>
              </header>
              <div className="pe-item-body">
                <TextRow label={t('moduleContent.map.name')} value={track.name}
                  onChange={(name) => onChange({ ...config, tracks: config.tracks.map((one, at) => (at === index ? { ...one, name } : one)) })} />
                <p className="wk-hint">{t('moduleContent.map.trackInfo', { points: t('moduleContent.map.n.points', { count: track.points.length }), km: trackLengthKm(track.points).toFixed(1) })}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      <input ref={input} type="file" multiple accept=".gpx,application/gpx+xml,text/xml,application/xml" disabled={busy}
        aria-label={t('moduleContent.map.loadGpx')}
        onChange={(e) => { const files = e.target.files; if (files && files.length > 0) void load(files); }} />
      <p className="wk-hint">{t('moduleContent.map.gpxHint')}</p>
      {summary !== null && <p className="wk-hint" role="status">{summary}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </fieldset>
  );
}

export const mapPart = defineEventPart<MapConfig>({
  kind: 'map',
  label: 'moduleContent.map.label',
  use: 'moduleContent.map.use',
  box: { colSpan: 6, rowSpan: 5 },
  strip: { title: 'moduleContent.map.stripTitle', open: 'moduleContent.map.stripOpen' },

  blank: () => ({ points: [], tracks: [], zoom: 11, showTrack: true, note: null }),
  example: () => ({
    points: [
      { label: 'Start', lat: 50.0619, lon: 19.9369, detail: 'Miejsce zbiórki', isStop: true }, // i18n-ignore
      { label: 'Meta', lat: 50.8118, lon: 19.0967, detail: 'Jasna Góra', isStop: true } // i18n-ignore
    ],
    tracks: [{ name: 'Dzień 1', color: null, points: [[50.0619, 19.9369], [50.2803, 19.5594], [50.8118, 19.0967]] }], // i18n-ignore
    zoom: 9,
    showTrack: true,
    note: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    points: 'moduleContent.map.key.points',
    'points[].label': 'moduleContent.map.key.label',
    'points[].lat': 'moduleContent.map.key.lat',
    'points[].lon': 'moduleContent.map.key.lon',
    'points[].detail': 'moduleContent.map.key.detail',
    'points[].isStop': 'moduleContent.map.key.isStop',
    tracks: 'moduleContent.map.key.tracks',
    'tracks[].name': 'moduleContent.map.key.trackName',
    'tracks[].color': 'moduleContent.map.key.trackColor',
    'tracks[].points': 'moduleContent.map.key.trackPoints',
    zoom: 'moduleContent.map.key.zoom',
    showTrack: 'moduleContent.map.key.showTrack',
    note: 'moduleContent.map.key.note'
  },

  parse: (raw) => {
    const record = asRecord(raw);
    const zoom = Math.round(asNumber(record.zoom, 11));
    return {
      points: mapEntries<MapPoint>(record.points, (item) => {
        const lat = asNumber(item.lat, Number.NaN);
        const lon = asNumber(item.lon, Number.NaN);
        /* Ausserhalb der Kachelwelt läge ein Punkt neben der Karte. */
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -85 || lat > 85 || lon < -180 || lon > 180) return null;
        return { label: asText(item.label, '').trim() || t('moduleContent.map.point'), lat, lon, detail: asOptionalText(item.detail), isStop: asBool(item.isStop) };
      }),
      tracks: readTracks(record),
      zoom: zoom < 2 ? 2 : zoom > 18 ? 18 : zoom,
      showTrack: asBool(record.showTrack, true),
      note: asOptionalText(record.note)
    };
  },

  hasContent: (c) => c.points.length > 0 || c.tracks.length > 0,

  shows: (c, size) => size.height === 'strip' ? t('moduleContent.map.showsStrip')
    : size.height === 'tall' && size.width === 'full' ? t('moduleContent.map.showsSide')
    : t('moduleContent.map.showsBelow', { points: t('moduleContent.map.n.points', { count: c.points.length }), tracks: t('moduleContent.map.n.tracks', { count: c.tracks.length }) }),

  Body: ({ config, ctx }) => <MapView config={config} side={ctx.size.height === 'tall' && ctx.size.width === 'full'} />,

  Edit: function MapEdit({ config, onChange }) {
    const t = useT();
    return (
    <>
      <GpxLoader config={config} onChange={onChange} />
      <ListEditor<MapPoint>
        legend={t('moduleContent.map.points')}
        items={config.points}
        addLabel={t('moduleContent.map.addPoint')}
        blank={() => ({ label: t('moduleContent.map.point'), lat: 50.0619, lon: 19.9369, detail: null, isStop: false })}
        titleOf={(item, index) => item.label || t('moduleContent.map.pointNth', { n: index + 1 })}
        onChange={(points) => onChange({ ...config, points })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('moduleContent.map.name')} value={item.label} onChange={(label) => update({ ...item, label })} />
            <NumberRow label={t('moduleContent.map.lat')} step={0.00001} value={item.lat} onChange={(lat) => update({ ...item, lat: lat ?? item.lat })} />
            <NumberRow label={t('moduleContent.map.lon')} step={0.00001} value={item.lon} onChange={(lon) => update({ ...item, lon: lon ?? item.lon })} />
            <TextRow label={t('moduleContent.map.detail')} value={item.detail ?? ''} onChange={(detail) => update({ ...item, detail: detail || null })} />
            <CheckRow label={t('moduleContent.map.isStop')} checked={item.isStop} onChange={(isStop) => update({ ...item, isStop })} />
          </>
        )}
      />
      <NumberRow label={t('moduleContent.map.zoom')} value={config.zoom} min={2} hint={t('moduleContent.map.zoomHint')}
        onChange={(zoom) => onChange({ ...config, zoom: zoom ?? 11 })} />
      <CheckRow label={t('moduleContent.map.showTrack')} checked={config.showTrack} onChange={(showTrack) => onChange({ ...config, showTrack })} />
      <AreaRow label={t('moduleContent.map.note')} rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
    );
  }
});
