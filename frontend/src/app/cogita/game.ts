/**
 * COGITA — SPIELE (COGITA.md §11) und die Karte zum Entdecken (§12, [K5]).
 *
 * <b>Ein Spiel ist kein eigener Baustein</b> [F36]: es ist ein Ablauf mit
 * Zonen (Punkt, Radius, Zeitfenster), Werten mit Kassenbuch und Auslösern —
 * „betritt die Zone", „verlässt sie", „N aus dem Team stehen darin", „alle N
 * Sekunden" —, und je Rolle (Gastgeber, Gruppenleiter, Teilnehmer) einem
 * eigenen Aussehen [F39]. Was die Auslöser tun: einen Wert setzen oder
 * ändern, einen Schritt des Ablaufs öffnen [J6].
 *
 * <b>Ausgewertet wird im Dienst</b> [J2] — dafür legt der Gastgeber beim Start
 * die Regeln offen (nur Kennungen, keine Texte). Gefälschte Positionen sieht
 * das Gerät des Gastgebers [J4]: hier steht die Rechnung dafür.
 */

import { call } from '../core/session';
import type { Credentials } from './live';

export interface Zone {
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
  readonly radius: number;
  readonly from?: string;
  readonly to?: string;
}

export interface GameValue {
  readonly id: string;
  readonly scope: 'player' | 'team' | 'session';
  readonly initial: number;
  readonly min?: number;
  readonly max?: number;
}

export interface GameAction {
  readonly do: 'add' | 'set' | 'open' | 'notice';
  readonly value?: string;
  readonly by?: number;
  readonly to?: number;
  readonly step?: string;
  /** Bei „co N sekund": `each` — für jeden Spieler. */
  readonly target?: 'player' | 'team' | 'session' | 'each';
}

export interface Trigger {
  readonly id: string;
  readonly on: 'enter' | 'leave' | 'present' | 'every';
  readonly zone?: string;
  readonly count?: number;
  readonly seconds?: number;
  readonly once: boolean;
  readonly team?: string;
  readonly actions: readonly GameAction[];
}

export interface GameRules {
  readonly zones: readonly Zone[];
  readonly values: readonly GameValue[];
  readonly triggers: readonly Trigger[];
}

export const EMPTY_GAME: GameRules = { zones: [], values: [], triggers: [] };

