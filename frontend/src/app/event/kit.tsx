/**
 * DIE BAUSTEINE DER EREIGNISSEITEN (0063) — aus dem Altbestand herübergeholt.
 *
 * Die Ereignisseiten (`legacy/pages/events`) hatten, was eine Seite für eine
 * Wallfahrt, Rekolekcje oder einen Ausflug braucht: Tytuł, Krótkie informacje,
 * Plan, Mapa mit GPX, Koszty, FAQ, Osoby, Pliki, Galeria. Hier stehen sie als
 * gewöhnliche Bausteine (`part.ts`) — im Raster und als Slajdy, in jeder Grösse,
 * im Bausteinverwalter.
 *
 * <b>Ihre Gestalt ist die des Altbestands, wörtlich.</b> Was ein Ereignis dort
 * in `configJson` trug, trägt der Baustein hier unter dem Schlüssel `json` —
 * dieselben Felder, dieselben duldsamen Leser. So lässt sich ein Ereignis aus dem
 * Altbestand Stück für Stück übernehmen (`SlidesImport.tsx`), ohne dass irgendwo
 * eine Übersetzung steht, die auseinanderlaufen kann. Daneben, flach wie bei
 * jedem Baustein: `title` (die Überschrift über dem Baustein) und `intro`.
 *
 * <b>Ihre Editoren sind Listen von Listen</b> — ein Plan hat Etappen, jede
 * Etappe Punkte. Deshalb haben sie einen eigenen Editor (`PartModule.Editor`)
 * statt Felder; die Bausteine dafür stehen hier (Altbestand: `editorKit.tsx`).
 */

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';

import {
  definePart, text, type EditorContext, type EditorProps, type PartContext, type PartJson, type PartModule, type PartSize, type RawConfig
} from '../part';
import { FilePicker, ImagePicker } from '../PageFiles';

/* -- Duldsame Leser (Altbestand: contracts.ts) ------------------------------------ */

/*
 * Was gespeichert ist, kann jederzeit halb fertig sein. Jeder Leser gibt einen
 * brauchbaren Wert zurück, statt zu werfen — ein kaputtes Feld darf nie eine
 * Seite leeren.
 */

export function parseJson(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asOptionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function asStringList(value: unknown): string[] {
  return asArray(value)
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Ein Feld von Einträgen durch einen Leser — wer nicht passt, fällt heraus. */
export function mapEntries<T>(value: unknown, read: (record: Record<string, unknown>) => T | null): T[] {
  const result: T[] = [];
  for (const entry of asArray(value)) {
    const mapped = read(asRecord(entry));
    if (mapped !== null) result.push(mapped);
  }
  return result;
}

/* -- Hell oder dunkel ------------------------------------------------------------------ */

/**
 * WIE HELL DER GRUND IST, auf dem der Baustein steht.
 *
 * Die Farben selbst kommen aus den Zeichen des Themas (`--wk-*`, im Slajd die
 * des Decks). Ein paar Regeln aus dem Altbestand fragen aber „hell oder
 * dunkel?" — die Vorschau der Mapa etwa kehrt die Karte im Dunkeln um. Die
 * Antwort steht in der Schriftfarbe: helle Schrift heisst dunkler Grund.
 */
export function useTone(ref: RefObject<HTMLElement | null>): 'light' | 'dark' {
  const [tone, setTone] = useState<'light' | 'dark'>('light');

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const look = () => {
      const rgb = getComputedStyle(el).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      const lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
      setTone(lum > 0.55 ? 'dark' : 'light');
    };
    look();
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', look);
    return () => media?.removeEventListener?.('change', look);
  }, [ref]);

  return tone;
}

