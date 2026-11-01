/**
 * 2026-11-01 — MEHRERE LÜCKEN IN EINEM TEXT (auch Lücken zum Wählen) — „uzupełnij uzasadnienie" eines Beweises.
 *
 * <code>
 *   Text      die Stücke zwischen den Lücken, mit ihren Wzory
 *   Lücke     mit `choices`: eine Liste zum Wählen (das richtige Wort und die falschen, gemischt — auch Wzory, sie werden
 *             gewählt, nicht getippt); ohne: ein Feld zum Tippen. Enter geht zur nächsten Lücke, in der letzten prüft es.
 *   danach    ✓/✗ an jeder Lücke, bei einer falschen das richtige Wort daneben; „2 z 3 luk dobrze"
 * </code>
 *
 * Die Liste zum Wählen ist kein `<select>`: dessen `<option>` kann keinen Wzór setzen. Sie ist eine Liste mit
 * `role="listbox"`: Pfeile, Enter, Esc, Pos1/Ende, Buchstaben springen nicht (Wzory haben keine).
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

import { TexText } from '../ui/tex/Tex';
import type { GapSlot } from './cardBasics';

/** Die Möglichkeiten einer Lücke: das richtige Wort und die falschen, gemischt (je Zeigen neu), ohne Doppelte. */
function optionsOf(slot: GapSlot): string[] {
  const all = [...new Set([...slot.accepted.slice(0, 1), ...(slot.choices ?? [])].map((x) => x.trim()).filter((x) => x !== ''))];
  for (let i = all.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j]!, all[i]!];
  }
  return all;
}

