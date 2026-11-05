/**
 * COGITA — was alle Ansichten teilen: der Zusammenhang (welche Bibliothek, wer
 * liest, woher die Schlüssel), das Wählen eines Eintrags, die Auszeichnung des
 * Wissens, Dateien, Bedingungen und Aktionen der einen Logik.
 */

import { createContext, lazy, Suspense, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { Me } from '../core/me';
import { t, useT } from '../core/i18n';
import { Icon } from '../ui/icons';
import type { LibraryStore } from '../library/libraryStore';
import type { LibEntry, Lookup as MarkupLookup } from '../library/libraryKinds';
import { parseMarkup } from '../library/libraryMarkup';
import { Blocks, countNotes, MarkupLinks, NoteList, type MarkupLinkTo } from '../library/markupView';
import { TexText } from '../ui/tex/Tex';
import type { Who } from '../core/session';
import { fileUrl } from './files';
import { CONDITION_LABEL, CONDITION_TYPES, COMPARE_LABEL, COMPARE_OPS, conditionText, FLOW_CHECK_LABEL, FLOW_CHECKS, KNOWNESS_BAND_LABEL, KNOWNESS_BANDS, readCondition, RELATION_LABEL, RELATIONS, type Action, type CompareOp, type Condition, type ConditionType, type FlowCheck, type KnownessBand } from './logic';
import type { Learner } from './learn';
import type { LearnerLoading } from './holders';
import { runPython } from './python';
import { viewPath } from '../routes';
import { cogitaPath } from './parts';
import type { SourceState } from './sources';
import { patternKeys, type Entity, type MediaRef } from './schema';
import { BOOK_KINDS, CogitaLibrary, lineOf, type Origin } from './store';
import { repairTitleSignsOnce } from './titleSigns';
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
  /** 2026-10-30 — wer hier lernt (das eigene Konto): seine Kenntnis sehen Widoki mit „Filtr znajomości" und Spalten der Kenntnis. */
  readonly learner?: Learner | null;
  /** 2026-11-05 — solange dessen Fortschritte laden: wie weit (der Krajobraz zeigt einen Kreis und wartet). */
  readonly learnerLoading?: LearnerLoading | null;
  /** Der Weg zu einer Ansicht dieser Bibliothek (`#/workspace/library/<id>/cogita/...`). */
  readonly href: (...tail: readonly string[]) => string;
}

export const CogitaContext = createContext<CogitaCtx | null>(null);

