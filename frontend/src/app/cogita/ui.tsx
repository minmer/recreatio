/**
 * COGITA — was alle Ansichten teilen: der Zusammenhang (welche Bibliothek, wer
 * liest, woher die Schlüssel), das Wählen eines Eintrags, die Auszeichnung des
 * Wissens, Dateien, Bedingungen und Aktionen der einen Logik.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { Me } from '../core/me';
import { Icon } from '../ui/icons';
import type { LibraryStore } from '../library/libraryStore';
import type { Who } from '../core/session';
import { fileUrl } from './files';
import { CONDITION_LABEL, CONDITION_TYPES, COMPARE_LABEL, COMPARE_OPS, conditionText, readCondition, type Action, type CompareOp, type Condition, type ConditionType } from './logic';
import { runPython } from './python';
import { viewPath } from '../routes';
import type { PublicEntity } from './publish';
import type { SourceState } from './sources';
import { patternKeys, type Entity, type MediaRef } from './schema';
import { CogitaLibrary, lineOf, type Origin } from './store';
import './cogita.css';

/* -- Der Zusammenhang -------------------------------------------------------------------- */

export interface CogitaCtx {
  readonly lib: CogitaLibrary;
  readonly name: string;
  /** Darf hier geschrieben werden (Autoren) — sonst sieht man die Werkzeuge nicht [L2]. */
  readonly writes: boolean;
  /** Der Schlüssel einer Epoche des Bereichs — gleich, auf welchem Weg dieser Browser ihn hat. */
  readonly keyOf: (epoch: number) => Promise<Uint8Array | undefined>;
  /** 0110 — der Schlüssel einer Epoche eines ANDEREN Bereichs: die Dateien einer Quelle liegen unter ihrem. */
  readonly keyIn: (areaId: string, epoch: number) => Promise<Uint8Array | undefined>;
  /** 0110 — die Quellen: was nicht lesbar ist, und ob noch geladen wird. */
  readonly sources?: SourceState;
  /** Ein Platz, über den gelesen wird (ein Mensch ohne Konto). */
  readonly seat?: string;
  readonly me: Me | null;
  readonly who: Who | null;
  /** Der Weg zu einer Ansicht dieser Bibliothek (`#/workspace/library/<id>/cogita/...`). */
  readonly href: (...tail: readonly string[]) => string;
}

export const CogitaContext = createContext<CogitaCtx | null>(null);

/**
 * 0109 — AUF EINER ÖFFENTLICHEN SEITE gibt es keinen Schlüssel: die Dateien
 * kommen in ihrer offenen Fassung, die Erklärungen aus dem Bündel. Wer ein
 * Bündel zeigt (`parts/cogita.tsx`), stellt beides hierher; Karte, Urteil und
 * Bild fragen hier, bevor sie nach Schlüsseln fragen.
 */
export interface PublicCtx {
  /** `library`: wo die Datei liegt (0110 — eine Quelle); fehlt: die des Bündels. */
  readonly fileUrl: (fileId: string, library?: string) => string;
  readonly entity: (id: string) => PublicEntity | null;
}

export const PublicContext = createContext<PublicCtx | null>(null);

export function useCtx(): CogitaCtx {
  const ctx = useContext(CogitaContext);
  if (ctx === null) throw new Error('Cogita poza swoją biblioteką.');
  return ctx;
}

/** Eine Bibliothek als Kurs — und neu gezeichnet, wenn sich ihr Speicher ändert. */
export function useCogita(store: LibraryStore | null, writes: boolean): CogitaLibrary | null {
  const lib = useMemo(() => {
    if (store === null) return null;
    const made = new CogitaLibrary(store, writes);
    made.python = runPython;
    return made;
  }, [store, writes]);
  const [, setTick] = useState(0);
  useEffect(() => (lib === null ? undefined : lib.store.subscribe(() => setTick((n) => n + 1))), [lib]);
  return lib;
}

