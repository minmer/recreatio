/**
 * 0089 — WEGE DURCH EINE PRÄSENTATION. Die Szenen sind keine Reihe mehr,
 * sondern ein Netz: jede hat EINEN Eingang und mehrere Ausgänge.
 *
 * <code>
 *   „dalej"   die Pfeile, das Rad, der Finger, die Leertaste  → scene.next
 *   Knöpfe    ein Baustein, der auf dieser Szene ein Ausgang ist → piece.go[szene]
 * </code>
 *
 * Ein Ausgang führt zu einer Szene, zum Ende (`end`) oder HINAUS — zu einer
 * Seite im Netz oder hier (`link:<id>`, die Wege stehen in `show.links`).
 * Ohne eigenes Ziel führt „dalej" zur nächsten Szene der Liste: eine
 * Präsentation ohne Wege bleibt genau, wie sie war.
 *
 * <b>Was die Bühne zeigt, ist ein WEG</b> — die Szenen, die dieser Zuschauer
 * gerade geht, der Reihe nach (`route`). Auf ihm laufen der Antrieb, die
 * Übergänge und die wandernden Bausteine wie zuvor auf der Liste. Wer einen
 * Knopf drückt, behält, was hinter ihm liegt, und bekommt ab dort den neuen
 * Weg (`branch`); zurück geht es den Weg zurück.
 *
 * Rein und ohne React — geprüft in `app-presentation-check`.
 */

import { readPiece, type Piece, type Scene, type Show, type ShowLink } from './presentation';
import type { Layout } from './layout';

/** Das Ende — dort hört der Weg auf. */
export const END = 'end';

/** Vor der Kennung eines Weges hinaus. */
export const LINK = 'link:';

/** „dalej": der Ausgang jeder Szene, der an Pfeilen, Rad und Leertaste hängt. */
export const NEXT = 'next';

export type Target =
  | { readonly kind: 'scene'; readonly key: string }
  | { readonly kind: 'link'; readonly link: ShowLink }
  | { readonly kind: 'end' }
  | { readonly kind: 'none' };

/** Was ein gespeichertes Ziel heisst — und ob es das gibt. Ein Ziel, das es nicht (mehr) gibt, ist `none`. */
export function resolveTarget(show: Show, said: string | null | undefined): Target {
  const t = (said ?? '').trim();
  if (t === '') return { kind: 'none' };
  if (t === END) return { kind: 'end' };
  if (t.startsWith(LINK)) {
    const link = show.links.find((one) => one.id === t.slice(LINK.length));
    return link === undefined ? { kind: 'none' } : { kind: 'link', link };
  }
  return show.scenes.some((sc) => sc.key === t) ? { kind: 'scene', key: t } : { kind: 'none' };
}

/** Wohin „dalej" von dieser Szene führt: ihr eigenes Ziel — sonst die nächste der Liste, nach der letzten das Ende. */
export function nextOf(show: Show, key: string): Target {
  const at = show.scenes.findIndex((sc) => sc.key === key);
  if (at < 0) return { kind: 'end' };
  const own = resolveTarget(show, show.scenes[at].next);
  if (own.kind !== 'none') return own;
  const after = show.scenes[at + 1];
  return after === undefined ? { kind: 'end' } : { kind: 'scene', key: after.key };
}

/** Ist dieser Baustein auf dieser Szene ein Knopf? */
export const isButtonOn = (piece: Piece, sceneKey: string): boolean => piece.go[sceneKey] !== undefined;

/** Wohin ein Knopf auf dieser Szene führt. */
export const goOf = (show: Show, piece: Piece, sceneKey: string): Target => resolveTarget(show, piece.go[sceneKey]);

/** Von einer Szene aus „dalej" entlang — bis zum Ende, hinaus, oder zu einer Szene, die schon dran war. */
export function chainFrom(show: Show, key: string, taken: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  const seen = new Set(taken);
  let at: string | null = key;
  while (at !== null && !seen.has(at) && show.scenes.some((sc) => sc.key === at)) {
    out.push(at);
    seen.add(at);
    const next = nextOf(show, at);
    at = next.kind === 'scene' ? next.key : null;
  }
  return out;
}

