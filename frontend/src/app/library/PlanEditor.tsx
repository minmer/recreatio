/**
 * DER PLAN EINES TEXTES, GESCHRIEBEN (2026-10-21) — wie eine Gliederung,
 * die man tippt, nicht klickt:
 *
 * <code>
 *   Enter              ein neuer Punkt darunter (am Cursor geteilt)
 *   Shift+Enter        eine neue Zeile im Punkt
 *   Tab / Shift+Tab    tiefer / höher (Esc, dann Tab: weiter zum nächsten Feld)
 *   Alt+↑ / Alt+↓      den Punkt verschieben
 *   ↑ / ↓              am Anfang / am Ende: in den Punkt davor / danach
 *   Backspace          in einem leeren Punkt: er geht weg
 * </code>
 *
 * Ein Zitat aus der Bibliothek wird ein eigener Punkt (`![@klucz]`), eine
 * Quelle steht im Punkt (`[@klucz, s. 12]`) — dieselben Wähler wie in der
 * Treść. Jeder Punkt behält seine Kennung, wohin er auch wandert: die
 * Wygłoszenia sagen über sie, was gesagt wurde und was nicht.
 */

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import { exportLibrary, patchFromDoc } from './libraryJson';
import { POINT_KINDS, str, type EntryData, type LibEntry } from './libraryKinds';
import type { LibraryStore } from './libraryStore';
import { QuoteFigure } from './LibraryText';
import { CitePicker } from './WritingTools';
import { embedOf, newPointId, planFromText, planOf, planPrompt, pointData, pointNumbers, type PlanPoint } from './sermon';

/** Ein Punkt — das Feld wächst mit seinem Text. */
function PointText({ point, readOnly, register, onFocus, onChange, onKey }: {
  point: PlanPoint;
  readOnly: boolean;
  register: (el: HTMLTextAreaElement | null) => void;
  onFocus: () => void;
  onChange: (text: string) => void;
  onKey: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = own.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [point.text]);
  return (
    <textarea
      ref={(el) => { own.current = el; register(el); }}
      className="lib-plan-text"
      rows={1}
      value={point.text}
      readOnly={readOnly}
      spellCheck
      lang="pl"
      aria-label="Punkt planu"
      placeholder={point.depth === 0 ? 'Główna myśl…' : 'Co pod nią: cytat, przykład, pytanie…'}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKey}
    />
  );
}

