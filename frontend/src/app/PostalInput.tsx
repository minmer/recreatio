/**
 * EINE ADRESSE EINGEBEN (0071) — in Teilen, mit Vorschlägen.
 *
 * Oben eine Zeile, in die man die Adresse so schreibt oder einfügt, wie man
 * sie kennt („ul. Długa 5/3, 31-147 Kraków"); darunter die Teile, in die sie
 * zerlegt wurde — jeder einzeln berichtigbar, jeder mit Vorschlägen aus dem
 * gemeinsamen Verzeichnis (Straßen eines Ortes, Orte, Postleitzahlen).
 *
 * <b>Gespeichert wird die Zeile</b> (`value`/`onChange`) — so, wie die
 * Adresse bisher stand (in einem Formular, im Steckbrief). Die Teile entstehen
 * aus ihr und schreiben sie neu; `onParts` gibt sie zusätzlich heraus, wo sie
 * gebraucht werden (das Verzeichnis eines Gebiets).
 */

import { useEffect, useId, useMemo, useState } from 'react';

import {
  complete, display, EMPTY_ADDRESS, formatAddress, isEmpty, parseAddress, PART_LABEL, suggestParts,
  type Address, type PartKind, type PartRow
} from './postal';

const SUGGESTED: readonly PartKind[] = ['street', 'locality', 'postcode', 'post', 'district'];

export function PostalInput({ value, onChange, onParts, parts: given, compact = false }: {
  /** Die Adresse als Zeile. */
  value?: string;
  onChange?: (line: string) => void;
  /** Die Teile — wo nicht eine Zeile, sondern die Teile gebraucht werden. */
  parts?: Address;
  onParts?: (parts: Address) => void;
  /** Ohne Zeile oben — nur die Teile (im Verzeichnis). */
  compact?: boolean;
}) {
  const [parts, setParts] = useState<Address>(() => given ?? (value ? parseAddress(value) : EMPTY_ADDRESS));
  const [line, setLine] = useState(value ?? '');
  const [open, setOpen] = useState(() => compact || (value ?? '') !== '');

  /* Von aussen geändert (ein anderer Mensch gewählt, die Antwort neu geladen): neu zerlegen. */
  useEffect(() => {
    if (given !== undefined) { setParts(given); return; }
    if (value === undefined || value === formatAddress(parts) || value === line) return;
    setLine(value);
    setParts(parseAddress(value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, given]);

  const commit = (next: Address) => {
    setParts(next);
    const formatted = isEmpty(next) ? '' : formatAddress(next);
    setLine(formatted);
    onChange?.(formatted);
    onParts?.(next);
  };

  return (
    <div className="wk-postal">
      {!compact && (
        <div className="wk-postal-line">
          <input value={line} placeholder="np. ul. Długa 5/3, 31-147 Kraków" autoComplete="street-address"
            onChange={(e) => { setLine(e.target.value); onChange?.(e.target.value); }}
            onBlur={() => { if (line.trim() !== '') { const p = parseAddress(line); setParts(p); setOpen(true); onParts?.(p); } }} />
          <button type="button" className="wk-link-btn" onClick={() => {
            if (!open && line.trim() !== '') { const p = parseAddress(line); setParts(p); onParts?.(p); }
            setOpen((was) => !was);
          }}>{open ? 'Ukryj części' : 'Części adresu'}</button>
        </div>
      )}

      {open && (
        <div className="wk-postal-parts">
          {(['street', 'house', 'unit', 'locality', 'district', 'postcode', 'post'] as const).map((key) => (
            <PartField key={key} kind={key} value={parts[key]} parentHint={key === 'street' || key === 'district' ? complete(parts).locality : ''}
              onChange={(v) => commit({ ...parts, [key]: v })} />
          ))}
          {parts.street !== '' && parts.locality === '' && parts.post === '' && (
            <span className="wk-hint wk-postal-tip">Brak miejscowości — podaj ją albo pocztę, żeby ulicę dało się odróżnić od innych o tej samej nazwie.</span>
          )}
          {parts.street !== '' && (
            <button type="button" className="wk-link-btn wk-postal-tip" onClick={() => commit({ ...parts, locality: parts.street, street: '' })}>
              „{parts.street}" to miejscowość, nie ulica
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Ein Teil — mit Vorschlägen, wo es ein Verzeichnis dafür gibt. */
function PartField({ kind, value, parentHint, onChange }: {
  kind: keyof Address; value: string; parentHint: string; onChange: (v: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [hints, setHints] = useState<readonly PartRow[]>([]);
  const suggests = (SUGGESTED as readonly string[]).includes(kind);

  useEffect(() => { setDraft(value); }, [value]);

  /* Vorschläge — erst ab zwei Zeichen, und nicht bei jedem Tastendruck. */
  useEffect(() => {
    if (!suggests || draft.trim().length < 2 || draft === value) { setHints([]); return undefined; }
    const timer = window.setTimeout(() => {
      void suggestParts(kind as PartKind, draft).then((r) => setHints(r.parts)).catch(() => setHints([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, kind, suggests, value]);

  const options = useMemo(() => [...new Set(hints.map((h) => h.name))].slice(0, 10), [hints]);
  const wide = kind === 'street' || kind === 'locality' || kind === 'post' || kind === 'district';

  return (
    <label className={`wk-field wk-postal-${kind}${wide ? '' : ' is-short'}`}>
      <span>{PART_LABEL[kind]}</span>
      <input value={draft} list={suggests ? id : undefined} inputMode={kind === 'postcode' ? 'numeric' : undefined}
        placeholder={kind === 'postcode' ? '00-000' : kind === 'street' && parentHint !== '' ? `ulica w: ${parentHint}` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { const shown = kind === 'postcode' || kind === 'house' || kind === 'unit' || kind === 'street' ? display(kind, draft) : draft.trim(); if (shown !== value) onChange(shown); }} />
      {suggests && <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
    </label>
  );
}

export default PostalInput;