export const TRIGGER_LABEL: Record<Trigger['on'], string> = {
  enter: 'wejście do strefy', leave: 'wyjście ze strefy', present: 'tylu z drużyny w strefie', every: 'co pewien czas'
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Duldsam: was nicht passt, fällt weg — der Dienst prüft dasselbe noch einmal. */
export function readGame(raw: unknown): GameRules {
  const d = isObject(raw) ? raw : {};
  const zones = (Array.isArray(d.zones) ? d.zones : []).flatMap((z): Zone[] => {
    if (!isObject(z) || str(z.id) === '' || num(z.lat) === undefined || num(z.lon) === undefined) return [];
    return [{ id: str(z.id), lat: num(z.lat)!, lon: num(z.lon)!, radius: Math.max(1, Math.min(100_000, num(z.radius) ?? 30)), ...(str(z.from) === '' ? {} : { from: str(z.from) }), ...(str(z.to) === '' ? {} : { to: str(z.to) }) }];
  });
  const values = (Array.isArray(d.values) ? d.values : []).flatMap((v): GameValue[] => {
    if (!isObject(v) || str(v.id) === '') return [];
    const scope = v.scope === 'team' || v.scope === 'session' ? v.scope : 'player';
    return [{ id: str(v.id), scope, initial: num(v.initial) ?? 0, ...(num(v.min) === undefined ? {} : { min: num(v.min) }), ...(num(v.max) === undefined ? {} : { max: num(v.max) }) }];
  });
  const triggers = (Array.isArray(d.triggers) ? d.triggers : []).flatMap((t): Trigger[] => {
    if (!isObject(t) || str(t.id) === '') return [];
    const on = t.on === 'leave' || t.on === 'present' || t.on === 'every' ? t.on : 'enter';
    const actions = (Array.isArray(t.actions) ? t.actions : []).flatMap((a): GameAction[] => {
      if (!isObject(a)) return [];
      const kind = a.do === 'set' || a.do === 'open' || a.do === 'notice' ? a.do : 'add';
      const target = a.target === 'team' || a.target === 'session' || a.target === 'each' ? a.target : undefined;
      return [{ do: kind, ...(str(a.value) === '' ? {} : { value: str(a.value) }), ...(num(a.by) === undefined ? {} : { by: num(a.by) }), ...(num(a.to) === undefined ? {} : { to: num(a.to) }), ...(str(a.step) === '' ? {} : { step: str(a.step) }), ...(target === undefined ? {} : { target }) }];
    });
    return [{ id: str(t.id), on, ...(str(t.zone) === '' ? {} : { zone: str(t.zone) }), ...(num(t.count) === undefined ? {} : { count: num(t.count) }), ...(num(t.seconds) === undefined ? {} : { seconds: num(t.seconds) }), once: t.once !== false, ...(str(t.team) === '' ? {} : { team: str(t.team) }), actions }];
  });
  return { zones, values, triggers };
}

/** Was der Dienst bekommt — dieselbe Form wie `Cogita.GameRules`. */
export const gameJson = (rules: GameRules): Record<string, unknown> => ({
  /* Zeitfenster als volle ISO-Zeit: der Dienst liest sie als DateTimeOffset. */
  zones: rules.zones.map((z) => {
    const iso = (t?: string) => (t === undefined || Number.isNaN(new Date(t).getTime()) ? undefined : new Date(t).toISOString());
    return { id: z.id, lat: z.lat, lon: z.lon, radius: z.radius, ...(iso(z.from) === undefined ? {} : { from: iso(z.from) }), ...(iso(z.to) === undefined ? {} : { to: iso(z.to) }) };
  }),
  values: rules.values,
  triggers: rules.triggers
});

/* -- Der Weg zum Dienst --------------------------------------------------------------------- */

const head = (c: Credentials): Record<string, string> => ({
  ...(c.seat === undefined ? {} : { 'X-Recreatio-Seat': c.seat }),
  ...(c.join === undefined ? {} : { 'X-Cogita-Join': c.join })
});

export const startGame = (sessionId: string, rules: GameRules): Promise<{ zones: number; triggers: number }> =>
  call(`/cogita/session/${encodeURIComponent(sessionId)}/game`, { method: 'POST', body: JSON.stringify(gameJson(rules)) });

export interface GameView {
  readonly running: boolean;
  readonly rules?: GameRules | { zones: readonly Zone[]; values: readonly GameValue[] };
  readonly state?: { values: Record<string, Record<string, number>>; ledger: readonly { at: string; trigger: string; target: string; value: string; before: number; after: number }[]; inside: Record<string, string[]> };
  readonly positions?: readonly Position[];
  readonly values?: Record<string, Record<string, number>>;
  readonly inside?: readonly string[];
}

export const loadGame = (sessionId: string, cred: Credentials, player?: string, team?: string): Promise<GameView> =>
  call(`/cogita/session/${encodeURIComponent(sessionId)}/game?${player === undefined ? '' : `player=${encodeURIComponent(player)}&`}${team === undefined ? '' : `team=${encodeURIComponent(team)}`}`, {}, head(cred));

export const postPosition = (sessionId: string, cred: Credentials, pos: { player: string; team?: string | null; lat: number; lon: number; accuracy?: number | null }): Promise<{ fired: number }> =>
  call(`/cogita/session/${encodeURIComponent(sessionId)}/position`, { method: 'POST', body: JSON.stringify(pos) }, head(cred));

export const changeValue = (sessionId: string, value: string, target: string, change: { by?: number; to?: number }): Promise<{ changed: number }> =>
  call(`/cogita/session/${encodeURIComponent(sessionId)}/game/value`, { method: 'POST', body: JSON.stringify({ value, target, ...change }) });

/* -- Wo man ist ------------------------------------------------------------------------------- */

export interface Position {
  readonly player: string;
  readonly team: string | null;
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number | null;
  readonly at: string;
}

export function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * DIE STELLE MELDEN, während das Spiel läuft: höchstens alle fünf Sekunden,
 * und nur, wenn man sich bewegt hat (oder eine halbe Minute nichts kam).
 * Gibt eine Funktion zum Beenden zurück.
 */
export function watchPlace(send: (pos: { lat: number; lon: number; accuracy: number | null }) => void, fail?: (message: string) => void): () => void {
  if (typeof navigator === 'undefined' || navigator.geolocation === undefined) { fail?.('To urządzenie nie podaje położenia.'); return () => undefined; }
  let lastAt = 0;
  let last: { lat: number; lon: number } | null = null;
  const id = navigator.geolocation.watchPosition((p) => {
    const here = { lat: p.coords.latitude, lon: p.coords.longitude };
    const now = Date.now();
    if (now - lastAt < 5000) return;
    if (last !== null && metres(last, here) < 8 && now - lastAt < 30_000) return;
    lastAt = now;
    last = here;
    send({ ...here, accuracy: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null });
  }, (e) => fail?.(e.code === 1 ? 'Bez zgody na położenie gra w terenie nie działa.' : 'Nie udało się ustalić położenia.'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 });
  return () => navigator.geolocation.clearWatch(id);
}

/** Wer verdächtig springt [J4]: schneller als ein Radfahrer bergab, oder ungenauer als ein Häuserblock. */
export interface Suspicion {
  readonly player: string;
  readonly why: string;
}

export function suspicions(track: ReadonlyMap<string, readonly Position[]>, maxSpeed = 15, maxAccuracy = 150): Suspicion[] {
  const out: Suspicion[] = [];
  for (const [player, points] of track) {
    const sorted = points.slice().sort((a, b) => a.at.localeCompare(b.at));
    for (let i = 1; i < sorted.length; i += 1) {
      const seconds = (new Date(sorted[i].at).getTime() - new Date(sorted[i - 1].at).getTime()) / 1000;
      if (seconds <= 0) continue;
      const speed = metres(sorted[i - 1], sorted[i]) / seconds;
      if (speed > maxSpeed) { out.push({ player, why: `skok ${Math.round(speed)} m/s` }); break; }
    }
    const worst = Math.max(0, ...sorted.map((p) => p.accuracy ?? 0));
    if (worst > maxAccuracy) out.push({ player, why: `dokładność ${Math.round(worst)} m` });
  }
  return out;
}

/* -- Die Karte zum Entdecken [K5] -------------------------------------------------------------- */

/**
 * WO DIE PUNKTE DER KARTE STEHEN (0..1): Ringe nach der Tiefe von den Wurzeln
 * her — was niemand voraussetzt, steht in der Mitte. Keine gespeicherten
 * Plätze: dieselben Punkte stehen immer gleich.
 */
export function ringsOf(ids: readonly string[], edges: readonly { from: string; to: string }[]): Map<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const into = new Set(edges.map((e) => e.to));
  const queue = ids.filter((id) => !into.has(id));
  queue.forEach((id) => depth.set(id, 0));
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of edges) if (e.from === id && !depth.has(e.to)) { depth.set(e.to, (depth.get(id) ?? 0) + 1); queue.push(e.to); }
  }
  const rings = new Map<number, string[]>();
  for (const id of ids) { const d = depth.get(id) ?? 1; rings.set(d, [...(rings.get(d) ?? []), id]); }
  const where = new Map<string, { x: number; y: number }>();
  for (const [d, members] of rings) members.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / members.length + d * 0.4;
    const r = d === 0 && members.length === 1 ? 0 : 0.12 + d * 0.13;
    where.set(id, { x: 0.5 + Math.cos(angle) * Math.min(0.45, r), y: 0.5 + Math.sin(angle) * Math.min(0.42, r) });
  });
  return where;
}

