/**
 * 2026-11-09 — TREFFEN UND VERDECKEN auf dem Bild der Weltkarte (Step-1-Bericht §3: „Picking über ein Raster statt über alle
 * Säulen", „Verdeckung nach Abstand"), rein. Der Zeichner legt jede gezeichnete Säule in der Reihenfolge des Malens ab
 * (später = näher); ein Raster aus Feldern zu 48 Bildpunkten sagt, welche Säulen einen Punkt überhaupt treffen können.
 * <code>
 *   Treffen   die vorderste Säule unter dem Punkt: Mantel zwischen den Ellipsen oder eine der beiden Ellipsen
 *   Namen     ein Name, dessen Mitte und Enden zu zwei Dritteln auf einer NÄHEREN Säule liegen, wird nicht gezeigt
 *             (spec §4.3: Namen überdecken sich nie; ein verdeckter Name wäre nur halb lesbar)
 * </code>
 */

/** Eine gezeichnete Säule in Bildpunkten: Mitte x, Oberkante und Fuss (Mitten der Ellipsen), Halbachsen. */
export interface DrawnPillar {
  readonly id: string;
  readonly x: number;
  readonly top: number;
  readonly bottom: number;
  readonly rx: number;
  readonly ry: number;
}

/** Liegt ein Punkt auf der Säule (Mantel oder eine der Ellipsen)? */
export function onPillar(d: DrawnPillar, x: number, y: number): boolean {
  if (Math.abs(x - d.x) > d.rx) return false;
  if (y >= d.top && y <= d.bottom) return true;
  const ry = Math.max(1, d.ry);
  const u = ((x - d.x) / d.rx) ** 2;
  return u + ((y - d.top) / ry) ** 2 <= 1 || u + ((y - d.bottom) / ry) ** 2 <= 1;
}

export interface PickGrid {
  readonly cell: number;
  /** Je Feld die Säulen (Indizes in `list`, aufsteigend: hinten zuerst). */
  readonly cells: ReadonlyMap<number, readonly number[]>;
  readonly list: readonly DrawnPillar[];
}

const OFF = 2048;
const keyOf = (cx: number, cy: number): number => (cx + OFF) * 8192 + (cy + OFF);

/** Das Raster über die gezeichneten Säulen (in der Reihenfolge des Malens). */
export function pickGrid(list: readonly DrawnPillar[], cell = 48): PickGrid {
  const cells = new Map<number, number[]>();
  list.forEach((d, i) => {
    const x0 = Math.floor((d.x - d.rx) / cell), x1 = Math.floor((d.x + d.rx) / cell);
    const y0 = Math.floor((d.top - d.ry) / cell), y1 = Math.floor((d.bottom + d.ry) / cell);
    for (let cx = Math.max(-OFF, x0); cx <= Math.min(OFF - 1, x1); cx += 1) {
      for (let cy = Math.max(-OFF, y0); cy <= Math.min(OFF - 1, y1); cy += 1) {
        const k = keyOf(cx, cy);
        const at = cells.get(k);
        if (at === undefined) cells.set(k, [i]); else at.push(i);
      }
    }
  });
  return { cell, cells, list };
}

/** Die vorderste Säule unter einem Punkt (ihre Kennung), sonst null — mit `after`: nur Säulen, die nach dieser gemalt sind. */
export function pickAt(g: PickGrid, x: number, y: number, after = -1): string | null {
  const i = pickIndex(g, x, y, after);
  return i < 0 ? null : g.list[i].id;
}

function pickIndex(g: PickGrid, x: number, y: number, after: number): number {
  const ids = g.cells.get(keyOf(Math.floor(x / g.cell), Math.floor(y / g.cell)));
  if (ids === undefined) return -1;
  for (let j = ids.length - 1; j >= 0; j -= 1) {
    const i = ids[j];
    if (i <= after) return -1;
    if (onPillar(g.list[i], x, y)) return i;
  }
  return -1;
}

/** Ist ein Name (Mitte x, y, Breite w) von näheren Säulen verdeckt — zwei seiner drei Punkte auf einer Säule nach `own`? */
export function nameCovered(g: PickGrid, own: number, x: number, y: number, w: number): boolean {
  let hits = 0;
  for (const px of [x - w * 0.4, x, x + w * 0.4]) if (pickIndex(g, px, y, own) >= 0) hits += 1;
  return hits >= 2;
}