/** Die Wurzel jedes Bausteins von hier: die Zeichen des Altbestands (`--ev-*`), aus denen des Themas. */
export function EvRoot({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tone = useTone(ref);
  return <div ref={ref} className={`wk-evp${className === undefined ? '' : ` ${className}`}${tone === 'light' ? ' is-light' : ''}`}>{children}</div>;
}

/* -- Der Editor (Altbestand: editorKit.tsx) ---------------------------------------------- */

/**
 * Hält, was gerade getippt wird.
 *
 * Jedes Feld hier wird von der gelesenen Gestalt gesteuert, und das Lesen
 * glättet: Text wird gestutzt, leere Zeilen fallen weg. Fliesst das direkt
 * zurück ins Feld, geschieht das Glätten zwischen zwei Tastendrücken — ein
 * Leerzeichen am Wortende verschwand beim Tippen, und Enter für eine neue Zeile
 * tat gar nichts. Solange ein Feld den Fokus hat, schreibt es deshalb niemand
 * um; beim Verlassen übernimmt es, was wirklich gespeichert ist.
 */
function useDraft(external: string) {
  const [draft, setDraft] = useState(external);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(external);
  }, [external]);

  return {
    draft,
    setDraft,
    focusProps: {
      onFocus: () => { focused.current = true; },
      onBlur: () => { focused.current = false; setDraft(external); }
    }
  };
}

export function TextRow({ label, value, onChange, hint, placeholder, type = 'text' }: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  placeholder?: string;
  type?: 'text' | 'url' | 'date' | 'time' | 'color';
}) {
  const { draft, setDraft, focusProps } = useDraft(value);
  return (
    <label className="pe-row">
      <span>{label}</span>
      <input type={type} value={draft} placeholder={placeholder} {...focusProps}
        onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }} />
      {hint !== undefined && <small>{hint}</small>}
    </label>
  );
}

export function AreaRow({ label, value, onChange, rows = 3, hint }: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  hint?: string;
}) {
  const { draft, setDraft, focusProps } = useDraft(value);
  return (
    <label className="pe-row">
      <span>{label}</span>
      <textarea rows={rows} value={draft} {...focusProps}
        onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }} />
      {hint !== undefined && <small>{hint}</small>}
    </label>
  );
}

/** Eine Zahl — leer heisst „noch nicht bekannt", nicht null. */
export function NumberRow({ label, value, onChange, step = 1, hint, min, placeholder }: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  step?: number | string;
  hint?: string;
  min?: number;
  placeholder?: string;
}) {
  const { draft, setDraft, focusProps } = useDraft(value === null || !Number.isFinite(value) ? '' : String(value));
  return (
    <label className="pe-row">
      <span>{label}</span>
      <input type="number" step={step} min={min} value={draft} placeholder={placeholder} {...focusProps}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = Number.parseFloat(e.target.value);
          onChange(e.target.value.trim() === '' || !Number.isFinite(parsed) ? null : parsed);
        }} />
      {hint !== undefined && <small>{hint}</small>}
    </label>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="pe-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function SelectRow<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <label className="pe-row">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