/** Ein Versprechen in einem Bild: `undefined` solange es läuft, `null` bei Fehler. */
export function useAsync<T>(make: (() => Promise<T>) | null, deps: readonly unknown[]): T | null | undefined {
  const [value, setValue] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (make === null) { setValue(undefined); return undefined; }
    let alive = true;
    setValue(undefined);
    make().then((v) => { if (alive) setValue(v); }, () => { if (alive) setValue(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Ein Knopf, der etwas tut und solange wartet. */
export function useBusy(): { busy: boolean; failed: string | null; run: (todo: () => Promise<unknown>) => Promise<void>; setFailed: (s: string | null) => void } {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); } catch (e) { setFailed(e instanceof Error && e.message !== '' ? e.message : 'Nie udało się.'); } finally { setBusy(false); }
  };
  return { busy, failed, run, setFailed };
}

/* -- Einträge wählen --------------------------------------------------------------------- */

/*
  2026-10-17 — EINE AUSWAHL MIT PFEIL UND „UTWÓRZ". Vorher war das Wählen nur
  ein Suchfeld, und einen fehlenden Eintrag (ein neues Thema) legte ein Verweis
  darunter an — den die offene Liste verdeckte. Jetzt öffnet der Pfeil die
  Liste ohne Tippen, Pfeiltasten und Enter wählen, und wo ein Eintrag fehlt,
  steht am Ende der Liste „+ Utwórz „…"" (wer `onCreate` gibt).
*/
export function EntityPicker({ lib, kinds, value, onPick, placeholder, allowClear = true, refs = false, onCreate, createLabel }: {
  lib: CogitaLibrary;
  kinds?: readonly string[];
  value: string | null;
  onPick: (id: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  /** 0110 — auch das, worauf man nur verweist (die Bücher der Bibliotheken): für ein Verweisfeld. */
  refs?: boolean;
  /** Einen fehlenden Eintrag mit diesem Namen anlegen — gibt seine Kennung (`creatorFor`). */
  onCreate?: (text: string) => Promise<string | null>;
  /** Wie der Rodzaj heisst, der angelegt würde. */
  createLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const chosen = value === null ? undefined : lib.entity(value);
  const found = useMemo(() => (open ? lib.search(query, kinds && kinds.length > 0 ? kinds : undefined, refs).slice(0, 50) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib, lib.revision, query, open, kinds?.join(','), refs]);
  const wanted = query.trim();
  const creatable = onCreate !== undefined && wanted !== '' && !found.some((e) => lib.label(e).trim().toLowerCase() === wanted.toLowerCase());
  const count = found.length + (creatable ? 1 : 0);
  const close = () => { setOpen(false); setQuery(''); setAt(0); };
  const pick = (id: string) => { onPick(id); close(); };
  const create = async () => {
    if (onCreate === undefined || busy) return;
    setBusy(true);
    try {
      const id = await onCreate(wanted);
      if (id !== null) pick(id);
    } finally {
      setBusy(false);
    }
  };
  const choose = (i: number) => { if (i < found.length) pick(found[i].id); else if (creatable) void create(); };
  const reopen = () => { setOpen(true); setQuery(''); setAt(0); window.requestAnimationFrame(() => field.current?.focus()); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setAt((i) => Math.min(count - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && open && count > 0) { e.preventDefault(); e.stopPropagation(); choose(Math.min(at, count - 1)); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); close(); }
  };

  if (chosen !== undefined && !open) {
    return (
      <span className="cg-pick-chosen">
        <button type="button" className="cg-pick-value" aria-haspopup="listbox" title="Zmień" onClick={reopen}>
          <span>{lineOf(lib, chosen)}</span>
          <Icon name="chevron" />
        </button>
        {allowClear && <button type="button" className="wk-link-btn" aria-label="Usuń wybór" onClick={() => onPick(null)}>×</button>}
      </span>
    );
  }
  return (
    <span className="cg-pick" ref={box} onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node | null)) close(); }}>
      <span className="cg-pick-field">
        <input ref={field} value={query} placeholder={placeholder ?? 'Szukaj wpisu…'} role="combobox" aria-expanded={open} aria-autocomplete="list"
          onFocus={() => setOpen(true)} onKeyDown={onKey} onChange={(e) => { setQuery(e.target.value); setOpen(true); setAt(0); }} />
        <button type="button" className="cg-pick-arrow" tabIndex={-1} aria-label={open ? 'Zamknij listę' : 'Pokaż listę'}
          onMouseDown={(e) => e.preventDefault()} onClick={() => { if (open) close(); else reopen(); }}>
          <Icon name="chevron" />
        </button>
      </span>
      {open && (
        <span className="cg-pick-list" role="listbox">
          {found.map((e, i) => (
            <button key={e.id} type="button" role="option" aria-selected={i === at} className={i === at ? 'is-on' : undefined}
              onMouseDown={(ev) => ev.preventDefault()} onMouseEnter={() => setAt(i)} onClick={() => pick(e.id)}>
              <span className="cg-kind-tag">{lib.kind(e.kinds[0] ?? '')?.name ?? ''}</span> {lineOf(lib, e)}{!lib.isOwn(e.id) && <span className="cg-muted"> · {lib.origin(e.id)?.name}</span>}
            </button>
          ))}
          {found.length === 0 && !creatable && <span className="cg-muted cg-pick-none">{onCreate === undefined || wanted !== '' ? 'Nic nie pasuje.' : 'Nic tu jeszcze nie ma — wpisz nazwę, żeby utworzyć.'}</span>}
          {creatable && (
            <button type="button" role="option" aria-selected={at === found.length} className={`cg-pick-new${at === found.length ? ' is-on' : ''}`} disabled={busy}
              onMouseDown={(ev) => ev.preventDefault()} onMouseEnter={() => setAt(found.length)} onClick={() => void create()}>
              {busy ? 'Tworzenie…' : <>+ Utwórz „{wanted}”{createLabel === undefined ? '' : ` — ${createLabel}`}</>}
            </button>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * „+ Utwórz" für eine Auswahl: ein neuer Eintrag des EINEN Rodzaj, den sie
 * zulässt, mit dem Namen im Feld seines Etiketts. Nichts, wo das nicht geht
 * (mehrere Rodzaje, ein Buch der Bibliothek, wer nur liest).
 */
export function creatorFor(lib: CogitaLibrary, kinds: readonly string[] | undefined, writes: boolean): { onCreate?: (text: string) => Promise<string | null>; createLabel?: string } {
  if (!writes || kinds === undefined || kinds.length !== 1) return {};
  const kind = lib.kinds.find((k) => k.id === kinds[0]);
  if (kind === undefined) return {};
  const keys = patternKeys(kind.label);
  const field = kind.fields.find((f) => keys.includes(f.key) && (f.type === 'line' || f.type === 'text')) ?? kind.fields.find((f) => f.type === 'line');
  if (field === undefined) return {};
  return {
    createLabel: kind.name,
    onCreate: async (text) => (await lib.saveEntity({ kinds: [kind.id], data: { [field.key]: text } })).id
  };
}

/* -- 0110: was aus einer Quelle kommt -------------------------------------------------------- */

/** Der Weg zu einem Eintrag dort, wo er hingehört: in seiner Baza wiedzy (ihr Reiter) oder in seiner Bibliothek. */
export const originPath = (origin: Origin, id: string, tab: string): string =>
  origin.kind === 'books' ? viewPath('library', origin.libraryId, id) : viewPath('learn', origin.libraryId, tab, id);

/** Ein Schildchen, woher ein Eintrag kommt — nichts, wenn er hierher gehört. */
export function OriginTag({ id }: { id: string }) {
  const { lib } = useCtx();
  const from = lib.origin(id);
  if (from === undefined || from.own) return null;
  return <span className="cg-tag" title={from.kind === 'books' ? 'z biblioteki — tylko do odwołań' : 'z innej bazy wiedzy — tu tylko do odczytu'}>{from.name}</span>;
}

/**
 * WAS AUS EINER QUELLE KOMMT, gilt hier und wird dort geändert: darunter ist
 * nichts beschreibbar (`writes: false`), oben steht, woher es ist — mit dem
 * Weg dorthin.
 */
export function ForeignOnly({ id, tab, children }: { id: string | null; tab: string; children: ReactNode }) {
  const ctx = useCtx();
  const from = id === null ? undefined : ctx.lib.origin(id);
  if (id === null || from === undefined || from.own) return <>{children}</>;
  return (
    <CogitaContext.Provider value={{ ...ctx, writes: false }}>
      <p className="wk-note">Z „{from.name}” — tu tylko do odczytu. <a href={originPath(from, id, tab)}>Zmień tam</a></p>
      {children}
    </CogitaContext.Provider>
  );
}

export function KindSelect({ lib, value, onChange, empty }: { lib: CogitaLibrary; value: string; onChange: (id: string) => void; empty?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
    </select>
  );
}

/* -- Auszeichnung des Wissens ------------------------------------------------------------- */

/**
 * WISSEN ZEIGEN: `[[Księgi Samuela|@samuel]]` wird ein Verweis auf den
 * Eintrag, `**fett**` und `*kursiv*` bleiben, `[@klucz, s. 23]` wird eine
 * kleine Quellenangabe, `^[…]` eine Fussnote am Ende.
 */
export function Markup({ text, onEntity, resolve }: { text: string; onEntity?: (id: string) => void; resolve?: (token: string) => string | undefined }) {
  const notes: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  const inline = (chunk: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const pattern = /\[\[([^\]|]+)\|@([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|\[@([^\]]+)\]|\^\[([^\]]+)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = pattern.exec(chunk)) !== null) {
      if (m.index > last) out.push(chunk.slice(last, m.index));
      const k = `${key}-${i++}`;
      if (m[1] !== undefined) {
        const id = resolve?.(m[2].trim()) ?? m[2].trim();
        out.push(onEntity === undefined ? <span key={k} className="cg-ref">{m[1]}</span>
          : <button key={k} type="button" className="cg-ref" onClick={() => onEntity(id)}>{m[1]}</button>);
      } else if (m[3] !== undefined) out.push(<strong key={k}>{m[3]}</strong>);
      else if (m[4] !== undefined) out.push(<em key={k}>{m[4]}</em>);
      else if (m[5] !== undefined) out.push(<cite key={k} className="cg-cite">[{m[5]}]</cite>);
      else if (m[6] !== undefined) { notes.push(m[6]); out.push(<sup key={k}>{notes.length}</sup>); }
      last = pattern.lastIndex;
    }
    if (last < chunk.length) out.push(chunk.slice(last));
    return out;
  };
  return (
    <div className="cg-markup">
      {paragraphs.map((p, n) => {
        const heading = /^#{1,3}\s+(.*)$/.exec(p.trim());
        if (heading !== null) return <h3 key={n}>{inline(heading[1], `h${n}`)}</h3>;
        return <p key={n}>{p.split('\n').flatMap((line, j) => (j === 0 ? inline(line, `p${n}-${j}`) : [<br key={`b${n}-${j}`} />, ...inline(line, `p${n}-${j}`)]))}</p>;
      })}
      {notes.length > 0 && <ol className="cg-notes">{notes.map((n, i) => <li key={i}>{n}</li>)}</ol>}
    </div>
  );
}

/* -- Dateien ------------------------------------------------------------------------------ */

export function MediaView({ media, publicUrl: given }: { media: MediaRef; publicUrl?: string }) {
  const ctx = useContext(CogitaContext);
  const shown = useContext(PublicContext);
  const publicUrl = given ?? (ctx === null ? shown?.fileUrl(media.file, media.library) : undefined);
  /* 0110 — die Datei liegt dort, woher ihr Eintrag kommt, unter dem Schlüssel jenes Bereichs. */
  const owner = media.library ?? ctx?.lib.libraryId ?? '';
  const url = useAsync(publicUrl !== undefined ? () => Promise.resolve(publicUrl)
    : ctx === null ? null : () => {
      const area = ctx.lib.areaOf(owner) ?? ctx.lib.areaId;
      return fileUrl(owner, media, area === ctx.lib.areaId ? ctx.keyOf : (epoch) => ctx.keyIn(area, epoch), ctx.seat);
    }, [media.file, owner, publicUrl]);
  if (url === undefined) return <span className="wk-hint">Otwieranie pliku…</span>;
  if (url === null) return <span className="wk-hint">Pliku nie da się otworzyć.</span>;
  if (media.type === 'image') return <img className="cg-media" src={url} alt={media.name ?? ''} />;
  if (media.type === 'audio') return <audio className="cg-media" src={url} controls preload="metadata" />;
  if (media.type === 'video') return <video className="cg-media" src={url} controls preload="metadata" />;
  return <a className="wk-link-btn" href={url} download={media.name ?? 'plik'}>Pobierz: {media.name ?? 'plik'}</a>;
}

/* -- Bedingungen und Aktionen der einen Logik ------------------------------------------------ */

export function ConditionEditor({ value, onChange, name, depth = 0 }: {
  value: Condition | null;
  onChange: (next: Condition | null) => void;
  name?: (id: string) => string;
  depth?: number;
}) {
  const c = value;
  const set = (patch: Partial<Condition>) => onChange(readCondition({ ...(c ?? { type: 'value' }), ...patch }));
  if (c === null) {
    return (
      <div className="cg-cond">
        <button type="button" className="wk-link-btn" onClick={() => onChange({ type: 'value', value: '', op: 'ge', than: 1 })}>+ warunek</button>
      </div>
    );
  }
  const gate = c.type === 'and' || c.type === 'or' || c.type === 'xor' || c.type === 'not';
  return (
    <div className={`cg-cond cg-cond-d${Math.min(depth, 3)}`}>
      <div className="cg-cond-row">
        <select value={c.type} onChange={(e) => {
          const type = e.target.value as ConditionType;
          onChange(readCondition(type === 'and' || type === 'or' || type === 'xor' || type === 'not' ? { type, items: c.items ?? (gate ? [] : [c]) } : { type }));
        }}>
          {CONDITION_TYPES.map((t) => <option key={t} value={t}>{CONDITION_LABEL[t]}</option>)}
        </select>
        {(c.type === 'value' || c.type === 'knowness') && (
          <>
            {c.type === 'value'
              ? <input value={c.value ?? ''} placeholder="nazwa wartości" onChange={(e) => set({ value: e.target.value })} />
              : <input value={c.of ?? ''} placeholder="wpis, temat albo karta" onChange={(e) => set({ of: e.target.value })} />}
            <select value={c.op ?? 'ge'} onChange={(e) => set({ op: e.target.value as CompareOp })}>
              {COMPARE_OPS.filter((o) => o !== 'contains' && o !== 'filled' && o !== 'empty').map((o) => <option key={o} value={o}>{COMPARE_LABEL[o]}</option>)}
            </select>
            <input type="number" step="any" value={c.than ?? ''} onChange={(e) => set({ than: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </>
        )}
        {(c.type === 'answered' || c.type === 'visited' || c.type === 'zone') && (
          <>
            <input value={c.of ?? ''} placeholder={c.type === 'answered' ? 'pytanie' : c.type === 'visited' ? 'krok' : 'strefa'} onChange={(e) => set({ of: e.target.value })} />
            {c.type === 'answered' && (
              <select value={c.correct === undefined ? '' : c.correct ? 'yes' : 'no'} onChange={(e) => set({ correct: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
                <option value="">jakkolwiek</option><option value="yes">dobrze</option><option value="no">źle</option>
              </select>
            )}
          </>
        )}
        {c.type === 'time' && (
          <>
            <input type="date" value={c.after ?? ''} onChange={(e) => set({ after: e.target.value || undefined })} aria-label="od dnia" />
            <input type="date" value={c.before ?? ''} onChange={(e) => set({ before: e.target.value || undefined })} aria-label="do dnia" />
            <input type="time" value={c.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} aria-label="od godziny" />
            <input type="time" value={c.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} aria-label="do godziny" />
          </>
        )}
        {c.type === 'place' && (
          <>
            <input type="number" step="any" placeholder="szer." value={c.lat ?? ''} onChange={(e) => set({ lat: Number(e.target.value) })} />
            <input type="number" step="any" placeholder="dł." value={c.lon ?? ''} onChange={(e) => set({ lon: Number(e.target.value) })} />
            <input type="number" placeholder="m" value={c.radius ?? 50} onChange={(e) => set({ radius: Number(e.target.value) })} />
          </>
        )}
        {depth === 0 && <button type="button" className="wk-link-btn" onClick={() => onChange(null)}>usuń</button>}
      </div>
      {gate && (
        <div className="cg-cond-items">
          {(c.items ?? []).map((item, i) => (
            <div key={i} className="cg-cond-item">
              <ConditionEditor value={item} depth={depth + 1} name={name} onChange={(next) => {
                const items = [...(c.items ?? [])];
                if (next === null) items.splice(i, 1); else items[i] = next;
                onChange({ ...c, items });
              }} />
              <button type="button" className="wk-link-btn" onClick={() => onChange({ ...c, items: (c.items ?? []).filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          {(c.type !== 'not' || (c.items ?? []).length === 0) && (
            <button type="button" className="wk-link-btn" onClick={() => onChange({ ...c, items: [...(c.items ?? []), { type: 'value', value: '', op: 'ge', than: 1 }] })}>+ część</button>
          )}
        </div>
      )}
      {depth === 0 && <p className="wk-hint">{conditionText(c, name)}</p>}
    </div>
  );
}

export function ActionsEditor({ value, onChange, steps }: { value: readonly Action[]; onChange: (next: Action[]) => void; steps?: readonly { id: string; label: string }[] }) {
  const set = (i: number, patch: Partial<Action>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="cg-actions">
      {value.map((a, i) => (
        <div key={i} className="cg-cond-row">
          <select value={a.type} onChange={(e) => set(i, { type: e.target.value as Action['type'] })}>
            <option value="add">dodaj do wartości</option>
            <option value="set">ustaw wartość</option>
            <option value="go">przejdź do kroku</option>
          </select>
          {a.type !== 'go' && <input value={a.value ?? ''} placeholder="nazwa wartości" onChange={(e) => set(i, { value: e.target.value })} />}
          {a.type === 'add' && <input type="number" step="any" value={a.by ?? 1} onChange={(e) => set(i, { by: Number(e.target.value) })} />}
          {a.type === 'set' && <input type="number" step="any" value={a.to ?? 0} onChange={(e) => set(i, { to: Number(e.target.value) })} />}
          {a.type === 'go' && (steps === undefined
            ? <input value={a.step ?? ''} placeholder="krok" onChange={(e) => set(i, { step: e.target.value })} />
            : <select value={a.step ?? ''} onChange={(e) => set(i, { step: e.target.value })}><option value="">—</option>{steps.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>)}
          <button type="button" className="wk-link-btn" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="wk-link-btn" onClick={() => onChange([...value, { type: 'add', value: '', by: 1 }])}>+ działanie</button>
    </div>
  );
}

/* -- Kleinigkeiten ------------------------------------------------------------------------- */

export const percent = (x: number): string => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;

export function Bar({ value, label }: { value: number; label?: string }) {
  return (
    <span className="cg-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <span style={{ width: percent(value) }} />
    </span>
  );
}

export const entityName = (lib: CogitaLibrary, id: string): string => {
  const e: Entity | undefined = lib.entity(id);
  return e === undefined ? id.slice(-6) : lib.label(e);
};