export type Fog = 'known' | 'fading' | 'frontier' | 'fog' | 'landmark';

/**
 * WAS AUF DER KARTE ZU SEHEN IST: was sitzt, ist hell; was einmal sass und
 * nachlässt, verblasst (decay); was an Bekanntes grenzt, ist die Grenze
 * (frontier) und lässt sich betreten; der Rest liegt im Nebel. Schwellen
 * (landmark) sieht man immer.
 */
export function fogOf(nodes: readonly { id: string; landmark?: boolean }[], edges: readonly { from: string; to: string }[], knowness: (id: string) => number, seen: (id: string) => boolean): Map<string, Fog> {
  const out = new Map<string, Fog>();
  const near = new Map<string, Set<string>>();
  for (const e of edges) {
    near.set(e.from, (near.get(e.from) ?? new Set()).add(e.to));
    near.set(e.to, (near.get(e.to) ?? new Set()).add(e.from));
  }
  for (const n of nodes) {
    const k = knowness(n.id);
    if (k >= 1) out.set(n.id, 'known');
    else if (seen(n.id)) out.set(n.id, 'fading');
  }
  for (const n of nodes) {
    if (out.has(n.id)) continue;
    if (n.landmark === true) { out.set(n.id, 'landmark'); continue; }
    const touching = [...(near.get(n.id) ?? [])].some((m) => out.get(m) === 'known' || out.get(m) === 'fading');
    out.set(n.id, touching ? 'frontier' : 'fog');
  }
  /* Nichts bekannt: der Anfang ist, was niemand voraussetzt — sonst stünde alles im Nebel. */
  if (![...out.values()].some((f) => f === 'known' || f === 'fading' || f === 'frontier')) {
    const into = new Set(edges.map((e) => e.to));
    for (const n of nodes) if (!into.has(n.id) && out.get(n.id) === 'fog') out.set(n.id, 'frontier');
  }
  return out;
}
