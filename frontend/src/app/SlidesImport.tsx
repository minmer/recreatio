/**
 * EIN EREIGNIS AUS DEM ALTBESTAND HERÜBERHOLEN (0063).
 *
 * Die Ereignisseiten des Altbestands liessen sich als EIN JSON-Dokument
 * beschreiben (`legacy/pages/events/admin/jsonDictionary.ts`): das Ereignis,
 * seine Seiten, auf jeder Seite die Teile mit `config` und `layers`. Genau
 * dieses Dokument nimmt der Editor der Slajdy hier an — und weil die Bausteine
 * der Ereignisseiten ihre Gestalt wörtlich behalten haben (`event/kit.tsx`),
 * wird ein Teil zum Baustein, ohne dass etwas übersetzt werden muss:
 *
 * <code>
 *   title                    → Tytuł (hero)
 *   shortinfos, plan, map,
 *   costs, faq, people,
 *   files, gallery           → dieselbe Art
 *   text                     → Tekst (Absätze, Punkte, Notiz als Zeilen)
 *   contact                  → Kontakt (Telefon, E-Mail, Organisator)
 *   form, registration,
 *   card, roster, checklist,
 *   topics, meme             → ausgelassen, mit Hinweis, was es hier stattdessen gibt
 * </code>
 *
 * Die Hintergründe (`layers`) und das Menü (`menuLabel`) werden zum Slajd des
 * Bausteins, das Thema des Ereignisses (`theme`) auf Wunsch zum Thema der
 * Seite. Übernommen wird in den Entwurf — gespeichert erst mit „Zapisz".
 *
 * Der Słownik daneben ist für ein Sprachmodell: kopieren, ein Ereignis
 * beschreiben lassen, das Ergebnis hier einfügen.
 */

import { useMemo, useState } from 'react';

import { asArray, asOptionalText, asRecord, asStringList, asText } from './event/kit';
import { newId } from './ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Layout } from './layout';
import type { DraftPart } from './page';
import { PARTS, partOf } from './parts/registry';
import { DEFAULT_THEMES, readLayers, type Look, type Theme } from './slides';

/** Arten, die ihr `config` unverändert als `json` tragen. */
const VERBATIM: Readonly<Record<string, string>> = {
  title: 'hero',
  hero: 'hero',
  shortinfos: 'shortinfos',
  plan: 'plan',
  map: 'map',
  costs: 'costs',
  faq: 'faq',
  people: 'people',
  files: 'files',
  gallery: 'gallery'
};

/** Was es für das, was nicht herüberkommt, im Neubau gibt. */
const INSTEAD: Readonly<Record<string, string>> = {
  form: 'formularz zgłoszeń — dodaj moduł „Formularz” i ułóż w nim pytania',
  registration: 'własne zgłoszenie — moduł „Twoje zgłoszenie” (za linkiem osobistym)',
  card: 'karta uczestnika — pytania w module „Formularz”, zgody w jego ustawieniach',
  roster: 'lista uczestników — zgłoszenia formularza w Warsztacie',
  checklist: 'lista spraw — moduł „Kroki” (za linkiem osobistym)',
  topics: 'tematy do rozmowy — moduł „Rozmowa”',
  meme: 'memy — tego jeszcze nie ma w nowym systemie'
};

export interface LegacyPage {
  readonly index: number;
  readonly label: string;
  readonly parts: readonly unknown[];
}

export interface Imported {
  readonly parts: DraftPart[];
  readonly theme: Theme | null;
  readonly title: string | null;
  readonly lead: string | null;
  readonly warnings: string[];
}

/** Die Seiten des Dokuments — oder eine, wenn es nur Teile sind (`{ parts }` oder eine Liste). */
export function legacyPages(doc: unknown): LegacyPage[] {
  if (Array.isArray(doc)) return [{ index: 0, label: 'Części', parts: doc }];
  const root = asRecord(doc);
  if (Array.isArray(root.parts)) return [{ index: 0, label: asText(root.title, 'Części'), parts: root.parts }];
  return asArray(root.pages).map((page, index) => {
    const one = asRecord(page);
    const kind = asText(one.kind) === 'internal' ? ' (wewnętrzna)' : '';
    return { index, label: `${asText(one.menuLabel) || asText(one.title) || `Strona ${index + 1}`}${kind}`, parts: asArray(one.parts) };
  });
}

