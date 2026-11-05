/**
 * 2026-11-05 (Prompt 23, B4 / A8) — DIE KARTE EINES ABSTECHERS, eine für den Spieler (der Schritt `detour`) und für die
 * Ścieżka (das Fenster eines Zweiges): die andere Erzählung beim Namen, ihr Satz (das Streszczenie ihrer Einheit), was dort
 * wartet, „Wejdź" und „Dalej bez tego"; schon ukończona — „już znasz", „Przypomnij" und „Dalej"; Pflicht — nur „Wejdź";
 * abgelehnt (Kreis, zu tief) — nur „Dalej".
 */

import type { ReactNode } from 'react';

import { TexText } from '../ui/tex/Tex';
import type { Words } from './lang';

export interface DetourCardProps {
  readonly name: string;
  /** Wie der Abstecher angeboten wird (leer: „Chcesz wiedzieć więcej? → …"). */
  readonly label: string;
  readonly summary?: string;
  /** „7 slajdów · 16 pytań". */
  readonly work: string;
  readonly optional: boolean;
  readonly known: boolean;
  readonly started: boolean;
  readonly refused: 'cycle' | 'deep' | null;
  readonly W: Words;
  /** Hinein (`fresh`: von vorn — „Przypomnij"). */
  readonly onEnter: (fresh: boolean) => void;
  /** Weiter: `done` (ukończona oder Pflicht) oder `skip` (ohne sie); fehlt es (auf der Ścieżka), gibt es nur „Wejdź". */
  readonly onExit?: (exit: 'done' | 'skip') => void;
  /** Der Knopf „Dalej" des Spielers (wo er ihn sonst zeichnet). */
  readonly next?: (run: () => void) => ReactNode;
  readonly autoFocus?: boolean;
  readonly flowId: string;
}

export function DetourCard({ name, label, summary, work, optional, known, started, refused, W, onEnter, onExit, next, autoFocus = false, flowId }: DetourCardProps) {
  const exit = (x: 'done' | 'skip') => onExit?.(x);
  const goOn = (run: () => void) => (next !== undefined ? next(run) : <div className="wk-actions"><button type="button" className="wk-btn" onClick={run}>{W.goOn}</button></div>);
  return (
    <div className={`cg-detour${known ? ' is-known' : ''}`} data-flow-detour={flowId} data-flow-detour-state={known ? 'known' : started ? 'started' : 'new'} data-flow-detour-optional={optional ? '1' : '0'}>
      <p className="cg-muted">{label !== '' ? <TexText text={label} /> : W.detourAsk(name)}</p>
      <p className="cg-detour-name"><TexText text={name} /></p>
      {summary !== undefined && summary !== '' && <p className="cg-detour-summary" data-flow-detour-summary=""><TexText text={summary} /></p>}
      <p className="cg-muted" data-flow-detour-work="">{[work, known ? W.detourKnown : started ? W.detourStarted : ''].filter(Boolean).join(' · ')}</p>
      {refused !== null ? (
        <>
          <p className="wk-note" data-flow-detour-refused={refused}>{refused === 'cycle' ? W.detourCycle : W.detourDeep}</p>
          {onExit !== undefined && goOn(() => exit(optional ? 'skip' : 'done'))}
        </>
      ) : known ? (
        <div className="wk-actions">
          {onExit !== undefined && <button type="button" className="wk-btn" onClick={() => exit('done')} autoFocus={autoFocus} data-flow-detour-on="">{W.goOn}</button>}
          <button type="button" className={onExit !== undefined ? 'wk-btn wk-btn-line' : 'wk-btn'} onClick={() => onEnter(true)} data-flow-detour-remind="">{W.detourRemind}</button>
        </div>
      ) : (
        <>
          {!optional && <p className="cg-muted" data-flow-detour-required="">{W.detourRequired}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => onEnter(false)} autoFocus={autoFocus} data-flow-detour-enter="">{W.detourEnter}</button>
            {optional && onExit !== undefined && <button type="button" className="wk-btn wk-btn-line" onClick={() => exit('skip')} data-flow-detour-skip="">{W.detourSkip}</button>}
          </div>
        </>
      )}
    </div>
  );
}

/** Das Streszczenie einer Einheit aus ihren Feldern (wie `EntityReading`: Rolle/Schlüssel „summary" oder „Streszczenie"). */
export function summaryField(fields: readonly { readonly key: string; readonly label: string; readonly text: string }[] | undefined): string {
  const f = fields?.find((x) => ['summary', 'streszczenie', 'zusammenfassung', 'kurz'].includes(x.key.toLowerCase()) || ['streszczenie', 'zusammenfassung', 'summary'].includes(x.label.trim().toLowerCase()));
  return f?.text.trim() ?? '';
}
