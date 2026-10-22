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
 * 2026-10-19 — oder zu einem SCHRITT derselben Szene (`step`: dem eigenen des
 * Knopfes, `step:<n>`: diesem): ein Bild antippen hebt es hervor, ohne die
 * Szene zu verlassen. Und `*` statt einer Szene: auf jeder Szene, auf der der
 * Knopf steht (eine kleine, feste Leiste mit „Kontakt").
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

import { type Piece, type Scene, type Show, type ShowLink } from './presentation';

/** Das Ende — dort hört der Weg auf. */
export const END = 'end';

/** Vor der Kennung eines Weges hinaus. */
export const LINK = 'link:';

/** „dalej": der Ausgang jeder Szene, der an Pfeilen, Rad und Leertaste hängt. */
export const NEXT = 'next';

/** 2026-10-19 — ein Schritt derselben Szene: `step` (der eigene des Knopfes) oder `step:<n>` (ab 0). */
export const STEP = 'step';

/** 2026-10-19 — ein Knopf auf jeder Szene, auf der er steht (`go: { "*": … }`); eine Szene mit eigenem Ziel geht vor. */
export const EVERY = '*';

/** 2026-10-21 — vor der Kennung eines Tores des Przebiegs (`story.ts`): eine Bedingung, ein Wert. */
export const GATE = 'gate:';

export type Target =
  | { readonly kind: 'scene'; readonly key: string }
  | { readonly kind: 'link'; readonly link: ShowLink }
  | { readonly kind: 'step'; readonly step: number | null }
  | { readonly kind: 'gate'; readonly key: string }
  | { readonly kind: 'end' }
  | { readonly kind: 'none' };

/** Die Tore des Przebiegs dieser Präsentation (`story.ts`) — keine, wenn sie keinen hat. */
const gatesOf = (show: Show) => show.story?.gates ?? [];

/**
 * 2026-10-21 — ALLES, wohin ein Ziel über die Tore führen KANN (beide Seiten
 * einer Bedingung): für die Karte, „erreichbar" und den kürzesten Weg. Was zur
 * Laufzeit gilt, entscheidet `story.ts` mit dem, was der Lernende weiss.
 */
function overGates(show: Show, said: string | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (at: string | null | undefined) => {
    const t = (at ?? '').trim();
    if (t === '' || seen.has(t)) return;
    seen.add(t);
    if (!t.startsWith(GATE)) { out.push(t); return; }
    const gate = gatesOf(show).find((g) => g.key === t.slice(GATE.length));
    if (gate === undefined) return;
    if (gate.type === 'set') walk(gate.next);
    else { walk(gate.yes); walk(gate.no); }
  };
  walk(said);
  return out;
}

/** Was ein gespeichertes Ziel heisst — und ob es das gibt. Ein Ziel, das es nicht (mehr) gibt, ist `none`. */
export function resolveTarget(show: Show, said: string | null | undefined): Target {
  const t = (said ?? '').trim();
  if (t === '') return { kind: 'none' };
  if (t === END) return { kind: 'end' };
  if (t === STEP) return { kind: 'step', step: null };
  const step = /^step:(\d{1,2})$/.exec(t);
  if (step !== null) return { kind: 'step', step: Number(step[1]) };
  if (t.startsWith(LINK)) {
    const link = show.links.find((one) => one.id === t.slice(LINK.length));
    return link === undefined ? { kind: 'none' } : { kind: 'link', link };
  }
  if (t.startsWith(GATE)) {
    const key = t.slice(GATE.length);
    return gatesOf(show).some((g) => g.key === key) ? { kind: 'gate', key } : { kind: 'none' };
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

/** Wohin ein Knopf auf dieser Szene führt — ihr eigenes Ziel, sonst das für jede Szene (`*`). */
export const goOf = (show: Show, piece: Piece, sceneKey: string): Target =>
  resolveTarget(show, piece.go[sceneKey] !== undefined ? piece.go[sceneKey] : piece.go[EVERY]);

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

/** Alle Ausgänge einer Szene, die zu einer anderen Szene führen — „dalej", jeder Knopf und (2026-10-21) jede Antwort einer Frage, durch die Tore. */
function sceneExits(show: Show, pieces: readonly Piece[], key: string): string[] {
  const scenes = new Set(show.scenes.map((sc) => sc.key));
  const out: string[] = [];
  const add = (said: string | null | undefined) => { for (const t of overGates(show, said)) if (scenes.has(t)) out.push(t); };
  const at = show.scenes.findIndex((sc) => sc.key === key);
  const own = at < 0 ? null : show.scenes[at].next;
  add(own !== null && own.trim() !== '' ? own : show.scenes[at + 1]?.key ?? END);
  for (const piece of pieces) {
    if (piece.places[key] === undefined && !piece.hold) continue;
    add(piece.go[key] !== undefined ? piece.go[key] : piece.go[EVERY]);
    add(piece.go[`${key}:right`]);
    add(piece.go[`${key}:wrong`]);
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
  if (t.kind === 'step') return t.step === null ? 'Własny krok tej sceny' : `Krok ${t.step + 1} tej sceny`;
  if (t.kind === 'gate') {
    const gate = gatesOf(show).find((g) => g.key === t.key);
    return `⑂ ${gate?.label || (gate?.type === 'set' ? 'Zmień wartość' : 'Warunek')}`;
  }
  if (t.kind === 'end') return 'Koniec';
  return fallback;
}

/** Wohin ein Ausgang führen kann: jede Szene, jeder Weg hinaus, das Ende. */
export function targetOptions(show: Show): { readonly value: string; readonly label: string }[] {
  return [
    ...show.scenes.map((sc, i) => ({ value: sc.key, label: `${i + 1}. ${sc.label || 'Scena'}` })),
    ...show.links.map((link) => ({ value: `${LINK}${link.id}`, label: `↗ ${link.label || link.href}` })),
    /* 2026-10-21 — und die Tore des Przebiegs. */
    ...gatesOf(show).map((gate) => ({ value: `${GATE}${gate.key}`, label: `⑂ ${gate.label || (gate.type === 'set' ? 'Zmień wartość' : 'Warunek')}` })),
    { value: END, label: 'Koniec' }
  ];
}

/** 2026-10-19 — wohin ein KNOPF führen kann: dazu die Schritte dieser Szene (`steps` — wie viele sie hat). */
export function goOptions(show: Show, steps: number): { readonly value: string; readonly label: string }[] {
  return [
    ...targetOptions(show),
    ...(steps > 1 ? [{ value: STEP, label: 'Własny krok tej sceny' }] : []),
    ...Array.from({ length: steps > 1 ? steps : 0 }, (_, n) => ({ value: `${STEP}:${n}`, label: `Krok ${n + 1} tej sceny` }))
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
  /* 2026-10-21 — die Tore des Przebiegs in einer Reihe unter allem anderen (ab der zweiten Spalte: links unten liegen die Knöpfe der Karte). */
  const below = (Math.max(1, ...rows.values()) + 2) * 190;
  gatesOf(show).forEach((gate, i) => { out[`${GATE}${gate.key}`] = { x: 300 + i * 260, y: below }; });
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