/** Der Weg, den ein Zuschauer ohne einen Knopf geht — von der ersten Szene an. */
export const routeOf = (show: Show): string[] => (show.scenes.length === 0 ? [] : chainFrom(show, show.scenes[0].key));

/**
 * EIN KNOPF WURDE GEDRÜCKT (oder „dalej" führt zurück): auf Szene `active` des
 * Weges geht es nach `key`. Liegt sie schon hinter einem, geht es dorthin
 * zurück und der Weg bleibt; sonst gilt der Weg bis hier, und ab hier der neue.
 */
export function branch(show: Show, route: readonly string[], active: number, key: string): { route: readonly string[]; index: number } {
  const behind = route.indexOf(key);
  if (behind >= 0 && behind <= active) return { route, index: behind };
  const kept = route.slice(0, active + 1);
  const next = [...kept, ...chainFrom(show, key, new Set(kept))];
  return next.length === kept.length ? { route, index: Math.max(0, active) } : { route: next, index: kept.length };
}

/** Alle Ausgänge einer Szene, die zu einer anderen Szene führen — „dalej" und jeder Knopf. */
function sceneExits(show: Show, pieces: readonly Piece[], key: string): string[] {
  const out: string[] = [];
  const next = nextOf(show, key);
  if (next.kind === 'scene') out.push(next.key);
  for (const piece of pieces) {
    if (piece.places[key] === undefined && !piece.hold) continue;
    const t = goOf(show, piece, key);
    if (t.kind === 'scene') out.push(t.key);
  }
  return out;
}

/**
 * DER KÜRZESTE WEG ZU EINER SZENE — für einen Vortrag, der dort anfängt (der
 * Editor): von der ersten Szene über „dalej" und Knöpfe dorthin, und von dort
 * weiter „dalej". Kommt man nicht hin, fängt der Weg bei ihr an.
 */
export function routeTo(show: Show, pieces: readonly Piece[], key: string): string[] {
  if (!show.scenes.some((sc) => sc.key === key)) return routeOf(show);
  const first = show.scenes[0].key;
  const from = new Map<string, string | null>([[first, null]]);
  const queue = [first];
  while (queue.length > 0 && !from.has(key)) {
    const here = queue.shift()!;
    for (const next of sceneExits(show, pieces, here)) {
      if (from.has(next)) continue;
      from.set(next, here);
      queue.push(next);
    }
  }
  if (!from.has(key)) return chainFrom(show, key);
  const path: string[] = [];
  for (let at: string | null = key; at !== null; at = from.get(at) ?? null) path.unshift(at);
  return [...path.slice(0, -1), ...chainFrom(show, key, new Set(path.slice(0, -1)))];
}

