/**
 * COGITA — EINE KLEINE KARTE (OpenStreetMap, ohne Bibliothek): einen Punkt
 * antippen (die Antwort „miejsce na mapie"), Zonen eines Spiels zeigen und
 * setzen, Spieler sehen. Ziehen verschiebt, Rad und Knöpfe zoomen.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

const TILE = 256;

const project = (lat: number, lon: number, zoom: number) => {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
};

const unproject = (x: number, y: number, zoom: number) => {
  const scale = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon: (x / scale) * 360 - 180 };
};

/** Wie viele Pixel ein Meter an dieser Breite ist. */
const pxPerMetre = (lat: number, zoom: number) => (TILE * 2 ** zoom) / (40_075_016 * Math.cos((lat * Math.PI) / 180));

export interface MapMark {
  readonly lat: number;
  readonly lon: number;
  readonly kind: 'pin' | 'dot';
  readonly label?: string;
  readonly color?: string;
}

export interface MapCircle {
  readonly lat: number;
  readonly lon: number;
  readonly radius: number;
  readonly label?: string;
}

export function GeoMap({ center, zoom: startZoom = 13, marks = [], circles = [], onPick, height }: {
  center?: { lat: number; lon: number };
  zoom?: number;
  marks?: readonly MapMark[];
  circles?: readonly MapCircle[];
  onPick?: (at: { lat: number; lon: number }) => void;
  height?: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 600, h: 320 });
  const [zoom, setZoom] = useState(startZoom);
  const [mid, setMid] = useState(center ?? marks[0] ?? circles[0] ?? { lat: 50.0619, lon: 19.9369 });
  const drag = useRef<{ x: number; y: number; at: { x: number; y: number }; moved: boolean } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (el === null || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const c = project(mid.lat, mid.lon, zoom);
  const origin = { x: c.x - size.w / 2, y: c.y - size.h / 2 };
  const count = 2 ** zoom;
  const tiles: { key: string; x: number; y: number; src: string }[] = [];
  for (let tx = Math.floor(origin.x / TILE); tx <= Math.floor((origin.x + size.w) / TILE); tx += 1) {
    for (let ty = Math.floor(origin.y / TILE); ty <= Math.floor((origin.y + size.h) / TILE); ty += 1) {
      if (ty < 0 || ty >= count) continue;
      const wx = ((tx % count) + count) % count;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, x: tx * TILE - origin.x, y: ty * TILE - origin.y, src: `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png` });
    }
  }
  const at = (lat: number, lon: number) => {
    const p = project(lat, lon, zoom);
    return { left: p.x - origin.x, top: p.y - origin.y };
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, at: { x: c.x, y: c.y }, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d === null) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setMid(unproject(d.at.x - dx, d.at.y - dy, zoom));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d === null || d.moved || onPick === undefined || box.current === null) return;
    const r = box.current.getBoundingClientRect();
    onPick(unproject(origin.x + (e.clientX - r.left), origin.y + (e.clientY - r.top), zoom));
  };

  return (
    <div className="cg-map" ref={box} style={height === undefined ? undefined : { height }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up}
      onWheel={(e) => setZoom((z) => Math.max(2, Math.min(19, z + (e.deltaY < 0 ? 1 : -1))))}
      role={onPick === undefined ? 'img' : 'application'} aria-label={onPick === undefined ? 'Mapa' : 'Mapa — dotknij, żeby wskazać miejsce'}>
      {tiles.map((t) => <img key={t.key} src={t.src} alt="" draggable={false} style={{ left: t.x, top: t.y }} />)}
      {circles.map((ci, i) => {
        const p = at(ci.lat, ci.lon);
        const d = 2 * ci.radius * pxPerMetre(ci.lat, zoom);
        return <span key={`c${i}`} className="cg-map-circle" style={{ left: p.left, top: p.top, width: d, height: d }} title={ci.label} />;
      })}
      {marks.map((m, i) => {
        const p = at(m.lat, m.lon);
        return m.kind === 'pin'
          ? <span key={`m${i}`} className="cg-map-pin" style={{ left: p.left, top: p.top }} title={m.label}>📍</span>
          : <span key={`m${i}`} className="cg-map-dot" style={{ left: p.left, top: p.top, ...(m.color === undefined ? {} : { background: m.color }) }} title={m.label} />;
      })}
      <div className="cg-map-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Przybliż" onClick={() => setZoom((z) => Math.min(19, z + 1))}>+</button>
        <button type="button" aria-label="Oddal" onClick={() => setZoom((z) => Math.max(2, z - 1))}>−</button>
      </div>
      <span className="cg-map-credit">© OpenStreetMap</span>
    </div>
  );
}