export function useCtx(): CogitaCtx {
  const ctx = useContext(CogitaContext);
  if (ctx === null) throw new Error(t('cogitaViews.ui.noContext'));
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
  /* 2026-11-04 (Prompt 15) — einmal je Baza: Titel mit zurückgewonnenem Minus auch in den Abschriften für AI (`titleSigns.ts`). */
  const revision = lib?.revision ?? 0;
  useEffect(() => { if (lib !== null) repairTitleSignsOnce(lib); }, [lib, revision]);
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

/**
 * 2026-11-03 — WIE `useAsync`, ABER DAS ALTE BLEIBT STEHEN, bis das Neue da ist: rechnet es nach einer Änderung neu,
 * verschwindet nichts (ein Krajobraz, der während des Rechnens einem „Liczenie…" wich, verlor Zoom, Wahl und Bildlauf).
 * `initial`: was schon gerechnet ist (ohne Warten), etwa `lib.cardsReady()`.
 */
export function useAsyncKeep<T>(make: (() => Promise<T>) | null, deps: readonly unknown[], initial?: () => T | undefined): [T | null | undefined, boolean] {
  const [value, setValue] = useState<T | null | undefined>(() => (make === null ? undefined : initial?.()));
  /* Rechnet es gerade neu (das Alte steht noch da)? — für ein kleines Zeichen statt eines leeren Bildes. */
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (make === null) { setValue(undefined); setBusy(false); return undefined; }
    let alive = true;
    setBusy(true);
    make().then((v) => { if (alive) { setValue(v); setBusy(false); } }, () => { if (alive) { setValue((was) => was ?? null); setBusy(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [value, busy];
}

/** Ein Knopf, der etwas tut und solange wartet. */
export function useBusy(): { busy: boolean; failed: string | null; run: (todo: () => Promise<unknown>) => Promise<void>; setFailed: (s: string | null) => void } {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); } catch (e) { setFailed(e instanceof Error && e.message !== '' ? e.message : t('cogitaViews.ui.failed')); } finally { setBusy(false); }
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
  const t = useT();
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
        <button type="button" className="cg-pick-value" aria-haspopup="listbox" title={t('cogitaViews.ui.change')} onClick={reopen}>
          <span>{lineOf(lib, chosen)}</span>
          <Icon name="chevron" />
        </button>
        {allowClear && <button type="button" className="wk-link-btn" aria-label={t('cogitaViews.ui.clearChoice')} onClick={() => onPick(null)}>×</button>}
      </span>
    );
  }
  return (
    <span className="cg-pick" ref={box} onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node | null)) close(); }}>
      <span className="cg-pick-field">
        <input ref={field} value={query} placeholder={placeholder ?? t('cogitaViews.ui.searchEntry')} role="combobox" aria-expanded={open} aria-autocomplete="list"
          onFocus={() => setOpen(true)} onKeyDown={onKey} onChange={(e) => { setQuery(e.target.value); setOpen(true); setAt(0); }} />
        <button type="button" className="cg-pick-arrow" tabIndex={-1} aria-label={open ? t('cogitaViews.ui.closeList') : t('cogitaViews.ui.showList')}
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
          {found.length === 0 && !creatable && <span className="cg-muted cg-pick-none">{onCreate === undefined || wanted !== '' ? t('cogitaViews.ui.noMatch') : t('cogitaViews.ui.emptyCreate')}</span>}
          {creatable && (
            <button type="button" role="option" aria-selected={at === found.length} className={`cg-pick-new${at === found.length ? ' is-on' : ''}`} disabled={busy}
              onMouseDown={(ev) => ev.preventDefault()} onMouseEnter={() => setAt(found.length)} onClick={() => void create()}>
              {busy ? t('cogitaViews.ui.creating') : createLabel === undefined ? t('cogitaViews.ui.createNamed', { name: wanted }) : t('cogitaViews.ui.createNamedKind', { name: wanted, kind: createLabel })}
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
  origin.kind === 'books' ? viewPath('library', origin.libraryId, id)
    : origin.kind === 'writing' ? viewPath('scriptorium', origin.libraryId, id)
    : cogitaPath(origin.libraryId, tab, id);

/** Ein Schildchen, woher ein Eintrag kommt — nichts, wenn er hierher gehört. */
export function OriginTag({ id }: { id: string }) {
  const t = useT();
  const { lib } = useCtx();
  const from = lib.origin(id);
  if (from === undefined || from.own) return null;
  return <span className="cg-tag" title={from.kind === 'books' ? t('cogitaViews.ui.fromLibrary') : from.kind === 'writing' ? t('cogitaViews.ui.fromScriptorium') : t('cogitaViews.ui.fromOtherBase')}>{from.name}</span>;
}

/**
 * WAS AUS EINER QUELLE KOMMT, gilt hier und wird dort geändert: darunter ist
 * nichts beschreibbar (`writes: false`), oben steht, woher es ist — mit dem
 * Weg dorthin.
 */
export function ForeignOnly({ id, tab, children }: { id: string | null; tab: string; children: ReactNode }) {
  const t = useT();
  const ctx = useCtx();
  const from = id === null ? undefined : ctx.lib.origin(id);
  if (id === null || from === undefined || from.own) return <>{children}</>;
  return (
    <CogitaContext.Provider value={{ ...ctx, writes: false }}>
      <p className="wk-note">{t('cogitaViews.ui.foreignOnly', { name: from.name })} <a href={originPath(from, id, tab)}>{t('cogitaViews.ui.changeThere')}</a></p>
      {children}
    </CogitaContext.Provider>
  );
}

/** `material`: auch die Arten der Bibliotheken, aus denen diese Baza schöpft (2026-10-22) — für Szablony und Powtórki. */
export function KindSelect({ lib, value, onChange, empty, material = false }: { lib: CogitaLibrary; value: string; onChange: (id: string) => void; empty?: string; material?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {(material ? lib.materialKinds : lib.kinds).map((k) => <option key={k.id} value={k.id}>{kindLabel(k)}</option>)}
    </select>
  );
}

/** Wie eine Art in einer Auswahl heisst — eine der Bibliotheken mit „(z biblioteki)". */
export const kindLabel = (k: { readonly id: string; readonly name: string }): string => (BOOK_KINDS.has(k.id) ? t('cogitaViews.ui.kindFromLibrary', { name: k.name }) : k.name);

/* -- Auszeichnung des Wissens ------------------------------------------------------------- */

/*
  2026-11-05 (Prompt 24) — EIN LINK IN EINE ANDERE WELT im Zapis ([[Wort|@@historia:@…]]): `WorldLinks.tsx` (später geladen —
  sonst ein Kreis der Einfuhren); bis dahin der Wortlaut.
*/
const CrossLinkLazy = lazy(() => import('./WorldLinks').then((m) => ({ default: m.CrossLink })));
export const crossLink = (token: string, label: ReactNode): ReactNode => <Suspense fallback={<span className="lib-own-ref is-cross">{label}</span>}><CrossLinkLazy token={token} label={label} /></Suspense>;

/** Wo es nichts nachzuschlagen gibt (eine öffentliche Seite ohne Schlüssel): jeder Verweis bleibt verborgen. */
const NOTHING: MarkupLookup = { get: () => undefined, byKey: () => undefined };

/**
 * WISSEN ZEIGEN — 2026-10-22 mit demselben Leser und denselben Bausteinen wie
 * ein Text der Bibliothek (`libraryMarkup.ts`, `markupView.tsx`): Absätze,
 * `## Überschriften`, Listen, `> Zitate`, `**fett**`, `*kursiv*`,
 * `[Wort](https://…)`, `^[Fussnote]`. Ein Verweis `[@klucz, s. 23]` auf ein
 * Werk, ein Zitat oder eine Person wird eine Fussnote; `[[Wort|@klucz]]` und
 * ein Verweis auf einen eigenen Eintrag ein Link (`onEntity`). Nachgeschlagen
 * wird in `lib` — sonst in der Baza wiedzy, in der man steht.
 */
export function Markup({ text, onEntity, lib }: { text: string; onEntity?: (id: string) => void; lib?: CogitaLibrary }) {
  const ctx = useContext(CogitaContext);
  const from = lib ?? ctx?.lib;
  const prefix = `cg${useId().replace(/[^A-Za-z0-9]/g, '')}-`;
  const look = from?.markupLook ?? NOTHING;
  const blocks = useMemo(() => parseMarkup(text), [text]);
  const notes = useMemo(() => countNotes([blocks], look), [blocks, look]);
  const links = useMemo<MarkupLinkTo>(() => (onEntity === undefined ? { cross: crossLink } : { open: (e: LibEntry) => onEntity(e.id), cross: crossLink }), [onEntity]);
  return (
    <MarkupLinks.Provider value={links}>
      <div className="cg-markup">
        <Blocks blocks={blocks} look={look} notes={notes} prefix={prefix} />
        <NoteList notes={notes} prefix={prefix} />
      </div>
    </MarkupLinks.Provider>
  );
}

/* -- Dateien ------------------------------------------------------------------------------ */

/**
 * Eine Datei, geöffnet mit dem Schlüssel ihres Bereichs — 2026-10-22 (Schritt 8)
 * auch auf einer öffentlichen Seite (der offengelegte Schlüssel, die versiegelte
 * Datei); offene Kopien gibt es nicht mehr.
 */
export function MediaView({ media }: { media: MediaRef }) {
  const t = useT();
  const ctx = useContext(CogitaContext);
  /* 0110 — die Datei liegt dort, woher ihr Eintrag kommt, unter dem Schlüssel jenes Bereichs. */
  const owner = media.library ?? ctx?.lib.libraryId ?? '';
  const url = useAsync(ctx === null ? null : () => {
    const area = ctx.lib.areaOf(owner) ?? ctx.lib.areaId;
    return fileUrl(owner, media, area === ctx.lib.areaId ? ctx.keyOf : (epoch) => ctx.keyIn(area, epoch), ctx.seat);
  }, [media.file, owner]);
  if (url === undefined) return <span className="wk-hint">{t('cogitaViews.ui.fileOpening')}</span>;
  if (url === null) return <span className="wk-hint">{t('cogitaViews.ui.fileFailed')}</span>;
  if (media.type === 'image') return <img className="cg-media" src={url} alt={media.name ?? ''} />;
  if (media.type === 'audio') return <audio className="cg-media" src={url} controls preload="metadata" />;
  if (media.type === 'video') return <video className="cg-media" src={url} controls preload="metadata" />;
  return <a className="wk-link-btn" href={url} download={media.name ?? t('cogitaViews.ui.fileName')}>{t('cogitaViews.ui.download', { name: media.name ?? t('cogitaViews.ui.fileName') })}</a>;
}

/* -- Bedingungen und Aktionen der einen Logik ------------------------------------------------ */

/** 2026-10-30 — die Verweisfelder, über die eine Bedingung relativ die Kenntnis sieht („to, na co wskazuje pole"). */
export interface RelationField {
  readonly key: string;
  readonly label: string;
  readonly group?: string;
}

export function ConditionEditor({ value, onChange, name, depth = 0, relations, fresh }: {
  value: Condition | null;
  onChange: (next: Condition | null) => void;
  name?: (id: string) => string;
  depth?: number;
  /**
   * 2026-10-30 — in einem Widok oder einer Powtórka: „Znajomość" auch relativ zu dem, was geprüft wird (ten wpis, jego
   * karty, to, co wcześniej, to, pod czym leży, to, na co wskazuje pole — diese Felder).
   */
  relations?: readonly RelationField[];
  /** Was „+ warunek" und „+ część" anlegen. */
  fresh?: Condition;
}) {
  const t = useT();
  const c = value;
  const start: Condition = fresh ?? { type: 'value', value: '', op: 'ge', than: 1 };
  /* 2026-11-03 (G) — „Przebieg": die Abläufe der Baza zur Wahl (ausserhalb einer Baza: eine Kennung von Hand). */
  const cogita = useContext(CogitaContext);
  const flows = cogita === null ? [] : cogita.lib.docs('flow').map((d) => ({ id: d.id, name: String(d.data.name ?? t('cogitaViews.ui.cond.flowName')) }));
  const set = (patch: Partial<Condition>) => onChange(readCondition({ ...(c ?? { type: 'value' }), ...patch }));
  const fields = relations === undefined ? [] : [...new Map(relations.map((f) => [f.key, f])).values()];
  const fieldName = (key: string) => fields.find((f) => f.key === key)?.label ?? key;
  if (c === null) {
    return (
      <div className="cg-cond">
        <button type="button" className="wk-link-btn" onClick={() => onChange(start)}>{t('cogitaViews.ui.cond.add')}</button>
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
          {CONDITION_TYPES.map((ct) => <option key={ct} value={ct}>{CONDITION_LABEL[ct]}</option>)}
        </select>
        {c.type === 'knowness' && relations !== undefined && (
          <select value={c.rel ?? ''} aria-label={t('cogitaViews.ui.cond.whose')} onChange={(e) => set(e.target.value === '' ? { rel: undefined, each: undefined } : { rel: e.target.value, of: undefined })}>
            <option value="">{t('cogitaViews.ui.cond.specific')}</option>
            {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
            {fields.length > 0 && (
              <optgroup label={t('cogitaViews.ui.cond.pointedField')}>
                {fields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.group === undefined ? '' : ` (${f.group})`}</option>)}
              </optgroup>
            )}
          </select>
        )}
        {c.type === 'knowness' && c.rel !== undefined && c.rel !== 'self' && (
          <select value={c.each ?? 'all'} aria-label={t('cogitaViews.ui.cond.allOrOne')} onChange={(e) => set({ each: e.target.value === 'any' ? 'any' : undefined })}>
            <option value="all">{t('cogitaViews.ui.cond.each')}</option>
            <option value="any">{t('cogitaViews.ui.cond.any')}</option>
          </select>
        )}
        {(c.type === 'value' || c.type === 'knowness') && (
          <>
            {c.type === 'value'
              ? <input value={c.value ?? ''} placeholder={t('cogitaViews.ui.cond.valueName')} onChange={(e) => set({ value: e.target.value })} />
              : c.rel === undefined && <input value={c.of ?? ''} placeholder={t('cogitaViews.ui.cond.entryOrCard')} onChange={(e) => set({ of: e.target.value })} />}
            {/* 2026-11-01 — die Kenntnis als Band (poznane, znane, do powtórki, nieznane) oder als Zahl. */}
            {c.type === 'knowness' && (
              <select value={c.band ?? ''} aria-label={t('cogitaViews.ui.cond.whichKnowness')} data-cond-band="" onChange={(e) => set(e.target.value === ''
                ? { band: undefined, op: 'ge', than: 0.5 }
                : { band: e.target.value as KnownessBand, op: undefined, than: undefined })}>
                {KNOWNESS_BANDS.map((b) => <option key={b} value={b}>{KNOWNESS_BAND_LABEL[b]}</option>)}
                <option value="">{t('cogitaViews.ui.cond.number')}</option>
              </select>
            )}
            {(c.type === 'value' || c.band === undefined) && (
              <>
                <select value={c.op ?? 'ge'} onChange={(e) => set({ op: e.target.value as CompareOp })}>
                  {COMPARE_OPS.filter((o) => o !== 'contains' && o !== 'filled' && o !== 'empty').map((o) => <option key={o} value={o}>{COMPARE_LABEL[o]}</option>)}
                </select>
                <input type="number" step="any" value={c.than ?? ''} onChange={(e) => set({ than: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </>
            )}
          </>
        )}
        {c.type === 'flow' && (
          <>
            {flows.length > 0
              ? (
                <select value={c.flow ?? ''} aria-label={t('cogitaViews.ui.cond.whichFlow')} data-cond-flow="" onChange={(e) => set({ flow: e.target.value || undefined })}>
                  <option value="">{t('cogitaViews.ui.cond.flowNone')}</option>
                  {flows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              )
              : <input value={c.flow ?? ''} placeholder={t('cogitaViews.ui.cond.flow')} onChange={(e) => set({ flow: e.target.value })} />}
            <select value={c.state ?? 'done'} aria-label={t('cogitaViews.ui.cond.whatState')} onChange={(e) => set({ state: e.target.value as FlowCheck })}>
              {FLOW_CHECKS.map((s) => <option key={s} value={s}>{FLOW_CHECK_LABEL[s]}</option>)}
            </select>
            {c.state === 'goal' && <input value={c.goal ?? ''} placeholder={t('cogitaViews.ui.cond.goal')} onChange={(e) => set({ goal: e.target.value || undefined })} />}
          </>
        )}
        {(c.type === 'answered' || c.type === 'visited' || c.type === 'zone') && (
          <>
            <input value={c.of ?? ''} placeholder={c.type === 'answered' ? t('cogitaViews.ui.cond.question') : c.type === 'visited' ? t('cogitaViews.ui.cond.step') : t('cogitaViews.ui.cond.zone')} onChange={(e) => set({ of: e.target.value })} />
            {c.type === 'answered' && (
              <select value={c.correct === undefined ? '' : c.correct ? 'yes' : 'no'} onChange={(e) => set({ correct: e.target.value === '' ? undefined : e.target.value === 'yes' })}>
                <option value="">{t('cogitaViews.ui.cond.anyhow')}</option><option value="yes">{t('cogitaViews.ui.cond.right')}</option><option value="no">{t('cogitaViews.ui.cond.wrong')}</option>
              </select>
            )}
          </>
        )}
        {c.type === 'time' && (
          <>
            <input type="date" value={c.after ?? ''} onChange={(e) => set({ after: e.target.value || undefined })} aria-label={t('cogitaViews.ui.cond.fromDay')} />
            <input type="date" value={c.before ?? ''} onChange={(e) => set({ before: e.target.value || undefined })} aria-label={t('cogitaViews.ui.cond.toDay')} />
            <input type="time" value={c.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} aria-label={t('cogitaViews.ui.cond.fromHour')} />
            <input type="time" value={c.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} aria-label={t('cogitaViews.ui.cond.toHour')} />
          </>
        )}
        {c.type === 'place' && (
          <>
            <input type="number" step="any" placeholder={t('cogitaViews.ui.cond.lat')} value={c.lat ?? ''} onChange={(e) => set({ lat: Number(e.target.value) })} />
            <input type="number" step="any" placeholder={t('cogitaViews.ui.cond.lon')} value={c.lon ?? ''} onChange={(e) => set({ lon: Number(e.target.value) })} />
            <input type="number" placeholder="m" value={c.radius ?? 50} onChange={(e) => set({ radius: Number(e.target.value) })} />
          </>
        )}
        {depth === 0 && <button type="button" className="wk-link-btn" onClick={() => onChange(null)}>{t('cogitaViews.ui.cond.remove')}</button>}
      </div>
      {gate && (
        <div className="cg-cond-items">
          {(c.items ?? []).map((item, i) => (
            <div key={i} className="cg-cond-item">
              <ConditionEditor value={item} depth={depth + 1} name={name} {...(relations === undefined ? {} : { relations })} {...(fresh === undefined ? {} : { fresh })} onChange={(next) => {
                const items = [...(c.items ?? [])];
                if (next === null) items.splice(i, 1); else items[i] = next;
                onChange({ ...c, items });
              }} />
              <button type="button" className="wk-link-btn" onClick={() => onChange({ ...c, items: (c.items ?? []).filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          {(c.type !== 'not' || (c.items ?? []).length === 0) && (
            <button type="button" className="wk-link-btn" onClick={() => onChange({ ...c, items: [...(c.items ?? []), start] })}>{t('cogitaViews.ui.cond.addPart')}</button>
          )}
        </div>
      )}
      {depth === 0 && <p className="wk-hint">{conditionText(c, name, fieldName)}</p>}
    </div>
  );
}

export function ActionsEditor({ value, onChange, steps }: { value: readonly Action[]; onChange: (next: Action[]) => void; steps?: readonly { id: string; label: string }[] }) {
  const t = useT();
  const set = (i: number, patch: Partial<Action>) => onChange(value.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <div className="cg-actions">
      {value.map((a, i) => (
        <div key={i} className="cg-cond-row">
          <select value={a.type} onChange={(e) => set(i, { type: e.target.value as Action['type'] })}>
            <option value="add">{t('cogitaViews.ui.act.add')}</option>
            <option value="set">{t('cogitaViews.ui.act.set')}</option>
            <option value="go">{t('cogitaViews.ui.act.go')}</option>
          </select>
          {a.type !== 'go' && <input value={a.value ?? ''} placeholder={t('cogitaViews.ui.cond.valueName')} onChange={(e) => set(i, { value: e.target.value })} />}
          {a.type === 'add' && <input type="number" step="any" value={a.by ?? 1} onChange={(e) => set(i, { by: Number(e.target.value) })} />}
          {a.type === 'set' && <input type="number" step="any" value={a.to ?? 0} onChange={(e) => set(i, { to: Number(e.target.value) })} />}
          {a.type === 'go' && (steps === undefined
            ? <input value={a.step ?? ''} placeholder={t('cogitaViews.ui.cond.step')} onChange={(e) => set(i, { step: e.target.value })} />
            : <select value={a.step ?? ''} onChange={(e) => set(i, { step: e.target.value })}><option value="">—</option>{steps.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>)}
          <button type="button" className="wk-link-btn" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="wk-link-btn" onClick={() => onChange([...value, { type: 'add', value: '', by: 1 }])}>{t('cogitaViews.ui.act.new')}</button>
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

/** 2026-11-01 — der Name eines Eintrags mit seinen Wzory als `$…$` (für `TexText`). */
export const entityNameTex = (lib: CogitaLibrary, id: string): string => {
  const e: Entity | undefined = lib.entity(id);
  return e === undefined ? id.slice(-6) : lib.labelTex(e);
};

/**
 * 2026-11-01 — EIN NAME, EINE ZEILE MIT WZORY: der Name eines Eintrags (oder ein Text wie die Frage einer Karte) mit
 * gesetzten Wzory — KaTeX lädt erst, wenn einer da ist; ohne Wzór steht der Text wie bisher.
 */
export function EntityTitle({ lib, id }: { lib: CogitaLibrary; id: string }) {
  return <TexText text={entityNameTex(lib, id)} />;
}