/** Kommt man von der ersten Szene aus überhaupt hierher (über „dalej" und Knöpfe)? */
export function reachable(show: Show, pieces: readonly Piece[]): ReadonlySet<string> {
  const seen = new Set<string>();
  if (show.scenes.length === 0) return seen;
  const queue = [show.scenes[0].key];
  seen.add(queue[0]);
  while (queue.length > 0) {
    for (const next of sceneExits(show, pieces, queue.shift()!)) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

/** Ein Ziel in Worten — für die Auswahl im Editor und die Karte. */
export function targetLabel(show: Show, said: string | null | undefined, fallback = '— nigdzie —'): string {
  const t = resolveTarget(show, said);
  if (t.kind === 'scene') {
    const at = show.scenes.findIndex((sc) => sc.key === t.key);
    return `${at + 1}. ${show.scenes[at].label || 'Scena'}`;
  }
  if (t.kind === 'link') return `↗ ${t.link.label || t.link.href}`;
  if (t.kind === 'end') return 'Koniec';
  return fallback;
}

/** Wohin ein Ausgang führen kann: jede Szene, jeder Weg hinaus, das Ende. */
export function targetOptions(show: Show): { readonly value: string; readonly label: string }[] {
  return [
    ...show.scenes.map((sc, i) => ({ value: sc.key, label: `${i + 1}. ${sc.label || 'Scena'}` })),
    ...show.links.map((link) => ({ value: `${LINK}${link.id}`, label: `↗ ${link.label || link.href}` })),
    { value: END, label: 'Koniec' }
  ];
}

/** Ein Ziel, das auf etwas zeigt, das es nicht mehr gibt (eine gelöschte Szene, ein gelöschter Weg) — für die Warnung beim Import. */
export const brokenTarget = (show: Show, said: string | null | undefined): boolean =>
  (said ?? '').trim() !== '' && resolveTarget(show, said).kind === 'none';

/**
 * DIE KARTE OHNE GESPEICHERTE PLÄTZE: Szenen nach ihrem Abstand vom Anfang in
 * Spalten (der Weg ohne Knopf oben, Abzweige darunter), die Wege hinaus und das
 * Ende rechts daneben.
 */
export function autoMap(show: Show, pieces: readonly Piece[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  if (show.scenes.length === 0) return out;
  const depth = new Map<string, number>();
  const main = new Set(routeOf(show));
  const queue = [show.scenes[0].key];
  depth.set(queue[0], 0);
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const next of sceneExits(show, pieces, here)) {
      if (depth.has(next)) continue;
      depth.set(next, depth.get(here)! + 1);
      queue.push(next);
    }
  }
  /* Was man nicht erreicht, steht in einer eigenen Reihe darunter. */
  let deepest = 0;
  for (const d of depth.values()) deepest = Math.max(deepest, d);
  const rows = new Map<number, number>();
  const place = (key: string, column: number, first: boolean) => {
    const row = first ? 0 : (rows.get(column) ?? 1);
    if (!first) rows.set(column, row + 1);
    out[key] = { x: column * 300, y: row * 190 };
  };
  /* Der Weg ohne Knopf in der obersten Reihe, der Reihe nach; Abzweige nach ihrem Abstand darunter. */
  const mainOrder = routeOf(show);
  show.scenes.forEach((sc) => {
    const d = depth.get(sc.key);
    if (main.has(sc.key)) place(sc.key, mainOrder.indexOf(sc.key), true);
    else if (d !== undefined) place(sc.key, d, false);
  });
  deepest = Math.max(deepest, mainOrder.length - 1);
  show.scenes.filter((sc) => !depth.has(sc.key)).forEach((sc, i) => { out[sc.key] = { x: i * 300, y: (Math.max(...rows.values(), 1) + 1) * 190 }; });
  show.links.forEach((link, i) => { out[`${LINK}${link.id}`] = { x: (deepest + 1) * 300, y: i * 120 }; });
  out[END] = { x: (deepest + 1) * 300, y: show.links.length * 120 };
  return out;
}

/* -- Für den Editor: Ziele setzen ---------------------------------------------------------- */

/** Eine Szene mit einem neuen „dalej" (`null` — wieder die nächste der Liste). */
export const withNext = (scene: Scene, target: string | null): Scene => ({ ...scene, next: target === null || target.trim() === '' ? null : target });

/** Ein Baustein mit einem Ausgang auf dieser Szene — `undefined` nimmt ihm den Knopf. */
export function withGo(piece: Piece, sceneKey: string, target: string | undefined): Piece {
  const { [sceneKey]: _was, ...rest } = piece.go;
  void _was;
  return { ...piece, go: target === undefined ? rest : { ...rest, [sceneKey]: target } };
}

/** Die Knöpfe einer Szene — Bausteine, die dort stehen und dort ein Ausgang sind. */
export function buttonsOn<P extends { readonly layout: Layout }>(parts: readonly P[], sceneKey: string): P[] {
  return parts.filter((part) => {
    const piece = readPiece(part.layout);
    return piece.places[sceneKey] !== undefined && isButtonOn(piece, sceneKey);
  });
}