/** Das Thema des Ereignisses — dieselben fünf Farben wie das Thema der Slajdy. */
function themeOf(doc: unknown): Theme | null {
  const theme = asRecord(asRecord(doc).theme);
  const mode = asText(theme.mode);
  if (mode !== 'dark' && mode !== 'light') return null;
  const color = (key: string) => (/^#[0-9a-f]{6}$/i.test(asText(theme[key])) ? asText(theme[key]) : DEFAULT_THEMES[mode][key as 'accent']);
  return { mode, accent: color('accent'), ink: color('ink'), ground: color('ground'), muted: color('muted') };
}

/** `config` darf als Objekt oder (Export des Altbestands) als `configJson`-Zeichenkette kommen. */
function configOf(part: Record<string, unknown>): unknown {
  if (typeof part.configJson === 'string') {
    try { return JSON.parse(part.configJson) as unknown; } catch { return null; }
  }
  return part.config ?? null;
}

function layersOf(part: Record<string, unknown>): unknown {
  if (typeof part.layersJson === 'string') {
    try { return JSON.parse(part.layersJson) as unknown; } catch { return []; }
  }
  return part.layers ?? [];
}

/** Ein Teil des Altbestands als Tafel eines Bausteins — oder `null`, mit dem Grund. */
function rawOf(kind: string, part: Record<string, unknown>): { kind: string; raw: Record<string, string> } | string {
  const title = asOptionalText(part.title) ?? '';
  const intro = asOptionalText(part.intro) ?? '';
  const config = configOf(part);

  const target = VERBATIM[kind];
  if (target !== undefined) {
    const raw: Record<string, string> = { json: JSON.stringify(config ?? {}) };
    if (title !== '') raw.title = title;
    if (intro !== '') raw.intro = intro;
    return { kind: target, raw };
  }

  if (kind === 'text') {
    const one = asRecord(config);
    const body = [
      ...(intro !== '' ? [intro] : []),
      ...asStringList(one.paragraphs),
      ...asStringList(one.bullets).map((line) => `• ${line}`),
      ...(asOptionalText(one.note) !== null ? [asOptionalText(one.note) as string] : [])
    ];
    return { kind: 'text', raw: { title, body: body.join('\n') } };
  }

  if (kind === 'contact') {
    const one = asRecord(config);
    const channels = asArray(one.channels).map(asRecord);
    const find = (test: (value: string, href: string) => boolean) =>
      channels.map((c) => ({ value: asText(c.value).trim(), href: asText(c.href).trim() })).find((c) => c.value !== '' && test(c.value, c.href))?.value ?? '';
    return {
      kind: 'contact',
      raw: {
        address: asOptionalText(one.organizer) ?? '',
        phone: find((value, href) => href.startsWith('tel:') || /^\+?[\d\s()-]{7,}$/.test(value)),
        email: find((value, href) => href.startsWith('mailto:') || /@/.test(value))
      }
    };
  }

  return INSTEAD[kind] ?? `nieznany rodzaj „${kind}”`;
}

/**
 * DIE TEILE EINER SEITE ALS BAUSTEINE — hinter die schon vorhandenen gestellt,
 * jeder mit seinem Platz im Raster (für die Seite mit Modulen) und seinem
 * Slajd (Name, Hintergründe).
 */
export function importLegacy(doc: unknown, pageIndex: number, existing: readonly DraftPart[]): Imported {
  const page = legacyPages(doc)[pageIndex];
  const warnings: string[] = [];
  const made: DraftPart[] = [];
  const root = asRecord(doc);

  for (const [index, entry] of (page?.parts ?? []).entries()) {
    const part = asRecord(entry);
    const kind = asText(part.kind).trim();
    const label = asOptionalText(part.menuLabel) ?? asOptionalText(part.title) ?? kind;

    if (part.isVisible === false) { warnings.push(`„${label}” było ukryte — przeniesione, sprawdź, czy ma być widoczne.`); }

    const mapped = rawOf(kind, part);
    if (typeof mapped === 'string') { warnings.push(`Część ${index + 1} „${label}” pominięta: ${mapped}.`); continue; }

    const def = partOf(mapped.kind);
    const layout: Record<string, unknown> = {};
    for (const bp of BREAKPOINTS) {
      const cols = COLUMNS[bp];
      const size = { colSpan: snapColSpan(def?.box.colSpan ?? 6, cols), rowSpan: snapRowSpan(def?.box.rowSpan ?? 3) };
      layout[bp] = { position: firstFreeCell([...existing, ...made], size, cols, bp), size };
    }
    layout.slide = { label, layers: readLayers(layersOf(part)) };
    made.push({ id: newId(), moduleId: null, kind: mapped.kind, layout: layout as Layout, config: mapped.raw });
  }

  return {
    parts: made,
    theme: themeOf(doc),
    title: asOptionalText(root.title),
    lead: asOptionalText(root.subtitle) ?? asOptionalText(root.summary),
    warnings
  };
}

/** Der Słownik für ein Sprachmodell — aus den Bausteinen selbst, damit er nicht von ihnen wegläuft. */
export function dictionary(): string {
  const examples = PARTS
    .filter((def) => 'example' in def && typeof (def as { example?: unknown }).example === 'function')
    .map((def) => {
      const legacyKind = def.kind === 'hero' ? 'title' : def.kind;
      const example = (def as unknown as { example: () => unknown }).example();
      return `### "${legacyKind}" — ${def.label}\n${def.use}\n\n"config": ${JSON.stringify(example, null, 2)}`;
    })
    .join('\n\n');

  return `# Wydarzenie jako JSON — do przeniesienia na stronę ze slajdami

Zwróć JEDEN obiekt JSON, bez komentarzy i bez tekstu wokół niego.

{
  "title":    "Nazwa wydarzenia",
  "subtitle": "Hasło pod tytułem",
  "theme":    { "mode": "dark", "accent": "#4c7dd6", "ground": "#080d15", "ink": "#eef2f8", "muted": "#a3b2c9" },
              // tryb jasny: "mode": "light", ground "#f4f6fa", ink "#16202e", muted "#5a6a80", accent "#2f5fb5"
  "pages":    [ { "kind": "public", "title": "…", "menuLabel": "Strona publiczna", "parts": [ … ] } ]
}

Każda część to jeden slajd:

{
  "kind":      "plan",          // rodzaj — lista niżej
  "menuLabel": "Plan",          // nazwa slajdu w menu; z niej powstaje kotwica #plan
  "title":     "Plan dnia",     // nagłówek nad treścią; dla "title" zostaw null
  "intro":     "Krótki wstęp.",
  "config":    { … },           // treść, inna dla każdego rodzaju
  "layers":    [ … ]            // tło; pominięte = gradient i duży napis z nazwy
}

Warstwy tła, od tyłu do przodu:
  { "kind": "gradient", "speed": 0.12, "angle": 168, "from": "#12203a", "via": null, "to": "#060a12" }
  { "kind": "image", "speed": 0.34, "url": "https://…/tlo.jpg", "opacity": 0.45, "blend": "soft-light", "position": "center" }
  { "kind": "bigtext", "speed": 0.95, "lines": ["TRASA"], "opacity": 0.09 }

Przyciski w części "title" mogą prowadzić do innych slajdów: "#" + nazwa z menu, np. "#zapisy".

## Rodzaje części

### "text" — Tekst
"config": { "paragraphs": ["Akapit."], "bullets": ["Punkt listy"], "note": null }

### "contact" — Kontakt
"config": { "organizer": "Parafia …", "channels": [{ "label": "Telefon", "value": "+48 …", "href": "tel:+48…" }], "note": null }

${examples}

Formularz zgłoszeń buduje się w Warsztacie (moduł „Formularz”) — w tym dokumencie go pomiń.
`;
}

export function SlidesImport({ parts, look, onParts, onLook }: {
  parts: readonly DraftPart[];
  look: Look;
  onParts: (next: readonly DraftPart[]) => void;
  onLook: (next: Look) => void;
}) {
  const [raw, setRaw] = useState('');
  const [page, setPage] = useState(0);
  const [replace, setReplace] = useState(false);
  const [takeTheme, setTakeTheme] = useState(true);
  const [result, setResult] = useState<{ count: number; warnings: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo<{ value: unknown } | { error: string } | null>(() => {
    if (raw.trim() === '') return null;
    try { return { value: JSON.parse(raw) as unknown }; } catch (e) { return { error: e instanceof Error ? e.message : 'Nieprawidłowy JSON.' }; }
  }, [raw]);

  const pages = parsed !== null && 'value' in parsed ? legacyPages(parsed.value) : [];
  const theme = parsed !== null && 'value' in parsed ? themeOf(parsed.value) : null;

  const run = () => {
    if (parsed === null || !('value' in parsed)) return;
    const done = importLegacy(parsed.value, Math.min(page, Math.max(0, pages.length - 1)), replace ? [] : parts);
    onParts(replace ? done.parts : [...parts, ...done.parts]);
    if (takeTheme && done.theme !== null) onLook({ ...look, theme: done.theme });
    setResult({ count: done.parts.length, warnings: done.warnings });
    setRaw('');
  };

  return (
    <details className="wk-fold se-import">
      <summary>Przenieś wydarzenie ze starego systemu (JSON)</summary>
      <p className="wk-hint">
        Wklej dokument wydarzenia w formacie starych stron wydarzeń — cały (z „pages”) albo same części. Każda część
        staje się slajdem, razem z tłem i nazwą w menu. Zmiany trafiają do szkicu; zapisuje je „Zapisz”.
      </p>
      <div className="wk-actions">
        <button type="button" className="wk-link-btn" onClick={() => {
          void navigator.clipboard.writeText(dictionary()).then(() => setCopied(true)).catch(() => setCopied(false));
        }}>{copied ? 'Skopiowano słownik' : 'Kopiuj słownik dla AI'}</button>
      </div>
      <label className="pe-row">
        <span>Dokument JSON</span>
        <textarea rows={8} spellCheck={false} value={raw} placeholder='{ "title": "…", "pages": [ { "parts": [ … ] } ] }'
          onChange={(e) => { setRaw(e.target.value); setResult(null); }} />
      </label>
      {parsed !== null && 'error' in parsed && <p className="wk-error">Nieprawidłowy JSON: {parsed.error}</p>}
      {pages.length > 1 && (
        <label className="pe-row">
          <span>Która strona</span>
          <select value={page} onChange={(e) => setPage(Number(e.target.value))}>
            {pages.map((one) => <option key={one.index} value={one.index}>{one.label} — {one.parts.length} części</option>)}
          </select>
        </label>
      )}
      {pages.length > 0 && (
        <>
          <label className="pe-check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> <span>Zastąp obecne moduły (zamiast dopisać na końcu)</span></label>
          {theme !== null && (
            <label className="pe-check"><input type="checkbox" checked={takeTheme} onChange={(e) => setTakeTheme(e.target.checked)} /> <span>Weź też kolory wydarzenia ({theme.mode === 'dark' ? 'ciemne' : 'jasne'})</span></label>
          )}
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={run}>Przenieś {pages[Math.min(page, pages.length - 1)]?.parts.length ?? 0} części</button>
          </div>
        </>
      )}
      {result !== null && (
        <div role="status">
          <p className="wk-done">Przeniesiono {result.count} — zapisz, żeby zostały.</p>
          {result.warnings.length > 0 && <ul className="se-import-warn">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      )}
    </details>
  );
}