export function PlanEditor({ store, text, data, set, readOnly }: {
  store: LibraryStore;
  /** Der Text, wie er gerade im Editor steht — für das Polecenie (seine Kennung, seine Treść). */
  text: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const points = planOf(data, { keepEmpty: true });
  const numbers = pointNumbers(points);
  const areas = useRef(new Map<string, HTMLTextAreaElement>());
  const [focused, setFocused] = useState<string | null>(null);
  const [caret, setCaret] = useState<{ id: string; at: number } | null>(null);
  const [picker, setPicker] = useState<'cite' | 'embed' | null>(null);
  const [noted, setNoted] = useState<ReadonlySet<string>>(new Set());
  const [paste, setPaste] = useState('');

  const write = (next: readonly PlanPoint[]) => set({ plan: next.map(pointData) });
  const freshId = (also: ReadonlySet<string> = new Set()) => newPointId((id) => also.has(id) || points.some((p) => p.id === id));

  /* Punkte ohne Kennung (aus einem alten Import) bekommen einmal eine echte. */
  const unnamed = points.some((p) => p.id.startsWith('#'));
  useEffect(() => {
    if (readOnly || !unnamed) return;
    const used = new Set(points.map((p) => p.id));
    write(points.map((p) => {
      if (!p.id.startsWith('#')) return p;
      const id = newPointId((x) => used.has(x));
      used.add(id);
      return { ...p, id };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unnamed, readOnly]);

  /* Der Cursor geht dorthin, wo gerade etwas entstanden ist. */
  useEffect(() => {
    if (caret === null) return;
    const el = areas.current.get(caret.id);
    if (el !== undefined) {
      el.focus();
      const at = Math.min(caret.at, el.value.length);
      el.setSelectionRange(at, at);
    }
    setCaret(null);
  }, [caret]);

  const index = focused === null ? -1 : points.findIndex((p) => p.id === focused);
  const update = (id: string, patch: Partial<PlanPoint>) => write(points.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const maxDepth = (at: number): number => (at <= 0 ? 0 : Math.min(2, points[at - 1].depth + 1));

  const insertAt = (at: number, list: readonly Omit<PlanPoint, 'id'>[]) => {
    const used = new Set<string>();
    const made = list.map((p) => { const id = freshId(used); used.add(id); return { ...p, id }; });
    const next = [...points];
    next.splice(at, 0, ...made);
    write(next);
    if (made.length > 0) setCaret({ id: made[made.length - 1].id, at: made[made.length - 1].text.length });
  };

  const shift = (at: number, delta: -1 | 1) => {
    const p = points[at];
    const depth = Math.max(0, Math.min(maxDepth(at), p.depth + delta)) as 0 | 1 | 2;
    if (depth !== p.depth) update(p.id, { depth });
  };

  const move = (at: number, delta: -1 | 1) => {
    const to = at + delta;
    if (to < 0 || to >= points.length) return;
    const next = [...points];
    [next[at], next[to]] = [next[to], next[at]];
    write(next);
    setCaret({ id: points[at].id, at: areas.current.get(points[at].id)?.selectionStart ?? 0 });
  };

  const remove = (at: number) => {
    const before = points[at - 1];
    write(points.filter((_, i) => i !== at));
    if (before !== undefined) setCaret({ id: before.id, at: before.text.length });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, at: number) => {
    if (readOnly) return;
    const p = points[at];
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const id = freshId();
      const next = [...points];
      next[at] = { ...p, text: p.text.slice(0, start) };
      next.splice(at + 1, 0, { id, text: p.text.slice(end).replace(/^\s+/, ''), depth: p.depth, kind: 'thought', note: '' });
      write(next);
      setCaret({ id, at: 0 });
    } else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      shift(at, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      el.blur();
    } else if (e.key === 'Backspace' && p.text === '' && points.length > 1) {
      e.preventDefault();
      remove(at);
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(at, e.key === 'ArrowUp' ? -1 : 1);
    } else if (e.key === 'ArrowUp' && start === 0 && end === 0 && at > 0) {
      e.preventDefault();
      setCaret({ id: points[at - 1].id, at: points[at - 1].text.length });
    } else if (e.key === 'ArrowDown' && start === p.text.length && end === start && at < points.length - 1) {
      e.preventDefault();
      setCaret({ id: points[at + 1].id, at: 0 });
    }
  };

  /* Die Wähler der Treść, auf den Punkt gerichtet, in dem der Cursor steht (sonst: ans Ende). */
  const selection = (): string => {
    const el = focused === null ? undefined : areas.current.get(focused);
    return el === undefined ? '' : el.value.slice(el.selectionStart, el.selectionEnd);
  };

  const cite = (key: string, locator: string) => {
    const mark = locator === '' ? `[@${key}]` : `[@${key}, ${locator}]`;
    const p = index < 0 ? undefined : points[index];
    if (p === undefined) { insertAt(points.length, [{ text: mark, depth: 0, kind: 'thought', note: '' }]); return; }
    const el = areas.current.get(p.id);
    const at = el?.selectionEnd ?? p.text.length;
    const before = p.text.slice(0, at).replace(/\s+$/, '');
    const textNext = `${before}${before === '' ? '' : ' '}${mark}${p.text.slice(at)}`;
    update(p.id, { text: textNext });
    setCaret({ id: p.id, at: before.length + mark.length + (before === '' ? 0 : 1) });
  };

  const embed = (key: string, replaceSelection: boolean) => {
    const p = index < 0 ? undefined : points[index];
    if (p !== undefined && replaceSelection && selection().trim() === p.text.trim()) {
      update(p.id, { text: `![@${key}]`, kind: 'quote' });
      return;
    }
    const depth = p === undefined ? 0 : (Math.min(2, p.depth + (p.depth === 0 ? 1 : 0)) as 0 | 1 | 2);
    insertAt(p === undefined ? points.length : index + 1, [{ text: `![@${key}]`, depth, kind: 'quote', note: '' }]);
  };

  const pasted = planFromText(paste);

  return (
    <div className="lib-plan-edit">
      {!readOnly && (
        <div className="lib-tools" role="toolbar" aria-label="Wstawianie do planu">
          <button type="button" className={picker === 'cite' ? 'is-on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => setPicker(picker === 'cite' ? null : 'cite')}>Źródło…</button>
          <button type="button" className={picker === 'embed' ? 'is-on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => setPicker(picker === 'embed' ? null : 'embed')}>Cytat z biblioteki…</button>
          {index >= 0 && (
            <>
              <button type="button" title="Wyżej w hierarchii (Shift+Tab)" aria-label="Poziom wyżej" onMouseDown={(e) => e.preventDefault()} onClick={() => shift(index, -1)}>←</button>
              <button type="button" title="Głębiej (Tab)" aria-label="Poziom głębiej" onMouseDown={(e) => e.preventDefault()} onClick={() => shift(index, 1)}>→</button>
              <button type="button" title="Przesuń w górę (Alt+↑)" aria-label="Przesuń w górę" onMouseDown={(e) => e.preventDefault()} onClick={() => move(index, -1)}>↑</button>
              <button type="button" title="Przesuń w dół (Alt+↓)" aria-label="Przesuń w dół" onMouseDown={(e) => e.preventDefault()} onClick={() => move(index, 1)}>↓</button>
              <button type="button" title="Notatka dla siebie (prywatna)" onMouseDown={(e) => e.preventDefault()} onClick={() => setNoted(new Set([...noted, points[index].id]))}>Notatka</button>
              <button type="button" title="Usuń punkt" aria-label="Usuń punkt" onMouseDown={(e) => e.preventDefault()} onClick={() => remove(index)}>×</button>
            </>
          )}
        </div>
      )}
      {picker !== null && (
        <CitePicker
          store={store} mode={picker} selection={selection()}
          onClose={() => setPicker(null)}
          onCite={(key, locator) => { cite(key, locator); setPicker(null); }}
          onEmbed={(key, replace) => { embed(key, replace); setPicker(null); }}
        />
      )}

      {points.length === 0 ? (
        <div className="lib-plan-empty">
          <p>Plan to główne myśli po kolei, a pod każdą — cytaty, przykłady, pytania, zastosowania. Z niego mówisz; na stronie słuchacz widzi drogę kazania, a każde wygłoszenie pokazuje, co z niej padło.</p>
          {!readOnly && <button type="button" className="wk-btn" onClick={() => insertAt(0, [{ text: '', depth: 0, kind: 'thought', note: '' }])}>+ Pierwsza myśl</button>}
        </div>
      ) : (
        <ol className="lib-plan-edit-list">
          {points.map((p, at) => {
            const quote = embedOf(p.text);
            const quoteEntry = quote === null ? undefined : store.byKey(quote);
            return (
              <li key={p.id} className={`lib-plan-edit-row is-d${p.depth}${focused === p.id ? ' is-focus' : ''}`}>
                <span className="lib-point-no">{numbers.get(p.id)}</span>
                <select className="lib-plan-kind" value={p.kind} disabled={readOnly} aria-label="Rodzaj punktu" onChange={(e) => update(p.id, { kind: e.target.value as PlanPoint['kind'] })}>
                  {POINT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <div className="lib-plan-edit-body">
                  <PointText
                    point={p} readOnly={readOnly}
                    register={(el) => { if (el === null) areas.current.delete(p.id); else areas.current.set(p.id, el); }}
                    onFocus={() => setFocused(p.id)}
                    onChange={(value) => update(p.id, { text: value })}
                    onKey={(e) => onKey(e, at)}
                  />
                  {quoteEntry !== undefined && quoteEntry.kind === 'quote' && <QuoteFigure entry={quoteEntry} look={store} full={false} />}
                  {quote !== null && quoteEntry === undefined && <p className="lib-missing">Nie ma w bibliotece cytatu „{quote}”.</p>}
                  {(p.note !== '' || noted.has(p.id)) && (
                    <label className="lib-plan-note">
                      <span>Notatka (prywatna)</span>
                      <input value={p.note} disabled={readOnly} placeholder="np. tu pauza; krótko" onChange={(e) => update(p.id, { note: e.target.value })} />
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!readOnly && points.length > 0 && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => insertAt(points.length, [{ text: '', depth: 0, kind: 'thought', note: '' }])}>+ Myśl</button>
          <span className="lib-plan-keys">Enter — nowy punkt · Tab / Shift+Tab — głębiej / wyżej · Alt+↑↓ — przesuń · Esc — wyjdź z punktu</span>
        </div>
      )}

      {!readOnly && (
        <details className="wk-fold" open={points.length === 0}>
          <summary>Wklej gotowy plan</summary>
          <textarea className="lib-plan-paste" rows={6} value={paste} placeholder={'1. Pierwsza myśl\n   a) przykład\n   > cytat\n2. Druga myśl\n   - pytanie?'} onChange={(e) => setPaste(e.target.value)} />
          {pasted.length > 0 && (
            <div className="wk-actions">
              <button type="button" className="wk-btn" onClick={() => { insertAt(index < 0 ? points.length : index + 1, pasted.map((p) => ({ ...p, note: '' }))); setPaste(''); }}>
                Dodaj {pasted.length} {pasted.length === 1 ? 'punkt' : pasted.length < 5 ? 'punkty' : 'punktów'}
              </button>
            </div>
          )}
        </details>
      )}

      {!readOnly && str(data, 'body').trim() !== '' && (
        <JsonPanel
          summary="Plan z treści — przez AI we własnym czacie"
          lead={<>Skopiuj polecenie (z treścią tekstu), wklej je w swoim czacie, a odpowiedź — JSON — wklej tutaj. Plan trafi do tego formularza{points.length > 0 ? ' i zastąpi obecny' : ''}.</>}
          fileName={`plan-${text.key ?? text.id.slice(0, 8)}.json`}
          exportDoc={() => exportLibrary('plan', [{ ...text, data: { plan: points.map(pointData) } }])}
          description={() => planPrompt(text)}
          preview={(doc) => {
            const found = patchFromDoc(doc, { id: text.id, kind: 'text' }, store);
            if ('error' in found) return found;
            const plan = planOf({ plan: found.patch.plan });
            return plan.length === 0 ? { error: 'W odpowiedzi nie ma planu ("plan").' } : { lines: [`Plan: ${plan.length} punktów, ${plan.filter((p) => p.depth === 0).length} głównych myśli.`], warnings: found.warnings };
          }}
          importLabel="Wpisz plan do formularza"
          onImport={async (doc) => {
            const found = patchFromDoc(doc, { id: text.id, kind: 'text' }, store);
            if ('error' in found) throw new Error(found.error);
            set({ plan: found.patch.plan ?? [] });
            return { lines: ['Plan jest w formularzu — zapisze się sam.'], warnings: found.warnings };
          }}
        />
      )}
    </div>
  );
}
