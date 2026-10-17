/**
 * 2026-10-17 — WAS IN EINER ZEICHNUNG ZUM ANFASSEN NICHT STIMMT, ohne sie zu
 * zeichnen: für den Editor des Bausteins „Animacja" und die Prüfungen
 * (`app-sim-check`). Geladen erst, wenn jemand ein solches Bild bearbeitet.
 */

import type { Drawing, Shape } from './drawing';
import type { Num } from './liveModel';
import { Program, type Problem } from './liveRun';

/**
 * Das Programm und jeder Ausdruck an jedem Teil (Werte, `show`, Kurven,
 * Spuren, Punkte, Rahmen, Ziehen, Antippen), übersetzt mit denselben Namen wie
 * beim Zeichnen — die Teile einer Art der Welt mit den Namen eines Dings.
 */
export function problemsOf(drawing: Drawing): Problem[] {
  const program = new Program(drawing.live);
  const walk = (list: readonly Shape[], depth: number, path: string, thing: boolean) => {
    if (depth > 8) return;
    const expr = (source: string, where: string, extra: readonly string[] = []) => (thing ? program.compileThing(source, where, extra) : program.compile(source, where, extra));
    const num = (n: Num, where: string, extra: readonly string[] = []) => { if (typeof n !== 'number') expr(n.expr, where, extra); };
    list.forEach((s, i) => {
      const where = `${path}[${i}] ${s.type}`;
      for (const [key, source] of Object.entries(s.bind ?? {})) {
        if (key !== 'text') expr(source, `${where}.${key}`);
        else if (thing) program.compileThing(source, `${where}.text`, [], true);
        else program.compileText(source, `${where}.text`);
      }
      if (s.show !== null) expr(s.show, `${where}.show`);
      if (s.type === 'plot') {
        for (const [key, source] of [['fn', s.fn], ['fx', s.fx], ['fy', s.fy]] as const) if (source !== null) expr(source, `${where}.${key}`, [s.var]);
        num(s.from, `${where}.from`);
        num(s.to, `${where}.to`);
      }
      if (s.type === 'trace') for (const [key, source] of [['fx', s.fx], ['fy', s.fy]] as const) if (source !== null) expr(source, `${where}.${key}`);
      s.points.forEach(([a, b], k) => { num(a, `${where}.points[${k}]`); num(b, `${where}.points[${k}]`); });
      s.view?.forEach((n, k) => num(n, `${where}.view[${k}]`));
      /* In einer Art zieht und tippt das Ding (`drag`, `tap` der Art) — nicht ein Teil davon. */
      if (s.drag !== null && !thing) {
        program.prepare({ ...(s.drag.x === null ? {} : { [s.drag.x]: 'px' }), ...(s.drag.y === null ? {} : { [s.drag.y]: 'py' }), ...s.drag.set }, `${where}.drag`);
      }
      if (s.tap !== null && !thing) program.prepare(s.tap.set, `${where}.tap`);
      walk(s.type === 'use' ? drawing.symbols.get(s.use ?? '') ?? [] : s.children, depth + 1, `${where}.children`, thing);
    });
  };
  walk(drawing.elements, 0, 'elements', false);
  for (const k of drawing.live?.world?.kinds ?? []) walk(k.shapes, 0, `world.kinds „${k.name}".shapes`, true);
  return [...program.problems];
}