/** Zeilen eines Textfeldes als Liste — die leere, eben mit Enter geöffnete Zeile bleibt im Entwurf stehen. */
export function LinesRow({ label, values, onChange, rows = 4, hint }: {
  label: string;
  values: readonly string[];
  onChange: (next: string[]) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <AreaRow label={label} rows={rows} hint={hint ?? 'Jedna pozycja w wierszu.'} value={values.join('\n')}
      onChange={(next) => onChange(next.split('\n').map((entry) => entry.trim()).filter((entry) => entry.length > 0))} />
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="pe-group">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Hinzufügen, wegnehmen, umstellen — der Baustein sagt, wie eine Zeile aussieht und wie eine leere beginnt. */
export function ListEditor<T>({ legend, items, onChange, blank, addLabel = 'Dodaj', renderItem, titleOf }: {
  legend: string;
  items: readonly T[];
  onChange: (next: T[]) => void;
  blank: () => T;
  addLabel?: string;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
  titleOf: (item: T, index: number) => string;
}) {
  const [open, setOpen] = useState<number | null>(items.length === 1 ? 0 : null);

  const replace = (index: number, next: T) => {
    const copy = [...items];
    copy[index] = next;
    onChange(copy);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const copy = [...items];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChange(copy);
    if (open === index) setOpen(target);
  };

  return (
    <Fieldset legend={legend}>
      <div className="pe-list">
        {items.map((item, index) => (
          <article className={`pe-item${open === index ? ' is-open' : ''}`} key={index}>
            <header>
              <button type="button" className="pe-item-title" aria-expanded={open === index} onClick={() => setOpen(open === index ? null : index)}>
                <span aria-hidden="true">{open === index ? '▾' : '▸'}</span> {titleOf(item, index)}
              </button>
              <span className="pe-item-tools">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Wyżej" title="Wyżej">↑</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Niżej" title="Niżej">↓</button>
                <button type="button" className="pe-remove" aria-label="Usuń" title="Usuń"
                  onClick={() => { onChange(items.filter((_, at) => at !== index)); setOpen(null); }}>×</button>
              </span>
            </header>
            {open === index && <div className="pe-item-body">{renderItem(item, (next) => replace(index, next))}</div>}
          </article>
        ))}
      </div>
      <button type="button" className="pe-add" onClick={() => { onChange([...items, blank()]); setOpen(items.length); }}>
        + {addLabel}
      </button>
    </Fieldset>
  );
}

/** Ein Bild: eine Adresse — oder eins von der Seite, gewählt oder hochgeladen. */
export function ImageRow({ label, value, onChange, ctx, busy, hint }: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  ctx: EditorContext;
  busy: boolean;
  hint?: string;
}) {
  return (
    <div className="pe-media">
      <TextRow label={label} value={value} onChange={onChange} hint={hint ?? (ctx.path === null ? 'Adres obrazu. Wgrać obraz możesz w edytorze strony, na której stoi ten moduł.' : undefined)} />
      {ctx.path !== null && <ImagePicker path={ctx.path} value={value} busy={busy} onPick={onChange} />}
    </div>
  );
}

/** Eine Datei: eine Adresse — oder eine von der Seite, gewählt oder hochgeladen. */
export function FileRow({ value, onChange, onPicked, ctx, busy }: {
  value: string;
  onChange: (next: string) => void;
  onPicked: (url: string, name: string, size: string) => void;
  ctx: EditorContext;
  busy: boolean;
}) {
  return (
    <div className="pe-media">
      <TextRow label="Adres pliku" value={value} onChange={onChange}
        hint={ctx.path === null ? 'Wgrać plik możesz w edytorze strony, na której stoi ten moduł.' : undefined} />
      {ctx.path !== null && <FilePicker path={ctx.path} value={value} busy={busy} onPick={onPicked} />}
    </div>
  );
}

/* -- Ein Baustein aus dem Altbestand ------------------------------------------------------- */

export interface EventConfig<C> {
  readonly title: string;
  readonly intro: string;
  readonly config: C;
}

/**
 * EINEN BAUSTEIN AUS DEN EREIGNISSEITEN BESCHREIBEN.
 *
 * `parse` ist der duldsame Leser des Altbestands, unverändert; `Body` zeichnet,
 * was dort `Renderer` hiess; `Edit` ist der Editor von dort. Überschrift und
 * Vorspann setzt diese Hülle davor — im Altbestand standen sie an der Seite
 * des Ereignisses (`title`, `intro`), hier am Baustein.
 */
export function defineEventPart<C>(spec: {
  kind: string;
  label: string;
  use: string;
  box: { colSpan: number; rowSpan: number };
  parse: (data: unknown) => C;
  /** Wie ein leerer beginnt — für den Editor und den Übernehmer. */
  blank: () => C;
  /** Ein ausgefülltes Beispiel — für den Słownik (Altbestand: `example`). */
  example: () => C;
  /**
   * 0064 — WAS JEDER SCHLÜSSEL BEDEUTET, für die Beschreibung neben dem
   * Import: `groups[]`, `groups[].rows[].time` → ein Satz. `title` und
   * `intro` stehen schon da. Jeder Schlüssel des Beispiels muss hier stehen
   * (`scripts/app-json-check.mjs`).
   */
  keys: Readonly<Record<string, string>>;
  hasContent: (config: C) => boolean;
  shows: (config: C, size: PartSize) => string;
  Body: ComponentType<{ config: C; ctx: PartContext; title: string }>;
  Edit: ComponentType<{ config: C; onChange: (next: C) => void; ctx: EditorContext; busy: boolean }>;
  strip?: { title: string; open: string };
  fullscreen?: boolean;
  /** Zeigt seine Überschrift selbst (Tytuł) — dann steht `title` nur im Menü der Slajdy. */
  ownHeading?: boolean;
}): PartModule & { readonly blank: () => C; readonly example: () => C } {
  const read = (raw: RawConfig): EventConfig<C> => ({
    title: text(raw, 'title'),
    intro: text(raw, 'intro'),
    config: spec.parse(parseJson(raw.json))
  });

  const Editor = ({ raw, onSet, ctx, busy }: EditorProps) => {
    const now = read(raw);
    return (
      <div className="pe">
        <TextRow label="Nagłówek" value={raw.title ?? ''} placeholder={spec.label} onChange={(title) => onSet({ title })} />
        <AreaRow label="Wstęp" rows={2} value={raw.intro ?? ''} onChange={(intro) => onSet({ intro })} />
        <spec.Edit config={now.config} ctx={ctx} busy={busy} onChange={(next) => onSet({ json: JSON.stringify(next) })} />
      </div>
    );
  };
  Editor.displayName = `EventEditor(${spec.kind})`;

  /*
   * 0064 — IM JSON STEHT DIE GESTALT OFFEN DA: `title`, `intro` und daneben
   * die Schlüssel des Bausteins, nicht als Zeichenkette in `json`. Ein
   * Dokument des Altbestands (`{ title, intro, config }`) wird ebenso
   * angenommen.
   */
  const toJson = (raw: RawConfig): Record<string, unknown> => {
    const now = read(raw);
    return { title: now.title, intro: now.intro, ...asRecord(now.config) };
  };
  const json: PartJson = {
    example: toJson({ title: spec.label, json: JSON.stringify(spec.example()) }),
    keys: {
      title: `Nagłówek nad treścią${spec.ownHeading === true ? ' (tu: tylko nazwa w menu slajdów — moduł pokazuje własny tytuł)' : ''}`,
      intro: 'Krótki wstęp pod nagłówkiem (może być pusty)',
      ...spec.keys
    },
    toJson,
    fromJson: (value) => {
      const record = asRecord(value);
      const { title, intro, config, ...rest } = record;
      const content = Object.keys(rest).length === 0 && config !== null && typeof config === 'object' ? config : rest;
      const out: RawConfig = { json: JSON.stringify(spec.parse(content)) };
      if (asText(title).trim() !== '') out.title = asText(title);
      if (asText(intro).trim() !== '') out.intro = asText(intro);
      return out;
    }
  };

  const module = definePart<EventConfig<C>>({
    kind: spec.kind,
    label: spec.label,
    use: spec.use,
    box: spec.box,
    fields: [],
    read,
    hasContent: (c) => spec.hasContent(c.config),
    shows: (c, size) => spec.shows(c.config, size),
    strip: spec.strip,
    fullscreen: spec.fullscreen,
    Editor,
    example: { title: spec.label, json: JSON.stringify(spec.example()) },
    json,
    View: ({ config, ctx }) => (
      <EvRoot className={`wk-evp-${spec.kind}`}>
        {config.title !== '' && spec.ownHeading !== true && <h2 className="wk-card-title">{config.title}</h2>}
        {config.intro !== '' && <p className="wk-evp-intro">{config.intro}</p>}
        <spec.Body config={config.config} ctx={ctx} title={config.title} />
      </EvRoot>
    )
  });

  return { ...module, blank: spec.blank, example: spec.example };
}

/** Polnisch zählt dreifach: 1 punkt, 3 punkty, 12 punktów. */
export const count = (n: number, one: string, few: string, many: string): string =>
  `${n} ${n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many}`;
