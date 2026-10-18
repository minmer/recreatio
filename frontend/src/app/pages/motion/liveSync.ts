/**
 * 2026-10-18 — DIE BEDIENUNG SCHREIBEN (aus `LiveDrawing.tsx` gelöst): nach
 * jedem Bild die Werte, die sich geändert haben, unmittelbar in die Elemente
 * der Bedienung — Schieber, Zahlen, Schalter, Anzeigen, der Knopf zum
 * Vermuten, und in einer Welt: die Zeilen („Ustawiasz"), was ein Ding heisst
 * („Ciężarek 2 kg"), das gewählte Ding, Cofnij/Ponów. React baut die
 * Elemente nur, wenn sich der Bau oder die Wahl ändert.
 */

import { toNum, truth } from './expr';
import type { Program } from './liveRun';
import type { Thing } from './liveThings';
import { digitsOf, predictLabel, propRange, withUnit } from './LivePanel';

export class PanelSync {
  private lastStatus: string | null = null;
  private readonly ctrlEls = new Map<number, HTMLElement>();

  constructor(
    private readonly program: Program,
    private readonly panel: HTMLElement | null,
    private readonly box: HTMLElement | null,
    private readonly svg: SVGSVGElement,
    private readonly locked: boolean
  ) {
    panel?.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => this.ctrlEls.set(Number(el.dataset.c), el));
  }

  /** Die Bedienung des Bildes (`controls`) — nur, was sich geändert hat (`null`: alles). */
  controls(changed: ReadonlySet<string> | null): void {
    const program = this.program;
    const env = program.env;
    const statusChanged = program.status !== this.lastStatus;
    this.lastStatus = program.status;
    program.controls.forEach((c, i) => {
      const el = this.ctrlEls.get(i);
      if (el === undefined) return;
      const show = program.controlShows[i];
      if (show !== null && (changed === null || show.reads.some((r) => changed.has(r)))) el.hidden = !truth(show.run(env));
      if ('var' in c && changed !== null && !changed.has(c.var) && c.type !== 'choice') return;
      switch (c.type) {
        case 'slider': {
          const spec = program.varOf(c.var);
          const value = program.value(c.var);
          const input = el.querySelector('input');
          if (input !== null && input.valueAsNumber !== value && document.activeElement !== input) input.value = String(value);
          const out = el.querySelector('output');
          const text = withUnit(value, digitsOf(spec?.step ?? null, c.digits), c.unit || spec?.unit || '');
          if (out !== null && out.textContent !== text) out.textContent = text;
          if (input !== null) input.setAttribute('aria-valuetext', text);
          return;
        }
        case 'number': {
          const input = el.querySelector('input');
          const value = program.value(c.var);
          if (input !== null && document.activeElement !== input && toNum(input.value) !== value) input.value = String(value);
          return;
        }
        case 'toggle': {
          const input = el.querySelector('input');
          if (input !== null) input.checked = truth(program.value(c.var));
          return;
        }
        case 'choice': {
          if (changed !== null && !changed.has(c.var)) return;
          const value = program.value(c.var);
          el.querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-pressed', String(c.options[n]?.value === value)));
          return;
        }
        case 'button': {
          if (!statusChanged && changed !== null) return;
          const running = program.status === 'running' || program.sleeping;
          if (c.do === 'toggle') {
            el.textContent = running ? 'Pauza' : (program.status === 'paused' ? 'Dalej' : c.label);
            el.setAttribute('aria-pressed', String(running));
          }
          if (c.do === 'run') el.toggleAttribute('data-on', running);
          return;
        }
        case 'readout': {
          const e = program.controlValues[i];
          if (e === null) return;
          if (changed !== null && !e.reads.some((r) => changed.has(r))) return;
          const raw = e.run(env);
          const text = typeof raw === 'string' ? raw : withUnit(raw, c.digits ?? 2, c.unit);
          const out = el.querySelector('output');
          if (out !== null && out.textContent !== text) out.textContent = text;
          return;
        }
      }
    });
  }

  /** Erst vermuten, dann sehen: der Knopf heisst, was er jetzt tut — „Sprawdź", „Popraw", „Przewiduj". */
  predict(): void {
    const program = this.program;
    const label = predictLabel(program);
    this.panel?.querySelectorAll<HTMLButtonElement>('[data-w="predict"]').forEach((b) => {
      if (b.textContent !== label) b.textContent = label;
      b.classList.toggle('wk-btn-line', !program.held);
      b.setAttribute('aria-pressed', String(program.held));
    });
    this.box?.classList.toggle('is-held', program.held);
  }

  /** Eine Eigenschaft eines Dings in ihre Elemente: die Zahl, der Schieber (mit Grenzen, die sich ändern können), die Anzeige. */
  private prop(el: HTMLElement, t: Thing, name: string): void {
    const world = this.program.world;
    const spec = t.kind.props.get(name)?.spec;
    if (world === null || spec === undefined) return;
    const value = toNum(t.env[name]);
    const r = propRange(spec, world.bounds(t, name), value);
    const text = withUnit(value, digitsOf(spec.step, null), spec.unit);
    const out = el.querySelector('output');
    if (out !== null && out.textContent !== text) out.textContent = text;
    el.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.min !== String(r.min)) input.min = String(r.min);
      if (input.max !== String(r.max)) input.max = String(r.max);
      if (input.step !== String(r.step)) input.step = String(r.step);
      if (document.activeElement !== input && input.valueAsNumber !== value) input.value = String(value);
      if (input.type === 'range') input.setAttribute('aria-valuetext', text);
    });
  }

  /** Die Werkstatt: Cofnij/Ponów, Start/Pauza, die Zeilen, die Namen der Dinge, das gewählte Ding. */
  world(changed: ReadonlySet<string> | null): void {
    const { program, locked } = this;
    const world = program.world;
    const p = this.panel;
    if (world === null || p === null) return;
    p.querySelectorAll<HTMLButtonElement>('[data-w="undo"]').forEach((b) => { b.disabled = locked || !world.canUndo(); });
    p.querySelectorAll<HTMLButtonElement>('[data-w="redo"]').forEach((b) => { b.disabled = locked || !world.canRedo(); });
    p.querySelectorAll<HTMLButtonElement>('[data-w="toggle"]').forEach((b) => {
      const text = program.status === 'running' || program.sleeping ? 'Pauza' : 'Start';
      if (b.textContent !== text) b.textContent = text;
    });
    /* Nach jeder Änderung (eines Werts der Welt oder des Bildes, von dem eine Grenze abhängen kann). */
    if (changed !== null && changed.size === 0) return;
    p.querySelectorAll<HTMLElement>('[data-title]').forEach((el) => {
      const t = world.get(el.dataset.title ?? '');
      const text = t === undefined ? '' : world.title(t);
      if (el.textContent !== text) el.textContent = text;
    });
    /* Ein Vorleser hört dasselbe, was die Bedienung zeigt („Ciężarek 2 kg"). */
    this.svg.querySelectorAll<SVGGElement>('[data-thing]').forEach((g) => {
      const t = world.get(g.dataset.thing ?? '');
      if (t !== undefined && g.getAttribute('aria-label') !== world.title(t)) g.setAttribute('aria-label', world.title(t));
    });
    const selected = world.selected === null ? undefined : world.get(world.selected);
    p.querySelectorAll<HTMLElement>('[data-prop]').forEach((el) => {
      const t = el.dataset.row === undefined ? selected : world.get(el.dataset.row);
      if (t !== undefined) this.prop(el, t, el.dataset.prop ?? '');
    });
    if (selected === undefined) return;
    p.querySelectorAll<HTMLElement>('[data-ro]').forEach((el) => {
      const i = Number(el.dataset.ro);
      const spec = selected.kind.spec.readouts[i];
      if (spec === undefined) return;
      el.hidden = !world.readoutShown(selected, i);
      const raw = world.readout(selected, i);
      const text = typeof raw === 'string' ? raw : withUnit(raw, spec.digits ?? 2, spec.unit);
      const out = el.querySelector('output');
      if (out !== null && out.textContent !== text) out.textContent = text;
    });
  }

  /** Was gewählt ist (ein Ring im Bild, die Zeilen seines Dings betont) — und was man ändern darf (`is-free`; `is-mixed`: es gibt beides). */
  marks(): void {
    const world = this.program.world;
    if (world === null) return;
    const now = world.selected;
    let free = 0;
    let fixed = 0;
    this.svg.querySelectorAll<SVGGElement>('[data-thing]').forEach((g) => {
      const t = world.get(g.dataset.thing ?? '');
      const can = t !== undefined && !world.fixed(t);
      if (can) free += 1; else fixed += 1;
      g.classList.toggle('is-selected', g.dataset.thing === now);
      g.classList.toggle('is-free', can);
    });
    this.box?.classList.toggle('is-mixed', free > 0 && fixed > 0);
    this.panel?.querySelectorAll<HTMLElement>('[data-row]').forEach((el) => el.classList.toggle('is-selected', el.dataset.row === now));
  }
}