function GapChoice({ options, value, onChange, locked, label, state, onEnter }: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  label: string;
  state: '' | ' is-right' | ' is-wrong';
  onEnter: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /* Steht die Lücke am rechten Rand (ein Telefon), öffnet die Liste nach links — nie über den Bildschirm hinaus. */
  const [toLeft, setToLeft] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const id = `cg-gap-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  useLayoutEffect(() => {
    if (!open) { setToLeft(false); return; }
    const r = list.current?.getBoundingClientRect();
    if (r !== undefined && r.right > document.documentElement.clientWidth - 4) setToLeft(true);
  }, [open]);
  /* Die aktive Möglichkeit bleibt sichtbar, wenn die Liste rollt. */
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>('.is-active')?.scrollIntoView({ block: 'nearest' }); }, [open, active]);

  /* Ein Klick daneben schliesst die Liste. */
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent) => { if (root.current !== null && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const choose = (v: string) => { onChange(v); setOpen(false); button.current?.focus(); };
  const show = () => { setActive(Math.max(0, options.indexOf(value))); setOpen(true); };
  const onKey = (e: ReactKeyboardEvent) => {
    if (locked) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ')) { e.preventDefault(); show(); return; }
    if (!open && e.key === 'Enter') { if (value !== '') { e.preventDefault(); onEnter(); } else { e.preventDefault(); show(); } return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const v = options[active]; if (v !== undefined) choose(v); return; }
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <span ref={root} className={`cg-gap-choice${state}${open ? ' is-open' : ''}`}>
      <button ref={button} type="button" className="cg-gap-button" disabled={locked} aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
        aria-label={value === '' ? `${label}: wybierz` : `${label}: ${value}`} aria-activedescendant={open ? `${id}-${active}` : undefined}
        data-gap-choice="" onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}>
        {value === '' ? <span className="cg-muted">wybierz…</span> : <TexText text={value} />}
        <span className="cg-gap-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <ul ref={list} id={id} role="listbox" className={`cg-gap-list${toLeft ? ' is-left' : ''}`} aria-label={label}>
          {options.map((o, i) => (
            <li key={o} id={`${id}-${i}`} role="option" aria-selected={o === value} className={`cg-gap-option${i === active ? ' is-active' : ''}`} data-gap-option={o}
              onPointerDown={(e) => e.preventDefault()} onClick={() => choose(o)} onPointerEnter={() => setActive(i)}>
              <TexText text={o} />
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

export function GapAnswer({ pieces, gaps, locked, autoFocus = true, given, marks, onSubmit, action }: {
  pieces: readonly string[];
  gaps: readonly GapSlot[];
  locked: boolean;
  autoFocus?: boolean;
  /** Nach der Prüfung: was in jeder Lücke stand — dann stehen die Marken darauf. */
  given?: readonly string[];
  marks?: readonly boolean[];
  onSubmit: (given: string[]) => void;
  /** „Dalej" an der Stelle von „Sprawdź", nach der Prüfung. */
  action?: ReactNode;
}) {
  const [values, setValues] = useState<readonly string[]>(() => given ?? gaps.map(() => ''));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options = useMemo(() => gaps.map((g) => (g.choices !== undefined && g.choices.length > 0 ? optionsOf(g) : null)), [gaps]);
  const root = useRef<HTMLDivElement | null>(null);
  const checked = given !== undefined;
  const shown = checked ? given : values;

  useEffect(() => {
    if (autoFocus && !locked) window.setTimeout(() => root.current?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true }), 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (i: number, v: string) => setValues((was) => was.map((x, j) => (j === i ? v : x)));
  const filled = values.filter((v) => v.trim() !== '').length;
  const submit = () => { if (!locked && filled > 0) onSubmit(values.map((v) => v.trim())); };
  /* Enter: zur nächsten Lücke — in der letzten prüfen. */
  const next = (i: number) => {
    const controls = [...(root.current?.querySelectorAll<HTMLElement>('[data-gap] input, [data-gap] [data-gap-choice]') ?? [])];
    const after = controls[i + 1];
    if (after !== undefined) after.focus(); else submit();
  };
  const right = (marks ?? []).filter(Boolean).length;

  return (
    <div ref={root} className={`cg-answer cg-gaps${checked ? ' is-checked' : ''}`} data-gaps={gaps.length}>
      <div className="cg-prompt cg-gap-text">
        {pieces.map((piece, i) => {
          const slot = gaps[i];
          const m = checked ? marks?.[i] ?? false : null;
          const state = m === null ? '' : m ? ' is-right' : ' is-wrong';
          const label = `Luka ${i + 1} z ${gaps.length}`;
          return (
            <span key={i}>
              {piece !== '' && <TexText text={piece} />}
              {slot !== undefined && (
                <span className="cg-gap" data-gap={i + 1} data-gap-state={m === null ? '' : m ? 'right' : 'wrong'}>
                  {options[i] !== null && options[i] !== undefined
                    ? <GapChoice options={options[i]!} value={shown[i] ?? ''} onChange={(v) => set(i, v)} locked={locked || checked} label={label} state={state} onEnter={() => next(i)} />
                    : (
                      <input type="text" className={`cg-gap-input${state}`} value={shown[i] ?? ''} disabled={locked || checked} aria-label={label}
                        size={Math.max(4, Math.min(24, (slot.accepted[0] ?? '').length + 2))} autoComplete="off" autoCapitalize="off" spellCheck={false}
                        onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); next(i); } }} />
                    )}
                  {m !== null && <span className="cg-option-mark" aria-label={m ? 'dobrze' : 'źle'}>{m ? '✓' : '✗'}</span>}
                  {m === false && <span className="cg-gap-fix">dobrze: <strong><TexText text={slot.accepted[0] ?? ''} /></strong></span>}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {action ?? (!checked && (
        <div className="cg-answer-actions">
          <button key="check" type="button" className="wk-btn" disabled={locked || filled === 0} onClick={submit}>
            Sprawdź{filled > 0 && filled < gaps.length ? ` (${filled} z ${gaps.length})` : ''}
          </button>
        </div>
      ))}
      {checked && <p className="cg-order-count" data-gaps-count={right}>{right} z {gaps.length} {gaps.length === 1 ? 'luki' : 'luk'} dobrze</p>}
    </div>
  );
}
