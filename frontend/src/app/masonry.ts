/**
 * DIE SPALTEN EINER SEITE, JEDE FÜR SICH (0101).
 *
 * <b>Vorher ein Raster mit Zeilen:</b> ein hoher Baustein machte seine Zeilen
 * hoch — und damit jeden Baustein daneben, der in denselben Zeilen stand. Unter
 * einem kurzen blieb ein Loch, so hoch wie der lange daneben.
 *
 * <b>Jetzt eine Skyline:</b> jeder Baustein steht in den Spalten, die der Editor
 * ihm gab, so weit oben, wie es in DIESEN Spalten geht. Was daneben ist, rückt
 * nicht mit.
 *
 * <b>Und am Ende ausgeglichen:</b> ein Baustein, unter dem nichts mehr kommt,
 * wandert in Spalten derselben Breite, die früher enden — wenn er dort
 * spürbar höher steht. So füllt sich zuerst der Platz, der sonst unten leer
 * bliebe; die Breite bleibt, die der Editor gab.
 */

export interface Brick {
  readonly id: string;
  /** Erste Spalte, ab 1. */
  readonly col: number;
  readonly span: number;
  readonly height: number;
}

export interface Placed {
  readonly id: string;
  readonly col: number;
  readonly span: number;
  readonly top: number;
  readonly height: number;
}

/** Wie viel höher ein Baustein am Ende stehen muss, damit er die Spalten wechselt — sonst wackelt die Seite um Pixel. */
const WORTH = 40;

export function pack(bricks: readonly Brick[], columns: number, gap: number): { readonly placed: readonly Placed[]; readonly height: number } {
  const placed: Placed[] = [];
  const bottoms = new Array<number>(columns).fill(0);

  /* 1. In Lesefolge, jeder in seinen Spalten so hoch wie möglich. */
  for (const brick of bricks) {
    const span = Math.max(1, Math.min(columns, brick.span));
    const col = Math.max(1, Math.min(columns - span + 1, brick.col));
    const top = Math.max(...bottoms.slice(col - 1, col - 1 + span));
    placed.push({ id: brick.id, col, span, top, height: brick.height });
    for (let c = col - 1; c < col - 1 + span; c += 1) bottoms[c] = top + brick.height + gap;
  }

  /* 2. Am Ende: wer unten steht und woanders deutlich höher stehen könnte, wechselt. */
  const covers = (p: Placed, c: number) => c >= p.col - 1 && c < p.col - 1 + p.span;
  for (let round = 0; round < placed.length; round += 1) {
    let best: { index: number; col: number; top: number } | null = null;

    for (let index = 0; index < placed.length; index += 1) {
      const p = placed[index];
      /* Nur, unter wem in keiner seiner Spalten noch etwas steht. */
      const last = placed.every((q, j) => j === index || !Array.from({ length: p.span }, (_, k) => p.col - 1 + k).some((c) => covers(q, c)) || q.top < p.top);
      if (!last) continue;

      const without = (c: number) => Math.max(0, ...placed.filter((q, j) => j !== index && covers(q, c)).map((q) => q.top + q.height + gap));
      for (let start = 1; start <= columns - p.span + 1; start += 1) {
        if (start === p.col) continue;
        const top = Math.max(...Array.from({ length: p.span }, (_, k) => without(start - 1 + k)));
        const gain = p.top - top;
        if (gain > WORTH && (best === null || p.top - top > placed[best.index].top - best.top)) best = { index, col: start, top };
      }
    }

    if (best === null) break;
    const { index, col, top } = best;
    placed[index] = { ...placed[index], col, top };
  }

  const height = placed.reduce((most, p) => Math.max(most, p.top + p.height), 0);
  return { placed, height };
}
